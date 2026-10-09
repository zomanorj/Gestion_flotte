# Routes clients — CRUD et historique des missions par client
from fastapi import Depends

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import Message, Page
from ..schemas.operations import Client, ClientSaisie, MissionsClient
from ..utils import Pagination, Routeur, ligne_ou_404

router = Routeur()

AGREGATS = """
    SELECT c.*,
      COUNT(m.id) AS nb_missions,
      IFNULL(SUM(m.cout_carburant), 0) AS chiffre_affaires
    FROM clients c
    LEFT JOIN missions m ON m.client_id = c.id
"""


@router.get("", dependencies=[Connecte], response_model=list[Client] | Page[Client], summary="Liste des clients")
async def get_all(pg: Pagination = Depends()):
    """Avec le nombre de missions de chaque client."""
    query = AGREGATS + " GROUP BY c.id ORDER BY c.nom ASC"
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM clients")
        rows = await db.query(query + " LIMIT %s OFFSET %s", [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])
    return await db.query(query)


@router.get("/{id}/missions", dependencies=[Connecte], response_model=MissionsClient,
            summary="Historique des missions d'un client")
async def get_missions(id: int):
    client = ligne_ou_404(await db.query_one("SELECT id, nom FROM clients WHERE id = %s", [id]), "Client introuvable")
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


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Client, summary="Ajouter un client")
async def create(donnees: ClientSaisie):
    champs = donnees.model_dump()
    new_id = await db.execute(
        f"INSERT INTO clients ({', '.join(champs)}) VALUES ({', '.join(['%s'] * len(champs))})",
        list(champs.values()),
    )
    return await db.query_one("SELECT * FROM clients WHERE id = %s", [new_id])


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Client, summary="Modifier un client")
async def update(id: int, donnees: ClientSaisie):
    """Les champs de fiche non envoyés (NIF, STAT, site web…) sont conservés."""
    ligne_ou_404(await db.query_one("SELECT id FROM clients WHERE id = %s", [id]), "Client introuvable")
    champs = donnees.champs_fournis()
    colonnes = ", ".join(f"{c} = %s" for c in champs)
    await db.execute(f"UPDATE clients SET {colonnes} WHERE id = %s", [*champs.values(), id])
    return await db.query_one("SELECT * FROM clients WHERE id = %s", [id])


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un client")
async def remove(id: int):
    """Les missions du client sont conservées, sans client associé."""
    async with db.transaction() as tx:
        ligne_ou_404(await tx.query_one("SELECT id FROM clients WHERE id = %s FOR UPDATE", [id]), "Client introuvable")
        await tx.execute("UPDATE missions SET client_id = NULL WHERE client_id = %s", [id])
        await tx.execute("DELETE FROM clients WHERE id = %s", [id])
    return {"message": "Client supprimé"}
