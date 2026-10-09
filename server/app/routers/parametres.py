# Routes des paramètres métier : consultation par la gestion, modification par l'administrateur
from fastapi import Depends

from ..auth import Gestionnaire, verifier_role
from ..schemas.parametres import ModificationParametres, ModificationTracee, Parametre
from ..services import parametres as service
from ..utils import Routeur

router = Routeur()
admin_seulement = verifier_role("admin")


@router.get("", dependencies=[Gestionnaire], response_model=list[Parametre], summary="Paramètres métier")
async def lister():
    """Prix du gasoil, barème de paie, seuils d'alerte : valeur en vigueur, défaut et bornes."""
    return await service.lister()


@router.put("", response_model=list[Parametre], summary="Modifier des paramètres")
async def modifier(donnees: ModificationParametres, auteur: dict = Depends(admin_seulement)):
    """
    Toutes les valeurs sont appliquées ou aucune. Chaque changement est tracé dans l'historique.
    Effet immédiat sur les calculs (coût carburant, paie, alertes).
    """
    return await service.modifier(donnees.valeurs, auteur)


@router.get("/historique", dependencies=[Depends(admin_seulement)], response_model=list[ModificationTracee],
            summary="Historique des modifications")
async def historique():
    """100 dernières modifications, les plus récentes en premier."""
    return await service.historique()


@router.delete("/{cle}", response_model=list[Parametre], summary="Revenir à la valeur par défaut")
async def reinitialiser(cle: str, auteur: dict = Depends(admin_seulement)):
    return await service.reinitialiser(cle, auteur)
