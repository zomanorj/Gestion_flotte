# Routes notifications temps réel — lecture et marquage
from fastapi import APIRouter

from .. import db
from ..auth import Connecte

router = APIRouter(dependencies=[Connecte])


@router.get("")
async def get_all(non_lues: str | None = None):
    """50 dernières notifications, non lues en premier. ?non_lues=true pour filtrer."""
    query = """
        SELECT n.*, v.immatriculation
        FROM notifications n
        LEFT JOIN vehicules v ON v.id = n.vehicule_id
        WHERE 1=1
    """
    if non_lues == "true":
        query += " AND n.est_lue = 0"
    query += " ORDER BY n.est_lue ASC, n.created_at DESC LIMIT 50"

    rows = await db.query(query)
    count = await db.query_one("SELECT COUNT(*) AS total FROM notifications WHERE est_lue = 0")
    return {"notifications": rows, "non_lues": count["total"]}


# Déclarée avant /{id}/read pour ne pas être capturée par le paramètre
@router.patch("/read-all")
async def marquer_toutes_lues():
    await db.execute("UPDATE notifications SET est_lue=1 WHERE est_lue=0")
    return {"message": "Toutes les notifications marquées comme lues"}


@router.patch("/{id}/read")
async def marquer_lue(id: int):
    await db.execute("UPDATE notifications SET est_lue=1 WHERE id=%s", [id])
    return {"message": "Notification marquée comme lue"}


@router.delete("/{id}")
async def remove(id: int):
    await db.execute("DELETE FROM notifications WHERE id=%s", [id])
    return {"message": "Notification supprimée"}
