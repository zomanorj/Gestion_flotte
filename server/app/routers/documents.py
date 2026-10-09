# Routes documents administratifs des véhicules (carte grise, assurance, vignette…)
import re
import time
from pathlib import Path
from typing import Annotated

from fastapi import Depends, File, Query, UploadFile

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..schemas.commun import IdOpt, Message, Page, Vide
from ..schemas.enums import TypeDocument
from ..schemas.operations import Document, DocumentSaisie, FichierEnvoye
from ..stockage import PREFIXE_URL, stockage, supprimer_sans_erreur
from ..utils import Pagination, Routeur, ligne_ou_404

router = Routeur()

EXTENSIONS_OK = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
TAILLE_MAX_OCTETS = 10 * 1024 * 1024  # 10 Mo

SELECT_DOC = """
    SELECT d.*, v.immatriculation, v.marque, DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
    FROM documents d JOIN vehicules v ON d.vehicule_id = v.id WHERE d.id = %s
"""


def statut_depuis_jours(jours: int) -> str:
    if jours < 0:
        return "expire"
    if jours <= 30:
        return "expire_bientot"
    return "valide"


def enrichir(doc: dict) -> dict:
    """Ajoute le statut calculé à partir de jours_restants (valeur SQL DATEDIFF)."""
    jours = int(doc["jours_restants"])
    return {**doc, "jours_restants": jours, "statut": statut_depuis_jours(jours)}


@router.get("/alertes", dependencies=[Connecte], response_model=list[Document],
            summary="Documents expirés ou expirant sous 30 jours")
async def get_alertes():
    rows = await db.query("""
        SELECT d.*, v.immatriculation, v.marque, v.modele,
          DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
        FROM documents d
        JOIN vehicules v ON d.vehicule_id = v.id
        WHERE d.date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ORDER BY d.date_expiration ASC
    """)
    return [enrichir(r) for r in rows]


@router.get("", dependencies=[Connecte], response_model=list[Document] | Page[Document], summary="Liste des documents")
async def get_all(
    vehicule_id: Annotated[IdOpt, Query()] = None,
    type: Annotated[TypeDocument | None, Vide] = None,
    pg: Pagination = Depends(),
):
    where, params = " WHERE 1=1", []
    if vehicule_id:
        where += " AND d.vehicule_id = %s"
        params.append(vehicule_id)
    if type:
        where += " AND d.type = %s"
        params.append(type)

    query = """
        SELECT d.*, v.immatriculation, v.marque, v.modele,
          DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
        FROM documents d
        JOIN vehicules v ON d.vehicule_id = v.id
    """ + where + " ORDER BY d.date_expiration ASC"

    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM documents d" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse([enrichir(r) for r in rows], count["total"])
    return [enrichir(r) for r in await db.query(query, params)]


async def _verifier_vehicule(vehicule_id: int) -> None:
    ligne_ou_404(await db.query_one("SELECT id FROM vehicules WHERE id = %s", [vehicule_id]), "Véhicule introuvable")


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Document, summary="Ajouter un document")
async def create(donnees: DocumentSaisie):
    """Le fichier se joint ensuite via POST /documents/{id}/fichier."""
    await _verifier_vehicule(donnees.vehicule_id)
    champs = donnees.model_dump()
    new_id = await db.execute(
        f"INSERT INTO documents ({', '.join(champs)}) VALUES ({', '.join(['%s'] * len(champs))})",
        list(champs.values()),
    )
    return enrichir(await db.query_one(SELECT_DOC, [new_id]))


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Document, summary="Modifier un document")
async def update(id: int, donnees: DocumentSaisie):
    """Le fichier joint ne change que via POST /documents/{id}/fichier."""
    ligne_ou_404(await db.query_one("SELECT id FROM documents WHERE id = %s", [id]), "Document introuvable")
    await _verifier_vehicule(donnees.vehicule_id)
    await db.execute(
        """UPDATE documents
           SET vehicule_id = %s, type = %s, numero = %s, date_emission = %s, date_expiration = %s, notes = %s
           WHERE id = %s""",
        [donnees.vehicule_id, donnees.type, donnees.numero, donnees.date_emission, donnees.date_expiration,
         donnees.notes, id],
    )
    return enrichir(await db.query_one(SELECT_DOC, [id]))


@router.post("/{id}/fichier", dependencies=[Gestionnaire], response_model=FichierEnvoye,
             summary="Joindre un fichier à un document")
async def upload_fichier(id: int, fichier: UploadFile | None = File(None, description="PDF, image ou Word, 10 Mo max")):
    """Remplace le fichier existant (l'ancien est supprimé)."""
    if not fichier or not fichier.filename:
        raise ErreurApi(400, "Aucun fichier fourni")

    ext = Path(fichier.filename).suffix.lower()
    if ext not in EXTENSIONS_OK:
        raise ErreurApi(400, "Type de fichier non autorisé (PDF, images, Word uniquement)")

    contenu = await fichier.read(TAILLE_MAX_OCTETS + 1)
    if len(contenu) > TAILLE_MAX_OCTETS:
        raise ErreurApi(413, "Fichier trop volumineux (10 Mo max)")

    doc = ligne_ou_404(await db.query_one("SELECT id, fichier_url FROM documents WHERE id = %s", [id]),
                       "Document introuvable")

    base = re.sub(r"[^a-zA-Z0-9]", "_", Path(fichier.filename).stem)[:80]
    cle = f"documents/doc_{id}_{int(time.time() * 1000)}_{base}{ext}"
    await stockage.enregistrer(cle, contenu, EXTENSIONS_OK[ext])

    fichier_url = PREFIXE_URL + cle
    try:
        await db.execute(
            "UPDATE documents SET fichier_url = %s, fichier_nom = %s WHERE id = %s",
            [fichier_url, fichier.filename, id],
        )
    except Exception:
        # La base n'a pas été mise à jour : on ne laisse pas de fichier orphelin
        await supprimer_sans_erreur(fichier_url)
        raise

    if doc["fichier_url"] and doc["fichier_url"] != fichier_url:
        await supprimer_sans_erreur(doc["fichier_url"])
    return {"message": "Fichier uploadé avec succès", "fichier_url": fichier_url, "fichier_nom": fichier.filename}


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un document")
async def remove(id: int):
    """Supprime aussi le fichier joint."""
    doc = ligne_ou_404(await db.query_one("SELECT id, fichier_url FROM documents WHERE id = %s", [id]),
                       "Document introuvable")
    await db.execute("DELETE FROM documents WHERE id = %s", [id])
    await supprimer_sans_erreur(doc["fichier_url"])
    return {"message": "Document supprimé"}
