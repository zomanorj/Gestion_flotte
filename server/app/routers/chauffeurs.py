# Routes chauffeurs — CRUD et historique de missions
from typing import Annotated

from fastapi import Depends, Query

from .. import db
from ..auth import ROLES_GESTION, Admin, Connecte, Gestionnaire, verifier_token
from ..erreurs import ErreurApi
from ..schemas.commun import Message, Page, Vide
from ..schemas.enums import StatutChauffeur
from ..schemas.flotte import Chauffeur, ChauffeurCreation, ChauffeurDetail, ChauffeurMiseAJour, Mission
from ..utils import Pagination, Routeur, clause_set, ligne_ou_404

router = Routeur()

CHAMPS_SALAIRE = ("salaire_base", "prime_mission")


def masquer_salaire(chauffeur: dict, user: dict) -> dict:
    """La rémunération n'est visible que par la gestion, ou par le chauffeur pour sa propre fiche."""
    if user["role"] in ROLES_GESTION or chauffeur.get("user_id") == user["id"]:
        return chauffeur
    return {k: v for k, v in chauffeur.items() if k not in CHAMPS_SALAIRE}


@router.get("", response_model=list[Chauffeur] | Page[Chauffeur], summary="Liste des chauffeurs")
async def get_all(
    statut: Annotated[StatutChauffeur | None, Vide] = None,
    search: Annotated[str | None, Query(description="Nom, prénom ou numéro de permis")] = None,
    pg: Pagination = Depends(),
    user: dict = Depends(verifier_token),
):
    where, params = " WHERE 1=1", []
    if statut:
        where += " AND statut = %s"
        params.append(statut)
    if search:
        where += " AND (nom LIKE %s OR prenom LIKE %s OR numero_permis LIKE %s)"
        params += [f"%{search}%"] * 3

    query = "SELECT * FROM chauffeurs" + where + " ORDER BY nom ASC, prenom ASC"
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM chauffeurs" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse([masquer_salaire(r, user) for r in rows], count["total"])
    return [masquer_salaire(r, user) for r in await db.query(query, params)]


@router.get("/{id}", response_model=ChauffeurDetail, summary="Détail d'un chauffeur")
async def get_by_id(id: int, user: dict = Depends(verifier_token)):
    chauffeur = ligne_ou_404(await db.query_one("SELECT * FROM chauffeurs WHERE id = %s", [id]),
                             "Chauffeur introuvable")
    stats = await db.query_one("""
        SELECT
          COUNT(*) AS total_missions,
          SUM(distance_km) AS total_km,
          SUM(CASE WHEN statut = 'terminee' THEN 1 ELSE 0 END) AS missions_terminees
        FROM missions
        WHERE chauffeur_id = %s
    """, [id])
    return {**masquer_salaire(chauffeur, user), "stats": stats}


@router.get("/{id}/missions", dependencies=[Connecte], response_model=list[Mission],
            summary="Historique des missions d'un chauffeur")
async def get_missions(id: int):
    ligne_ou_404(await db.query_one("SELECT id FROM chauffeurs WHERE id = %s", [id]), "Chauffeur introuvable")
    return await db.query("""
        SELECT m.*, v.immatriculation, v.marque, v.modele
        FROM missions m
        JOIN vehicules v ON m.vehicule_id = v.id
        WHERE m.chauffeur_id = %s
        ORDER BY m.date_depart DESC
    """, [id])


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Chauffeur,
             summary="Ajouter un chauffeur")
async def create(donnees: ChauffeurCreation):
    if await db.query("SELECT id FROM chauffeurs WHERE numero_permis = %s", [donnees.numero_permis]):
        raise ErreurApi(409, "Ce numéro de permis est déjà enregistré")

    champs = donnees.model_dump()
    new_id = await db.execute(
        f"INSERT INTO chauffeurs ({', '.join(champs)}) VALUES ({', '.join(['%s'] * len(champs))})",
        list(champs.values()),
    )
    return await db.query_one("SELECT * FROM chauffeurs WHERE id = %s", [new_id])


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Chauffeur, summary="Modifier un chauffeur")
async def update(id: int, donnees: ChauffeurMiseAJour):
    """Seuls les champs envoyés sont modifiés."""
    ligne_ou_404(await db.query_one("SELECT id FROM chauffeurs WHERE id = %s", [id]), "Chauffeur introuvable")

    champs = donnees.champs_fournis()
    if "numero_permis" in champs and await db.query(
        "SELECT id FROM chauffeurs WHERE numero_permis = %s AND id != %s", [champs["numero_permis"], id]
    ):
        raise ErreurApi(409, "Ce numéro de permis est déjà enregistré")

    if champs:
        colonnes, valeurs = clause_set(champs)
        await db.execute(f"UPDATE chauffeurs SET {colonnes} WHERE id = %s", [*valeurs, id])
    return await db.query_one("SELECT * FROM chauffeurs WHERE id = %s", [id])


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un chauffeur")
async def remove(id: int):
    """Refusé si le chauffeur a des missions : le passer en congé à la place."""
    existant = ligne_ou_404(
        await db.query_one("SELECT id, nom, prenom FROM chauffeurs WHERE id = %s", [id]), "Chauffeur introuvable"
    )
    nom = f"{existant['prenom']} {existant['nom']}"
    stats = await db.query_one(
        """SELECT COUNT(*) AS nb, SUM(statut IN ('planifiee','en_cours')) AS actives
           FROM missions WHERE chauffeur_id = %s""",
        [id],
    )
    if (stats["actives"] or 0) > 0:
        raise ErreurApi(409, f"Impossible de supprimer : {nom} a des missions en cours ou planifiées")
    if stats["nb"] > 0:
        raise ErreurApi(
            409,
            f"Impossible de supprimer : {nom} a un historique de {stats['nb']} mission(s). "
            'Passez-le en statut "congé" à la place.',
        )

    await db.execute("DELETE FROM chauffeurs WHERE id = %s", [id])
    return {"message": "Chauffeur supprimé avec succès"}
