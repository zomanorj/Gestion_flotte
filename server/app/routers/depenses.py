# Routes dépenses
from datetime import date
from typing import Annotated

from fastapi import Depends, Query

from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import IdOpt, Message, Page, Vide
from ..schemas.enums import CategorieDepense
from ..schemas.operations import Depense, DepenseSaisie, StatistiquesDepenses
from ..services import exploitation as service
from ..utils import Pagination, Routeur

router = Routeur()


@router.get("/stats", dependencies=[Connecte], response_model=StatistiquesDepenses, summary="Statistiques")
async def statistiques():
    """Totaux du mois et de l'année, répartitions et évolution sur 6 mois."""
    return await service.statistiques_depenses()


@router.get("", dependencies=[Connecte], response_model=list[Depense] | Page[Depense], summary="Liste des dépenses")
async def lister(
    vehicule_id: Annotated[IdOpt, Query()] = None,
    categorie: Annotated[CategorieDepense | None, Vide] = None,
    debut: Annotated[date | None, Vide] = None,
    fin: Annotated[date | None, Vide] = None,
    pg: Pagination = Depends(),
):
    return pg.formater(await service.lister_depenses(vehicule_id, categorie, debut, fin, pg.plage))


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Depense, summary="Enregistrer une dépense")
async def creer(donnees: DepenseSaisie):
    return await service.creer_depense(donnees)


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Depense, summary="Modifier une dépense")
async def modifier(id: int, donnees: DepenseSaisie):
    return await service.modifier_depense(id, donnees)


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer une dépense")
async def supprimer(id: int):
    await service.supprimer_depense(id)
    return {"message": "Dépense supprimée"}
