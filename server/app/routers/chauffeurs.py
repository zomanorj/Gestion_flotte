# Routes chauffeurs — CRUD et historique de missions
from fastapi import APIRouter, Depends, Request

from .. import db
from ..auth import ROLES_GESTION, Admin, Connecte, Gestionnaire, verifier_token
from ..erreurs import ErreurApi
from ..utils import Pagination, corps, ou_none

router = APIRouter()

CHAMPS_SALAIRE = ("salaire_base", "prime_mission")


def masquer_salaire(chauffeur: dict, user: dict) -> dict:
    """La rémunération n'est visible que par la gestion, ou par le chauffeur pour sa propre fiche."""
    if user["role"] in ROLES_GESTION or chauffeur.get("user_id") == user["id"]:
        return chauffeur
    return {k: v for k, v in chauffeur.items() if k not in CHAMPS_SALAIRE}


@router.get("")
async def get_all(
    request: Request,
    statut: str | None = None,
    search: str | None = None,
    user: dict = Depends(verifier_token),
):
    """Tous les chauffeurs, avec filtres optionnels ?statut=&search="""
    where, params = " WHERE 1=1", []
    if statut:
        where += " AND statut = %s"
        params.append(statut)
    if search:
        where += " AND (nom LIKE %s OR prenom LIKE %s OR numero_permis LIKE %s)"
        params += [f"%{search}%"] * 3

    query = "SELECT * FROM chauffeurs" + where + " ORDER BY nom ASC, prenom ASC"

    pg = Pagination(request)
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM chauffeurs" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse([masquer_salaire(r, user) for r in rows], count["total"])

    return [masquer_salaire(r, user) for r in await db.query(query, params)]


@router.get("/{id}")
async def get_by_id(id: int, user: dict = Depends(verifier_token)):
    """Un chauffeur avec ses statistiques de missions."""
    chauffeur = await db.query_one("SELECT * FROM chauffeurs WHERE id = %s", [id])
    if not chauffeur:
        raise ErreurApi(404, "Chauffeur introuvable")

    stats = await db.query_one("""
        SELECT
          COUNT(*) AS total_missions,
          SUM(distance_km) AS total_km,
          SUM(CASE WHEN statut = 'terminee' THEN 1 ELSE 0 END) AS missions_terminees
        FROM missions
        WHERE chauffeur_id = %s
    """, [id])
    return {**masquer_salaire(chauffeur, user), "stats": stats}


@router.get("/{id}/missions", dependencies=[Connecte])
async def get_missions(id: int):
    """Historique complet des missions d'un chauffeur."""
    if not await db.query("SELECT id FROM chauffeurs WHERE id = %s", [id]):
        raise ErreurApi(404, "Chauffeur introuvable")

    return await db.query("""
        SELECT m.*, v.immatriculation, v.marque, v.modele
        FROM missions m
        JOIN vehicules v ON m.vehicule_id = v.id
        WHERE m.chauffeur_id = %s
        ORDER BY m.date_depart DESC
    """, [id])


@router.post("", status_code=201, dependencies=[Gestionnaire])
async def create(request: Request):
    """Crée un nouveau chauffeur. Vérifie l'unicité du numéro de permis."""
    b = await corps(request)
    if not b.get("nom") or not b.get("prenom") or not b.get("telephone") or not b.get("numero_permis"):
        raise ErreurApi(400, "Champs obligatoires manquants")

    if await db.query("SELECT id FROM chauffeurs WHERE numero_permis = %s", [b["numero_permis"]]):
        raise ErreurApi(409, "Ce numéro de permis est déjà enregistré")

    new_id = await db.execute(
        """INSERT INTO chauffeurs (user_id, nom, prenom, telephone, numero_permis, categorie_permis, statut)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        [
            ou_none(b.get("user_id")), b["nom"], b["prenom"], b["telephone"], b["numero_permis"],
            b.get("categorie_permis") or "B",
            b.get("statut") or "disponible",
        ],
    )
    return await db.query_one("SELECT * FROM chauffeurs WHERE id = %s", [new_id])


@router.put("/{id}", dependencies=[Gestionnaire])
async def update(id: int, request: Request):
    """Met à jour les informations d'un chauffeur."""
    b = await corps(request)
    if not await db.query("SELECT id FROM chauffeurs WHERE id = %s", [id]):
        raise ErreurApi(404, "Chauffeur introuvable")

    await db.execute(
        """UPDATE chauffeurs SET
             nom              = COALESCE(%s, nom),
             prenom           = COALESCE(%s, prenom),
             telephone        = COALESCE(%s, telephone),
             numero_permis    = COALESCE(%s, numero_permis),
             categorie_permis = COALESCE(%s, categorie_permis),
             statut           = COALESCE(%s, statut)
           WHERE id = %s""",
        [
            *(ou_none(b.get(k)) for k in (
                "nom", "prenom", "telephone", "numero_permis", "categorie_permis", "statut",
            )),
            id,
        ],
    )
    return await db.query_one("SELECT * FROM chauffeurs WHERE id = %s", [id])


@router.delete("/{id}", dependencies=[Admin])
async def remove(id: int):
    """
    Supprime un chauffeur uniquement s'il n'a aucune mission (active ou historique).
    Un chauffeur avec un historique de missions doit être archivé, pas supprimé.
    """
    existant = await db.query_one("SELECT id, nom, prenom FROM chauffeurs WHERE id = %s", [id])
    if not existant:
        raise ErreurApi(404, "Chauffeur introuvable")

    nom = f"{existant['prenom']} {existant['nom']}"
    stats = await db.query_one(
        """SELECT COUNT(*) AS nb, SUM(statut IN ('planifiee','en_cours')) AS actives
           FROM missions WHERE chauffeur_id = %s""",
        [id],
    )
    if (stats["actives"] or 0) > 0:
        raise ErreurApi(409, f"Impossible de supprimer : {nom} a des missions en cours ou planifiées")
    if stats["nb"] > 0:
        raise ErreurApi(
            409,
            f"Impossible de supprimer : {nom} a un historique de {stats['nb']} mission(s). "
            'Passez-le en statut "congé" à la place.',
        )

    await db.execute("DELETE FROM chauffeurs WHERE id = %s", [id])
    return {"message": "Chauffeur supprimé avec succès"}
