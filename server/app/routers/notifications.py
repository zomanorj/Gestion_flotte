# Routes notifications — lecture et marquage, propres à chaque utilisateur
from typing import Annotated

from fastapi import Depends, Query

from .. import db
from ..auth import verifier_token
from ..erreurs import ErreurApi
from ..schemas.commun import Message
from ..schemas.comptes import ListeNotifications
from ..services.notifications import VISIBLE_PAR
from ..utils import Routeur

router = Routeur()


async def _verifier_visible(id: int, user: dict) -> None:
    if not await db.query(f"SELECT n.id FROM notifications n WHERE n.id = %s AND {VISIBLE_PAR}",
                          [id, user["id"], user["role"]]):
        raise ErreurApi(404, "Notification introuvable")


async def _maj_etat(id: int, user_id: int, est_lue: int, supprimee: int) -> None:
    # GREATEST : un état ne revient jamais en arrière (une notification lue reste lue)
    await db.execute(
        """INSERT INTO notification_etats (notification_id, user_id, est_lue, supprimee)
           VALUES (%s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE est_lue = GREATEST(est_lue, %s), supprimee = GREATEST(supprimee, %s)""",
        [id, user_id, est_lue, supprimee, est_lue, supprimee],
    )


@router.get("", response_model=ListeNotifications, summary="Mes notifications")
async def get_all(
    non_lues: Annotated[bool, Query(description="true pour ne garder que les non lues")] = False,
    user: dict = Depends(verifier_token),
):
    """50 dernières notifications de l'utilisateur, non lues en premier."""
    jointures = """
        FROM notifications n
        LEFT JOIN notification_etats e ON e.notification_id = n.id AND e.user_id = %s
        LEFT JOIN vehicules v ON v.id = n.vehicule_id
    """
    where = f" WHERE {VISIBLE_PAR} AND COALESCE(e.supprimee, 0) = 0"
    params = [user["id"], user["id"], user["role"]]
    filtre = " AND COALESCE(e.est_lue, 0) = 0" if non_lues else ""

    rows = await db.query(
        "SELECT n.id, n.type, n.titre, n.message, n.vehicule_id, n.created_at, v.immatriculation,"
        " COALESCE(e.est_lue, 0) AS est_lue"
        + jointures + where + filtre + " ORDER BY est_lue ASC, n.created_at DESC LIMIT 50",
        params,
    )
    count = await db.query_one(
        "SELECT COUNT(*) AS total" + jointures + where + " AND COALESCE(e.est_lue, 0) = 0", params
    )
    return {
        "notifications": [{**r, "est_lue": bool(r["est_lue"])} for r in rows],
        "non_lues": count["total"],
    }


# Déclarée avant /{id}/read pour ne pas être capturée par le paramètre
@router.patch("/read-all", response_model=Message, summary="Tout marquer comme lu")
async def marquer_toutes_lues(user: dict = Depends(verifier_token)):
    await db.execute(
        f"""INSERT INTO notification_etats (notification_id, user_id, est_lue)
            SELECT n.id, %s, 1 FROM notifications n WHERE {VISIBLE_PAR}
            ON DUPLICATE KEY UPDATE est_lue = 1""",
        [user["id"], user["id"], user["role"]],
    )
    return {"message": "Toutes les notifications marquées comme lues"}


@router.patch("/{id}/read", response_model=Message, summary="Marquer comme lue")
async def marquer_lue(id: int, user: dict = Depends(verifier_token)):
    await _verifier_visible(id, user)
    await _maj_etat(id, user["id"], est_lue=1, supprimee=0)
    return {"message": "Notification marquée comme lue"}


@router.delete("/{id}", response_model=Message, summary="Masquer une notification")
async def remove(id: int, user: dict = Depends(verifier_token)):
    """Masque la notification pour l'utilisateur courant uniquement."""
    await _verifier_visible(id, user)
    await _maj_etat(id, user["id"], est_lue=1, supprimee=1)
    return {"message": "Notification supprimée"}
