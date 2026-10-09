# Routes maintenances planifiées — suivi et alertes
from typing import Annotated

from fastapi import Depends, Query

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import IdOpt, Message, Page, Vide
from ..schemas.enums import Priorite, StatutMaintenance
from ..schemas.operations import ClotureMaintenance, Maintenance, MaintenanceCreation, MaintenanceMiseAJour
from ..temps import aujourdhui
from ..utils import Pagination, Routeur, clause_set, ligne_ou_404

router = Routeur()

SELECT_MAINTENANCE = """
    SELECT mp.*, v.immatriculation, v.marque
    FROM maintenances_planifiees mp JOIN vehicules v ON mp.vehicule_id = v.id
    WHERE mp.id = %s
"""


def avec_depassee(rows: list[dict]) -> list[dict]:
    return [{**r, "depassee": bool(r["depassee"])} for r in rows]


async def _verifier_vehicule(vehicule_id: int) -> None:
    ligne_ou_404(await db.query_one("SELECT id FROM vehicules WHERE id = %s", [vehicule_id]), "Véhicule introuvable")


@router.get("/alertes", dependencies=[Connecte], response_model=list[Maintenance], summary="Maintenances urgentes")
async def get_alertes():
    """Prévue sous 7 jours ou dépassée, priorité urgente, ou kilométrage déclencheur atteint."""
    rows = await db.query("""
        SELECT mp.*, v.immatriculation, v.marque, v.modele, v.kilometrage,
          (mp.date_prevue < CURDATE()) AS depassee
        FROM maintenances_planifiees mp
        JOIN vehicules v ON mp.vehicule_id = v.id
        WHERE mp.statut NOT IN ('terminee','annulee')
          AND (
            mp.date_prevue <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            OR mp.priorite = 'urgente'
            OR (mp.kilometrage_declencheur IS NOT NULL AND v.kilometrage >= mp.kilometrage_declencheur)
          )
        ORDER BY mp.priorite DESC, mp.date_prevue ASC
    """)
    return avec_depassee(rows)


@router.get("", dependencies=[Connecte], response_model=list[Maintenance] | Page[Maintenance],
            summary="Liste des maintenances")
async def get_all(
    statut: Annotated[StatutMaintenance | None, Vide] = None,
    priorite: Annotated[Priorite | None, Vide] = None,
    vehicule_id: Annotated[IdOpt, Query()] = None,
    pg: Pagination = Depends(),
):
    """depassee : date prévue passée sans que la maintenance soit terminée ou annulée."""
    where, params = " WHERE 1=1", []
    for colonne, valeur in (("mp.statut", statut), ("mp.priorite", priorite), ("mp.vehicule_id", vehicule_id)):
        if valeur:
            where += f" AND {colonne} = %s"
            params.append(valeur)

    query = """
        SELECT mp.*, v.immatriculation, v.marque, v.modele, v.kilometrage,
          (mp.date_prevue < CURDATE() AND mp.statut NOT IN ('terminee','annulee')) AS depassee
        FROM maintenances_planifiees mp
        JOIN vehicules v ON mp.vehicule_id = v.id
    """ + where + " ORDER BY mp.date_prevue ASC"

    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM maintenances_planifiees mp" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(avec_depassee(rows), count["total"])
    return avec_depassee(await db.query(query, params))


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Maintenance,
             summary="Planifier une maintenance")
async def create(donnees: MaintenanceCreation):
    await _verifier_vehicule(donnees.vehicule_id)
    champs = donnees.model_dump()
    new_id = await db.execute(
        f"INSERT INTO maintenances_planifiees ({', '.join(champs)}) VALUES ({', '.join(['%s'] * len(champs))})",
        list(champs.values()),
    )
    return await db.query_one(SELECT_MAINTENANCE, [new_id])


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Maintenance, summary="Modifier une maintenance")
async def update(id: int, donnees: MaintenanceMiseAJour):
    """Seuls les champs envoyés sont modifiés : le statut et les notes de clôture sont conservés."""
    ligne_ou_404(await db.query_one("SELECT id FROM maintenances_planifiees WHERE id = %s", [id]),
                 "Maintenance introuvable")
    champs = donnees.champs_fournis()
    if "vehicule_id" in champs:
        await _verifier_vehicule(champs["vehicule_id"])
    if champs:
        colonnes, valeurs = clause_set(champs)
        await db.execute(f"UPDATE maintenances_planifiees SET {colonnes} WHERE id = %s", [*valeurs, id])
    return await db.query_one(SELECT_MAINTENANCE, [id])


@router.put("/{id}/terminer", dependencies=[Gestionnaire], response_model=Maintenance,
            summary="Clôturer une maintenance")
async def terminer(id: int, donnees: ClotureMaintenance):
    """Date réelle (aujourd'hui par défaut), coût réel et notes."""
    ligne_ou_404(await db.query_one("SELECT id FROM maintenances_planifiees WHERE id = %s", [id]),
                 "Maintenance introuvable")
    await db.execute(
        """UPDATE maintenances_planifiees
           SET statut = 'terminee', date_realisee = %s, cout_reel = %s, notes = %s
           WHERE id = %s""",
        [donnees.date_realisee or aujourdhui(), donnees.cout_reel, donnees.notes, id],
    )
    return await db.query_one(SELECT_MAINTENANCE, [id])


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer une maintenance")
async def remove(id: int):
    ligne_ou_404(await db.query_one("SELECT id FROM maintenances_planifiees WHERE id = %s", [id]),
                 "Maintenance introuvable")
    await db.execute("DELETE FROM maintenances_planifiees WHERE id = %s", [id])
    return {"message": "Maintenance supprimée"}
