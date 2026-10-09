# Routes paie des chauffeurs
from typing import Annotated

from fastapi import Depends, Path
from fastapi.responses import Response

from ..auth import Gestionnaire, verifier_token
from ..schemas.pilotage import FichePaie, PaieMensuelle, Salaire, SalaireSaisie
from ..services import paie as service
from ..utils import REPONSE_PDF, Routeur, reponse_pdf

router = Routeur()

Annee = Annotated[int, Path(ge=2000, le=2100)]
Mois = Annotated[int, Path(ge=1, le=12, description="1 à 12")]


@router.get("/{annee}/{mois}", dependencies=[Gestionnaire], response_model=PaieMensuelle,
            summary="Masse salariale du mois")
async def masse_salariale(annee: Annee, mois: Mois):
    return await service.masse_salariale(annee, mois)


@router.get("/chauffeur/{id}/{annee}/{mois}", dependencies=[Gestionnaire], response_model=FichePaie,
            summary="Fiche de paie d'un chauffeur")
async def fiche(id: int, annee: Annee, mois: Mois):
    return await service.fiche(id, annee, mois)


@router.get("/chauffeur/{id}/{annee}/{mois}/pdf", response_class=Response, responses=REPONSE_PDF,
            summary="Bulletin de paie PDF")
async def bulletin(id: int, annee: Annee, mois: Mois, user: dict = Depends(verifier_token)):
    """Accessible à la gestion, et au chauffeur pour son propre bulletin."""
    return reponse_pdf(*await service.bulletin_pdf(id, annee, mois, user))


@router.patch("/chauffeur/{id}/salaire", dependencies=[Gestionnaire], response_model=Salaire,
              summary="Modifier le salaire d'un chauffeur")
async def modifier_salaire(id: int, donnees: SalaireSaisie):
    """Salaire de base et/ou prime par mission."""
    return await service.modifier_salaire(id, donnees)
