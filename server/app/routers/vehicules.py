# Routes véhicules
from typing import Annotated

from fastapi import Depends, Query

from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import Message, Page, Vide
from ..schemas.enums import StatutVehicule
from ..schemas.flotte import Vehicule, VehiculeAlerte, VehiculeCreation, VehiculeDetail, VehiculeMiseAJour
from ..services import vehicules as service
from ..utils import Pagination, Routeur

router = Routeur()


@router.get("", dependencies=[Connecte], response_model=list[Vehicule] | Page[Vehicule], summary="Liste des camions")
async def lister(
    statut: Annotated[StatutVehicule | None, Vide] = None,
    search: Annotated[str | None, Query(description="Immatriculation, marque ou modèle")] = None,
    pg: Pagination = Depends(),
):
    return pg.formater(await service.lister(statut, search, pg.plage))


@router.get("/alertes", dependencies=[Connecte], response_model=list[VehiculeAlerte],
            summary="Camions nécessitant une attention")
async def alertes():
    """Contrôle technique dans moins de 30 jours, ou plus de 10 000 km depuis la dernière vidange."""
    return await service.alertes()


@router.get("/{id}", dependencies=[Connecte], response_model=VehiculeDetail, summary="Détail d'un camion")
async def detail(id: int):
    """Camion avec ses 5 dernières missions et son historique de maintenance."""
    return await service.detail(id)


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Vehicule, summary="Ajouter un camion")
async def creer(donnees: VehiculeCreation):
    return await service.creer(donnees)


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Vehicule, summary="Modifier un camion")
async def modifier(id: int, donnees: VehiculeMiseAJour):
    """Seuls les champs envoyés sont modifiés ; un champ facultatif envoyé vide est effacé."""
    return await service.modifier(id, donnees)


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un camion")
async def supprimer(id: int):
    """Refusé si le camion a des missions, même terminées : l'historique doit être conservé."""
    await service.supprimer(id)
    return {"message": "Camion supprimé avec succès"}
