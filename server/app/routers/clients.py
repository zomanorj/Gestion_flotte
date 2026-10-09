# Routes clients
from fastapi import Depends

from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import Message, Page
from ..schemas.operations import Client, ClientSaisie, MissionsClient
from ..services import exploitation as service
from ..utils import Pagination, Routeur

router = Routeur()


@router.get("", dependencies=[Connecte], response_model=list[Client] | Page[Client], summary="Liste des clients")
async def lister(pg: Pagination = Depends()):
    """Avec le nombre de missions de chaque client."""
    return pg.formater(await service.lister_clients(pg.plage))


@router.get("/{id}/missions", dependencies=[Connecte], response_model=MissionsClient,
            summary="Historique des missions d'un client")
async def missions(id: int):
    return await service.missions_du_client(id)


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Client, summary="Ajouter un client")
async def creer(donnees: ClientSaisie):
    return await service.creer_client(donnees)


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Client, summary="Modifier un client")
async def modifier(id: int, donnees: ClientSaisie):
    """Les champs de fiche non envoyés (NIF, STAT, site web…) sont conservés."""
    return await service.modifier_client(id, donnees)


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un client")
async def supprimer(id: int):
    """Les missions du client sont conservées, sans client associé."""
    await service.supprimer_client(id)
    return {"message": "Client supprimé"}
