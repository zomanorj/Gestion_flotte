# Routes notifications de l'utilisateur connecté
from typing import Annotated

from fastapi import Depends, Query

from ..auth import verifier_token
from ..schemas.commun import Message
from ..schemas.comptes import ListeNotifications
from ..services import notifications as service
from ..utils import Routeur

router = Routeur()


@router.get("", response_model=ListeNotifications, summary="Mes notifications")
async def lister(
    non_lues: Annotated[bool, Query(description="true pour ne garder que les non lues")] = False,
    user: dict = Depends(verifier_token),
):
    """50 dernières notifications, non lues en premier."""
    return await service.lister(user, non_lues)


# Déclarée avant /{id}/read pour ne pas être capturée par le paramètre
@router.patch("/read-all", response_model=Message, summary="Tout marquer comme lu")
async def tout_marquer_lu(user: dict = Depends(verifier_token)):
    await service.tout_marquer_lu(user)
    return {"message": "Toutes les notifications marquées comme lues"}


@router.patch("/{id}/read", response_model=Message, summary="Marquer comme lue")
async def marquer_lue(id: int, user: dict = Depends(verifier_token)):
    await service.marquer_lue(id, user)
    return {"message": "Notification marquée comme lue"}


@router.delete("/{id}", response_model=Message, summary="Masquer une notification")
async def masquer(id: int, user: dict = Depends(verifier_token)):
    """Pour l'utilisateur courant uniquement."""
    await service.masquer(id, user)
    return {"message": "Notification supprimée"}
