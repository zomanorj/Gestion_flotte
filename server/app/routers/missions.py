# Routes missions
from datetime import date
from typing import Annotated

from fastapi import Depends, Query
from fastapi.responses import Response

from ..auth import Admin, Connecte, Gestionnaire, verifier_token
from ..schemas.commun import Message, Page, Vide
from ..schemas.enums import StatutMission
from ..schemas.flotte import ChangementStatutMission, EvenementPlanning, Mission, MissionCreation
from ..services import missions as service
from ..utils import REPONSE_PDF, Pagination, Routeur, reponse_pdf

router = Routeur()


@router.get("/planning", dependencies=[Connecte], response_model=list[EvenementPlanning],
            summary="Missions au format calendrier")
async def planning():
    """Format FullCalendar ; couleur selon le statut (planifiée, en cours, terminée, annulée)."""
    return await service.planning()


@router.get("/miennes", response_model=list[Mission], summary="Missions du chauffeur connecté")
async def miennes(user: dict = Depends(verifier_token)):
    """Missions de la fiche chauffeur liée au compte (404 si le compte n'en a pas)."""
    return await service.du_compte(user)


@router.get("", dependencies=[Connecte], response_model=list[Mission] | Page[Mission], summary="Liste des missions")
async def lister(
    statut: Annotated[StatutMission | None, Vide] = None,
    debut: Annotated[date | None, Vide, Query(description="Départ à partir de cette date")] = None,
    fin: Annotated[date | None, Vide, Query(description="Départ jusqu'à cette date incluse")] = None,
    pg: Pagination = Depends(),
):
    return pg.formater(await service.lister(statut, debut, fin, pg.plage))


@router.get("/{id}/bon-livraison", dependencies=[Connecte], response_class=Response, responses=REPONSE_PDF,
            summary="Bon de livraison PDF")
async def bon_livraison(id: int):
    return reponse_pdf(*await service.bon_de_livraison(id))


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Mission, summary="Planifier une mission")
async def creer(donnees: MissionCreation):
    """Le camion et le chauffeur ne doivent avoir aucune autre mission active sur la même période."""
    return await service.creer(donnees)


@router.put("/{id}/statut", dependencies=[Gestionnaire], response_model=Mission, summary="Changer le statut")
async def changer_statut(id: int, donnees: ChangementStatutMission):
    """
    Cycle de vie : planifiee → en_cours | annulee, en_cours → terminee | annulee.
    Le coût carburant est calculé à la clôture.
    """
    return await service.changer_statut(id, donnees.statut)


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer une mission")
async def supprimer(id: int):
    """Une mission en cours libère son camion et son chauffeur."""
    await service.supprimer(id)
    return {"message": "Mission supprimée"}
