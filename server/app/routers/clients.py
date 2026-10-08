# Routes clients — CRUD et historique des missions par client
from fastapi import APIRouter, Request

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..utils import Pagination, corps, ou_none

router = APIRouter()


def valeurs_client(b: dict) -> list:
    return [
        b.get("nom"), b.get("type") or "entreprise", ou_none(b.get("contact_nom")), ou_none(b.get("telephone")),
        ou_none(b.get("email")), ou_none(b.get("adresse")), ou_none(b.get("ville")), ou_none(b.get("notes")),
    ]


@router.get("", dependencies=[Connecte])
async def get_all(request: Request):
    """Tous les clients avec le nombre de missions associées."""
    rows = await db.query("""
        SELECT c.*,
          COUNT(m.id) AS nb_missions,
          IFNULL(SUM(m.cout_carburant), 0) AS chiffre_affaires
        FROM clients c
        LEFT JOIN missions m ON m.client_id = c.id
        GROUP BY c.id
        ORDER BY c.nom ASC
    """)

    pg = Pagination(request)
    if pg.actif:
        return pg.reponse(rows[pg.offset:pg.offset + pg.limit], len(rows))

    return rows


@router.get("/{id}/missions", dependencies=[Connecte])
async def get_missions(id: int):
    """Historique des missions d'un client donné."""
    client = await db.query_one("SELECT id, nom FROM clients WHERE id = %s", [id])
    if not client:
        raise ErreurApi(404, "Client introuvable")

    missions = await db.query("""
        SELECT m.*, v.immatriculation, v.marque,
          c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM missions m
        JOIN vehicules  v ON m.vehicule_id  = v.id
        JOIN chauffeurs c ON m.chauffeur_id = c.id
        WHERE m.client_id = %s
        ORDER BY m.date_depart DESC
    """, [id])
    return {"client": client, "missions": missions}


@router.post("", status_code=201, dependencies=[Gestionnaire])
async def create(request: Request):
    b = await corps(request)
    if not b.get("nom"):
        raise ErreurApi(400, "Le nom du client est obligatoire")

    new_id = await db.execute(
        """INSERT INTO clients (nom, type, contact_nom, telephone, email, adresse, ville, notes)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        valeurs_client(b),
    )
    return await db.query_one("SELECT * FROM clients WHERE id = %s", [new_id])


@router.put("/{id}", dependencies=[Gestionnaire])
async def update(id: int, request: Request):
    b = await corps(request)
    if not await db.query("SELECT id FROM clients WHERE id = %s", [id]):
        raise ErreurApi(404, "Client introuvable")

    await db.execute(
        """UPDATE clients SET nom=%s, type=%s, contact_nom=%s, telephone=%s,
             email=%s, adresse=%s, ville=%s, notes=%s WHERE id=%s""",
        valeurs_client(b) + [id],
    )
    return await db.query_one("SELECT * FROM clients WHERE id = %s", [id])


@router.delete("/{id}", dependencies=[Admin])
async def remove(id: int):
    """Supprime un client (les missions liées gardent client_id = NULL)."""
    async with db.transaction() as tx:
        if not await tx.query("SELECT id FROM clients WHERE id = %s FOR UPDATE", [id]):
            raise ErreurApi(404, "Client introuvable")
        await tx.execute("UPDATE missions SET client_id = NULL WHERE client_id = %s", [id])
        await tx.execute("DELETE FROM clients WHERE id = %s", [id])
    return {"message": "Client supprimé"}
