# Routes dépenses — suivi des dépenses opérationnelles par catégorie
from fastapi import APIRouter, Request

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..utils import Pagination, corps, nombre, ou_none

router = APIRouter()

SELECT_DEPENSE = """
    SELECT d.*, v.immatriculation, v.marque
    FROM depenses d JOIN vehicules v ON d.vehicule_id = v.id WHERE d.id = %s
"""


def valider_depense(b: dict) -> float:
    if not b.get("vehicule_id") or not b.get("categorie") or not b.get("montant") or not b.get("date_depense"):
        raise ErreurApi(400, "Champs obligatoires : vehicule_id, categorie, montant, date_depense", cle="erreur")
    montant = nombre(b["montant"])
    if montant is None or montant <= 0:
        raise ErreurApi(400, "montant doit être un nombre positif", cle="erreur")
    return montant


def valeurs_depense(b: dict, montant: float) -> list:
    return [
        b["vehicule_id"], ou_none(b.get("mission_id")), b["categorie"], montant, b["date_depense"],
        ou_none(b.get("description")), ou_none(b.get("justificatif_url")),
    ]


@router.get("/stats", dependencies=[Connecte])
async def get_stats():
    """Totaux mois/année, répartition par catégorie et par véhicule, évolution sur 6 mois."""
    totaux = await db.query_one("""
        SELECT
          IFNULL(SUM(CASE WHEN YEAR(date_depense) = YEAR(CURDATE())
                           AND MONTH(date_depense) = MONTH(CURDATE())
                      THEN montant ELSE 0 END), 0) AS totalMois,
          IFNULL(SUM(CASE WHEN YEAR(date_depense) = YEAR(CURDATE())
                      THEN montant ELSE 0 END), 0) AS totalAnnee,
          COUNT(*) AS nbDepenses
        FROM depenses
    """)

    par_categorie = await db.query("""
        SELECT categorie, SUM(montant) AS total, COUNT(*) AS nb
        FROM depenses
        WHERE YEAR(date_depense) = YEAR(CURDATE())
        GROUP BY categorie
        ORDER BY total DESC
    """)

    par_vehicule = await db.query("""
        SELECT v.immatriculation, v.marque, SUM(d.montant) AS total
        FROM depenses d
        JOIN vehicules v ON d.vehicule_id = v.id
        WHERE YEAR(d.date_depense) = YEAR(CURDATE())
        GROUP BY d.vehicule_id, v.immatriculation, v.marque
        ORDER BY total DESC
    """)

    evolution = await db.query("""
        SELECT
          DATE_FORMAT(date_depense, '%Y-%m')      AS mois,
          MIN(DATE_FORMAT(date_depense, '%b %Y')) AS label,
          SUM(montant) AS total
        FROM depenses
        WHERE date_depense >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(date_depense, '%Y-%m')
        ORDER BY mois ASC
    """)

    return {
        "totalMois":          totaux["totalMois"] or 0,
        "totalAnnee":         totaux["totalAnnee"] or 0,
        "nbDepenses":         totaux["nbDepenses"] or 0,
        "parCategorie":       par_categorie,
        "parVehicule":        par_vehicule,
        "evolutionMensuelle": evolution,
    }


@router.get("", dependencies=[Connecte])
async def get_all(
    request: Request,
    vehicule_id: str | None = None,
    categorie: str | None = None,
    debut: str | None = None,
    fin: str | None = None,
):
    """Toutes les dépenses avec filtres optionnels : ?vehicule_id=&categorie=&debut=&fin="""
    where, params = " WHERE 1=1", []
    for colonne, op, valeur in (
        ("d.vehicule_id", "=", vehicule_id),
        ("d.categorie", "=", categorie),
        ("d.date_depense", ">=", debut),
        ("d.date_depense", "<=", fin),
    ):
        if valeur:
            where += f" AND {colonne} {op} %s"
            params.append(valeur)

    query = """
        SELECT d.*, v.immatriculation, v.marque, v.modele
        FROM depenses d
        JOIN vehicules v ON d.vehicule_id = v.id
    """ + where + " ORDER BY d.date_depense DESC"

    pg = Pagination(request)
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM depenses d" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])

    return await db.query(query, params)


@router.post("", status_code=201, dependencies=[Gestionnaire])
async def create(request: Request):
    b = await corps(request)
    montant = valider_depense(b)
    new_id = await db.execute(
        """INSERT INTO depenses (vehicule_id, mission_id, categorie, montant, date_depense, description, justificatif_url)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        valeurs_depense(b, montant),
    )
    return await db.query_one(SELECT_DEPENSE, [new_id])


@router.put("/{id}", dependencies=[Gestionnaire])
async def update(id: int, request: Request):
    b = await corps(request)
    if not await db.query("SELECT id FROM depenses WHERE id = %s", [id]):
        raise ErreurApi(404, "Dépense introuvable")

    montant = valider_depense(b)
    await db.execute(
        """UPDATE depenses
           SET vehicule_id=%s, mission_id=%s, categorie=%s, montant=%s, date_depense=%s,
               description=%s, justificatif_url=%s
           WHERE id=%s""",
        valeurs_depense(b, montant) + [id],
    )
    return await db.query_one(SELECT_DEPENSE, [id])


@router.delete("/{id}", dependencies=[Admin])
async def remove(id: int):
    if not await db.query("SELECT id FROM depenses WHERE id = %s", [id]):
        raise ErreurApi(404, "Dépense introuvable")

    await db.execute("DELETE FROM depenses WHERE id = %s", [id])
    return {"message": "Dépense supprimée"}
