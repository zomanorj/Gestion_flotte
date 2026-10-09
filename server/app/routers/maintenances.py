# Routes maintenances planifiées
from typing import Annotated

from fastapi import Depends, Query

from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import IdOpt, Message, Page, Vide
from ..schemas.enums import Priorite, StatutMaintenance
from ..schemas.operations import ClotureMaintenance, Maintenance, MaintenanceCreation, MaintenanceMiseAJour
from ..services import exploitation as service
from ..utils import Pagination, Routeur

router = Routeur()


@router.get("/alertes", dependencies=[Connecte], response_model=list[Maintenance], summary="Maintenances urgentes")
async def alertes():
    """Prévue sous 7 jours ou dépassée, priorité urgente, ou kilométrage déclencheur atteint."""
    return await service.maintenances_urgentes()


@router.get("", dependencies=[Connecte], response_model=list[Maintenance] | Page[Maintenance],
            summary="Liste des maintenances")
async def lister(
    statut: Annotated[StatutMaintenance | None, Vide] = None,
    priorite: Annotated[Priorite | None, Vide] = None,
    vehicule_id: Annotated[IdOpt, Query()] = None,
    pg: Pagination = Depends(),
):
    """depassee : date prévue passée sans que la maintenance soit terminée ou annulée."""
    return pg.formater(await service.lister_maintenances(statut, priorite, vehicule_id, pg.plage))


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Maintenance,
             summary="Planifier une maintenance")
async def creer(donnees: MaintenanceCreation):
    return await service.creer_maintenance(donnees)


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Maintenance, summary="Modifier une maintenance")
async def modifier(id: int, donnees: MaintenanceMiseAJour):
    """Seuls les champs envoyés sont modifiés : le statut et les notes de clôture sont conservés."""
    return await service.modifier_maintenance(id, donnees)


@router.put("/{id}/terminer", dependencies=[Gestionnaire], response_model=Maintenance,
            summary="Clôturer une maintenance")
async def cloturer(id: int, donnees: ClotureMaintenance):
    """Date réelle (aujourd'hui par défaut), coût réel et notes."""
    return await service.cloturer_maintenance(id, donnees)


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer une maintenance")
async def supprimer(id: int):
    await service.supprimer_maintenance(id)
    return {"message": "Maintenance supprimée"}
