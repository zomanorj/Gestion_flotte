# Routes carburant — suivi des pleins et statistiques de consommation
from datetime import date
from typing import Annotated

from fastapi import Depends, Query

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import IdOpt, Message, Page, Vide
from ..schemas.operations import Plein, PleinSaisie, StatistiquesCarburant
from ..utils import Pagination, Routeur, ligne_ou_404

router = Routeur()

SELECT_PLEIN = """
    SELECT c.*, v.immatriculation, v.marque
    FROM carburant c JOIN vehicules v ON c.vehicule_id = v.id WHERE c.id = %s
"""


def _valeurs(donnees: PleinSaisie) -> dict:
    """Colonnes à écrire ; le coût total est toujours recalculé."""
    return {**donnees.model_dump(), "cout_total": round(donnees.litres * donnees.prix_litre, 2)}


async def _verifier_vehicule(vehicule_id: int) -> None:
    ligne_ou_404(await db.query_one("SELECT id FROM vehicules WHERE id = %s", [vehicule_id]), "Véhicule introuvable")


@router.get("/stats", dependencies=[Connecte], response_model=StatistiquesCarburant, summary="Statistiques")
async def get_stats():
    """Totaux, répartition par véhicule et évolution mensuelle sur 6 mois."""
    totaux = await db.query_one("""
        SELECT
          IFNULL(SUM(litres), 0)              AS totalLitres,
          IFNULL(SUM(cout_total), 0)          AS coutTotal,
          IFNULL(AVG(consommation_reelle), 0) AS consommationMoyenne
        FROM carburant
    """)
    mois = await db.query_one("""
        SELECT IFNULL(SUM(cout_total), 0) AS coutMois
        FROM carburant
        WHERE YEAR(date_plein) = YEAR(CURDATE()) AND MONTH(date_plein) = MONTH(CURDATE())
    """)
    par_vehicule = await db.query("""
        SELECT v.immatriculation, v.marque,
          SUM(c.litres) AS litres,
          SUM(c.cout_total) AS cout
        FROM carburant c
        JOIN vehicules v ON c.vehicule_id = v.id
        GROUP BY c.vehicule_id, v.immatriculation, v.marque
        ORDER BY cout DESC
    """)
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
    return {**totaux, **mois, "parVehicule": par_vehicule, "evolutionMensuelle": evolution}


@router.get("", dependencies=[Connecte], response_model=list[Plein] | Page[Plein], summary="Liste des pleins")
async def get_all(
    vehicule_id: Annotated[IdOpt, Query()] = None,
    debut: Annotated[date | None, Vide] = None,
    fin: Annotated[date | None, Vide] = None,
    pg: Pagination = Depends(),
):
    where, params = " WHERE 1=1", []
    for condition, valeur in (("c.vehicule_id = %s", vehicule_id), ("c.date_plein >= %s", debut),
                              ("c.date_plein <= %s", fin)):
        if valeur:
            where += f" AND {condition}"
            params.append(valeur)

    query = """
        SELECT c.*, v.immatriculation, v.marque, v.modele
        FROM carburant c
        JOIN vehicules v ON c.vehicule_id = v.id
    """ + where + " ORDER BY c.date_plein DESC"

    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM carburant c" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])
    return await db.query(query, params)


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Plein, summary="Enregistrer un plein")
async def create(donnees: PleinSaisie):
    """Le coût total est calculé (litres × prix au litre)."""
    await _verifier_vehicule(donnees.vehicule_id)
    champs = _valeurs(donnees)
    new_id = await db.execute(
        f"INSERT INTO carburant ({', '.join(champs)}) VALUES ({', '.join(['%s'] * len(champs))})",
        list(champs.values()),
    )
    return await db.query_one(SELECT_PLEIN, [new_id])


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Plein, summary="Modifier un plein")
async def update(id: int, donnees: PleinSaisie):
    """Remplace le plein ; le coût total est recalculé."""
    ligne_ou_404(await db.query_one("SELECT id FROM carburant WHERE id = %s", [id]), "Plein introuvable")
    await _verifier_vehicule(donnees.vehicule_id)
    champs = _valeurs(donnees)
    colonnes = ", ".join(f"{c} = %s" for c in champs)
    await db.execute(f"UPDATE carburant SET {colonnes} WHERE id = %s", [*champs.values(), id])
    return await db.query_one(SELECT_PLEIN, [id])


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un plein")
async def remove(id: int):
    ligne_ou_404(await db.query_one("SELECT id FROM carburant WHERE id = %s", [id]), "Plein introuvable")
    await db.execute("DELETE FROM carburant WHERE id = %s", [id])
    return {"message": "Plein supprimé"}
