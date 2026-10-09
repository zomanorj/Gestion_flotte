# Routes chauffeurs
from typing import Annotated

from fastapi import Depends, Query

from ..auth import Admin, Connecte, Gestionnaire, verifier_token
from ..schemas.commun import Message, Page, Vide
from ..schemas.enums import StatutChauffeur
from ..schemas.flotte import Chauffeur, ChauffeurCreation, ChauffeurDetail, ChauffeurMiseAJour, Mission
from ..services import chauffeurs as service
from ..utils import Pagination, Routeur

router = Routeur()


@router.get("", response_model=list[Chauffeur] | Page[Chauffeur], summary="Liste des chauffeurs")
async def lister(
    statut: Annotated[StatutChauffeur | None, Vide] = None,
    search: Annotated[str | None, Query(description="Nom, prénom ou numéro de permis")] = None,
    pg: Pagination = Depends(),
    user: dict = Depends(verifier_token),
):
    """La rémunération n'apparaît que pour la gestion, ou pour le chauffeur sur sa propre fiche."""
    return pg.formater(await service.lister(statut, search, pg.plage, user))


@router.get("/{id}", response_model=ChauffeurDetail, summary="Détail d'un chauffeur")
async def detail(id: int, user: dict = Depends(verifier_token)):
    return await service.detail(id, user)


@router.get("/{id}/missions", dependencies=[Connecte], response_model=list[Mission],
            summary="Historique des missions d'un chauffeur")
async def missions(id: int):
    return await service.missions(id)


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Chauffeur,
             summary="Ajouter un chauffeur")
async def creer(donnees: ChauffeurCreation):
    return await service.creer(donnees)


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Chauffeur, summary="Modifier un chauffeur")
async def modifier(id: int, donnees: ChauffeurMiseAJour):
    """Seuls les champs envoyés sont modifiés."""
    return await service.modifier(id, donnees)


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un chauffeur")
async def supprimer(id: int):
    """Refusé si le chauffeur a des missions : le passer en congé à la place."""
    await service.supprimer(id)
    return {"message": "Chauffeur supprimé avec succès"}
