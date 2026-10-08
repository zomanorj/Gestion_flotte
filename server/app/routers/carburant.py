# Routes carburant — suivi des pleins et statistiques de consommation
from fastapi import APIRouter, Request

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..utils import Pagination, corps, nombre, ou_none

router = APIRouter()

SELECT_PLEIN = """
    SELECT c.*, v.immatriculation, v.marque
    FROM carburant c JOIN vehicules v ON c.vehicule_id = v.id WHERE c.id = %s
"""


def valider_plein(b: dict) -> tuple[float, float]:
    """Vérifie les champs obligatoires et retourne (litres, prix_litre) en nombres."""
    if not b.get("vehicule_id") or not b.get("date_plein") or not b.get("litres") or not b.get("prix_litre"):
        raise ErreurApi(400, "Champs obligatoires : vehicule_id, date_plein, litres, prix_litre", cle="erreur")
    litres, prix = nombre(b["litres"]), nombre(b["prix_litre"])
    if litres is None or litres <= 0:
        raise ErreurApi(400, "litres doit être un nombre positif", cle="erreur")
    if prix is None or prix <= 0:
        raise ErreurApi(400, "prix_litre doit être un nombre positif", cle="erreur")
    return litres, prix


def valeurs_plein(b: dict, litres: float, prix: float) -> list:
    return [
        b["vehicule_id"], ou_none(b.get("mission_id")), b["date_plein"], litres, prix, litres * prix,
        ou_none(b.get("kilometrage_au_plein")), ou_none(b.get("consommation_reelle")),
        ou_none(b.get("station")), ou_none(b.get("ville")), b.get("type_carburant") or "diesel",
        ou_none(b.get("notes")),
    ]


@router.get("/stats", dependencies=[Connecte])
async def get_stats():
    """Totaux, répartition par véhicule et évolution mensuelle sur 6 mois."""
    totaux = await db.query_one("""
        SELECT
          IFNULL(SUM(litres), 0)             AS totalLitres,
          IFNULL(SUM(cout_total), 0)         AS coutTotal,
          IFNULL(AVG(consommation_reelle), 0) AS consommationMoyenne
        FROM carburant
    """)

    mois = await db.query_one("""
        SELECT IFNULL(SUM(cout_total), 0) AS coutMois
        FROM carburant
        WHERE YEAR(date_plein) = YEAR(CURDATE()) AND MONTH(date_plein) = MONTH(CURDATE())
    """)

    # Répartition par véhicule (graphique Doughnut)
    par_vehicule = await db.query("""
        SELECT v.immatriculation, v.marque,
          SUM(c.litres) AS litres,
          SUM(c.cout_total) AS cout
        FROM carburant c
        JOIN vehicules v ON c.vehicule_id = v.id
        GROUP BY c.vehicule_id, v.immatriculation, v.marque
        ORDER BY cout DESC
    """)

    # Évolution mensuelle sur 6 mois (graphique Bar)
    evolution = await db.query("""
        SELECT
          DATE_FORMAT(date_plein, '%Y-%m')      AS mois,
          MIN(DATE_FORMAT(date_plein, '%b %Y')) AS label,
          SUM(litres)     AS litres,
          SUM(cout_total) AS cout
        FROM carburant
        WHERE date_plein >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(date_plein, '%Y-%m')
        ORDER BY mois ASC
    """)

    return {
        "totalLitres":         totaux["totalLitres"] or 0,
        "coutTotal":           totaux["coutTotal"] or 0,
        "consommationMoyenne": totaux["consommationMoyenne"] or 0,
        "coutMois":            mois["coutMois"] or 0,
        "parVehicule":         par_vehicule,
        "evolutionMensuelle":  evolution,
    }


@router.get("", dependencies=[Connecte])
async def get_all(request: Request, vehicule_id: str | None = None, debut: str | None = None, fin: str | None = None):
    """Tous les pleins avec filtres optionnels : ?vehicule_id=1&debut=2025-01-01&fin=2025-12-31"""
    where, params = " WHERE 1=1", []
    if vehicule_id:
        where += " AND c.vehicule_id = %s"
        params.append(vehicule_id)
    if debut:
        where += " AND c.date_plein >= %s"
        params.append(debut)
    if fin:
        where += " AND c.date_plein <= %s"
        params.append(fin)

    query = """
        SELECT c.*, v.immatriculation, v.marque, v.modele
        FROM carburant c
        JOIN vehicules v ON c.vehicule_id = v.id
    """ + where + " ORDER BY c.date_plein DESC"

    pg = Pagination(request)
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM carburant c" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])

    return await db.query(query, params)


@router.post("", status_code=201, dependencies=[Gestionnaire])
async def create(request: Request):
    """Enregistre un plein. Le coût total est calculé automatiquement (litres × prix_litre)."""
    b = await corps(request)
    litres, prix = valider_plein(b)
    new_id = await db.execute(
        """INSERT INTO carburant
             (vehicule_id, mission_id, date_plein, litres, prix_litre, cout_total,
              kilometrage_au_plein, consommation_reelle, station, ville, type_carburant, notes)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        valeurs_plein(b, litres, prix),
    )
    return await db.query_one(SELECT_PLEIN, [new_id])


@router.put("/{id}", dependencies=[Gestionnaire])
async def update(id: int, request: Request):
    """Met à jour un plein. Recalcule automatiquement le coût total."""
    b = await corps(request)
    if not await db.query("SELECT id FROM carburant WHERE id = %s", [id]):
        raise ErreurApi(404, "Plein introuvable")

    litres, prix = valider_plein(b)
    await db.execute(
        """UPDATE carburant
           SET vehicule_id=%s, mission_id=%s, date_plein=%s, litres=%s, prix_litre=%s, cout_total=%s,
               kilometrage_au_plein=%s, consommation_reelle=%s, station=%s, ville=%s, type_carburant=%s, notes=%s
           WHERE id=%s""",
        valeurs_plein(b, litres, prix) + [id],
    )
    return await db.query_one(SELECT_PLEIN, [id])


@router.delete("/{id}", dependencies=[Admin])
async def remove(id: int):
    if not await db.query("SELECT id FROM carburant WHERE id = %s", [id]):
        raise ErreurApi(404, "Plein introuvable")

    await db.execute("DELETE FROM carburant WHERE id = %s", [id])
    return {"message": "Plein supprimé"}
