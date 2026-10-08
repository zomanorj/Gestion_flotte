# Routes documents administratifs des véhicules (carte grise, assurance, vignette…)
import re
import time
from pathlib import Path

from fastapi import APIRouter, File, Request, UploadFile

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..stockage import PREFIXE_URL, stockage, supprimer_sans_erreur
from ..utils import Pagination, corps, ou_none

router = APIRouter()

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


@router.get("/alertes", dependencies=[Connecte])
async def get_alertes():
    """Documents expirés ou expirant dans les 30 prochains jours, les plus urgents en premier."""
    rows = await db.query("""
        SELECT d.*, v.immatriculation, v.marque, v.modele,
          DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
        FROM documents d
        JOIN vehicules v ON d.vehicule_id = v.id
        WHERE d.date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ORDER BY d.date_expiration ASC
    """)
    return [enrichir(r) for r in rows]


@router.get("", dependencies=[Connecte])
async def get_all(request: Request, vehicule_id: str | None = None, type: str | None = None):
    """Tous les documents avec filtres optionnels : ?vehicule_id=1&type=assurance"""
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

    pg = Pagination(request)
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM documents d" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse([enrichir(r) for r in rows], count["total"])

    return [enrichir(r) for r in await db.query(query, params)]


@router.post("", status_code=201, dependencies=[Gestionnaire])
async def create(request: Request):
    """Crée un nouveau document pour un véhicule (le fichier se joint ensuite via /{id}/fichier)."""
    b = await corps(request)
    if not b.get("vehicule_id") or not b.get("type") or not b.get("date_emission") or not b.get("date_expiration"):
        raise ErreurApi(400, "Champs obligatoires : vehicule_id, type, date_emission, date_expiration")

    new_id = await db.execute(
        """INSERT INTO documents (vehicule_id, type, numero, date_emission, date_expiration, notes)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        [
            b["vehicule_id"], b["type"], ou_none(b.get("numero")), b["date_emission"], b["date_expiration"],
            ou_none(b.get("notes")),
        ],
    )
    return enrichir(await db.query_one(SELECT_DOC, [new_id]))


@router.put("/{id}", dependencies=[Gestionnaire])
async def update(id: int, request: Request):
    """Met à jour un document existant. Le fichier joint ne change que via /{id}/fichier."""
    b = await corps(request)
    if not await db.query("SELECT id FROM documents WHERE id = %s", [id]):
        raise ErreurApi(404, "Document introuvable")

    await db.execute(
        """UPDATE documents
           SET vehicule_id=%s, type=%s, numero=%s, date_emission=%s, date_expiration=%s, notes=%s
           WHERE id=%s""",
        [
            b.get("vehicule_id"), b.get("type"), ou_none(b.get("numero")),
            b.get("date_emission"), b.get("date_expiration"), ou_none(b.get("notes")), id,
        ],
    )
    return enrichir(await db.query_one(SELECT_DOC, [id]))


@router.post("/{id}/fichier", dependencies=[Gestionnaire])
async def upload_fichier(id: int, fichier: UploadFile | None = File(None)):
    """Upload d'un fichier pour un document existant ; remplace et supprime l'ancien fichier."""
    if not fichier or not fichier.filename:
        raise ErreurApi(400, "Aucun fichier fourni")

    ext = Path(fichier.filename).suffix.lower()
    if ext not in EXTENSIONS_OK:
        raise ErreurApi(400, "Type de fichier non autorisé (PDF, images, Word uniquement)")

    contenu = await fichier.read(TAILLE_MAX_OCTETS + 1)
    if len(contenu) > TAILLE_MAX_OCTETS:
        raise ErreurApi(413, "Fichier trop volumineux (10 Mo max)")

    doc = await db.query_one("SELECT id, fichier_url FROM documents WHERE id = %s", [id])
    if not doc:
        raise ErreurApi(404, "Document introuvable")

    base = re.sub(r"[^a-zA-Z0-9]", "_", Path(fichier.filename).stem)[:80]
    cle = f"documents/doc_{id}_{int(time.time() * 1000)}_{base}{ext}"
    await stockage.enregistrer(cle, contenu, EXTENSIONS_OK[ext])

    fichier_url = PREFIXE_URL + cle
    try:
        await db.execute(
            "UPDATE documents SET fichier_url=%s, fichier_nom=%s WHERE id=%s",
            [fichier_url, fichier.filename, id],
        )
    except Exception:
        # La base n'a pas été mise à jour : on ne laisse pas de fichier orphelin
        await supprimer_sans_erreur(fichier_url)
        raise

    if doc["fichier_url"] and doc["fichier_url"] != fichier_url:
        await supprimer_sans_erreur(doc["fichier_url"])
    return {"message": "Fichier uploadé avec succès", "fichier_url": fichier_url, "fichier_nom": fichier.filename}


@router.delete("/{id}", dependencies=[Admin])
async def remove(id: int):
    doc = await db.query_one("SELECT id, fichier_url FROM documents WHERE id = %s", [id])
    if not doc:
        raise ErreurApi(404, "Document introuvable")

    await db.execute("DELETE FROM documents WHERE id = %s", [id])
    await supprimer_sans_erreur(doc["fichier_url"])
    return {"message": "Document supprimé"}
