# Routes carburant
from datetime import date
from typing import Annotated

from fastapi import Depends, Query

from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import IdOpt, Message, Page, Vide
from ..schemas.operations import Plein, PleinSaisie, StatistiquesCarburant
from ..services import exploitation as service
from ..utils import Pagination, Routeur

router = Routeur()


@router.get("/stats", dependencies=[Connecte], response_model=StatistiquesCarburant, summary="Statistiques")
async def statistiques():
    """Totaux, répartition par véhicule et évolution mensuelle sur 6 mois."""
    return await service.statistiques_carburant()


@router.get("", dependencies=[Connecte], response_model=list[Plein] | Page[Plein], summary="Liste des pleins")
async def lister(
    vehicule_id: Annotated[IdOpt, Query()] = None,
    debut: Annotated[date | None, Vide] = None,
    fin: Annotated[date | None, Vide] = None,
    pg: Pagination = Depends(),
):
    return pg.formater(await service.lister_pleins(vehicule_id, debut, fin, pg.plage))


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Plein, summary="Enregistrer un plein")
async def creer(donnees: PleinSaisie):
    """Le coût total est calculé (litres × prix au litre)."""
    return await service.creer_plein(donnees)


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Plein, summary="Modifier un plein")
async def modifier(id: int, donnees: PleinSaisie):
    """Remplace le plein ; le coût total est recalculé."""
    return await service.modifier_plein(id, donnees)


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un plein")
async def supprimer(id: int):
    await service.supprimer_plein(id)
    return {"message": "Plein supprimé"}
