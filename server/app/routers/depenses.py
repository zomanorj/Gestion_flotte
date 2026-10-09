# Routes dépenses — suivi des dépenses opérationnelles par catégorie
from datetime import date
from typing import Annotated

from fastapi import Depends, Query

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import IdOpt, Message, Page, Vide
from ..schemas.enums import CategorieDepense
from ..schemas.operations import Depense, DepenseSaisie, StatistiquesDepenses
from ..utils import Pagination, Routeur, ligne_ou_404

router = Routeur()

SELECT_DEPENSE = """
    SELECT d.*, v.immatriculation, v.marque
    FROM depenses d JOIN vehicules v ON d.vehicule_id = v.id WHERE d.id = %s
"""


async def _verifier_vehicule(vehicule_id: int) -> None:
    ligne_ou_404(await db.query_one("SELECT id FROM vehicules WHERE id = %s", [vehicule_id]), "Véhicule introuvable")


@router.get("/stats", dependencies=[Connecte], response_model=StatistiquesDepenses, summary="Statistiques")
async def get_stats():
    """Totaux du mois et de l'année, répartitions et évolution sur 6 mois."""
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
    return {**totaux, "parCategorie": par_categorie, "parVehicule": par_vehicule, "evolutionMensuelle": evolution}


@router.get("", dependencies=[Connecte], response_model=list[Depense] | Page[Depense], summary="Liste des dépenses")
async def get_all(
    vehicule_id: Annotated[IdOpt, Query()] = None,
    categorie: Annotated[CategorieDepense | None, Vide] = None,
    debut: Annotated[date | None, Vide] = None,
    fin: Annotated[date | None, Vide] = None,
    pg: Pagination = Depends(),
):
    where, params = " WHERE 1=1", []
    for condition, valeur in (("d.vehicule_id = %s", vehicule_id), ("d.categorie = %s", categorie),
                              ("d.date_depense >= %s", debut), ("d.date_depense <= %s", fin)):
        if valeur:
            where += f" AND {condition}"
            params.append(valeur)

    query = """
        SELECT d.*, v.immatriculation, v.marque, v.modele
        FROM depenses d
        JOIN vehicules v ON d.vehicule_id = v.id
    """ + where + " ORDER BY d.date_depense DESC"

    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM depenses d" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])
    return await db.query(query, params)


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Depense, summary="Enregistrer une dépense")
async def create(donnees: DepenseSaisie):
    await _verifier_vehicule(donnees.vehicule_id)
    champs = donnees.model_dump()
    new_id = await db.execute(
        f"INSERT INTO depenses ({', '.join(champs)}) VALUES ({', '.join(['%s'] * len(champs))})",
        list(champs.values()),
    )
    return await db.query_one(SELECT_DEPENSE, [new_id])


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Depense, summary="Modifier une dépense")
async def update(id: int, donnees: DepenseSaisie):
    ligne_ou_404(await db.query_one("SELECT id FROM depenses WHERE id = %s", [id]), "Dépense introuvable")
    await _verifier_vehicule(donnees.vehicule_id)
    champs = donnees.model_dump()
    colonnes = ", ".join(f"{c} = %s" for c in champs)
    await db.execute(f"UPDATE depenses SET {colonnes} WHERE id = %s", [*champs.values(), id])
    return await db.query_one(SELECT_DEPENSE, [id])


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer une dépense")
async def remove(id: int):
    ligne_ou_404(await db.query_one("SELECT id FROM depenses WHERE id = %s", [id]), "Dépense introuvable")
    await db.execute("DELETE FROM depenses WHERE id = %s", [id])
    return {"message": "Dépense supprimée"}
