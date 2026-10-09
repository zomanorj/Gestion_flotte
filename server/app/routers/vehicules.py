# Routes camions — CRUD et alertes de maintenance
from typing import Annotated

from fastapi import Depends, Query

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..schemas.commun import Message, Page, Vide
from ..schemas.enums import StatutVehicule
from ..schemas.flotte import Vehicule, VehiculeAlerte, VehiculeCreation, VehiculeDetail, VehiculeMiseAJour
from ..utils import Pagination, Routeur, clause_set, ligne_ou_404

router = Routeur()


@router.get("", dependencies=[Connecte], response_model=list[Vehicule] | Page[Vehicule], summary="Liste des camions")
async def get_all(
    statut: Annotated[StatutVehicule | None, Vide] = None,
    search: Annotated[str | None, Query(description="Immatriculation, marque ou modèle")] = None,
    pg: Pagination = Depends(),
):
    where, params = " WHERE 1=1", []
    if statut:
        where += " AND statut = %s"
        params.append(statut)
    if search:
        where += " AND (immatriculation LIKE %s OR marque LIKE %s OR modele LIKE %s)"
        params += [f"%{search}%"] * 3

    query = "SELECT * FROM vehicules" + where + " ORDER BY created_at DESC"
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM vehicules" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])
    return await db.query(query, params)


@router.get("/alertes", dependencies=[Connecte], response_model=list[VehiculeAlerte],
            summary="Camions nécessitant une attention")
async def get_alertes():
    """Contrôle technique dans moins de 30 jours, ou plus de 10 000 km depuis la dernière vidange."""
    return await db.query("""
        SELECT
          v.*,
          DATEDIFF(v.date_prochain_ct, CURDATE()) AS jours_avant_ct,
          (v.kilometrage - IFNULL(
            (SELECT m.kilometrage_au_moment
             FROM maintenances m
             WHERE m.vehicule_id = v.id AND m.type = 'Vidange'
             ORDER BY m.date_maintenance DESC LIMIT 1), 0
          )) AS km_depuis_vidange
        FROM vehicules v
        WHERE
          (v.date_prochain_ct IS NOT NULL AND v.date_prochain_ct <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
          OR
          (v.kilometrage - IFNULL(
            (SELECT m2.kilometrage_au_moment
             FROM maintenances m2
             WHERE m2.vehicule_id = v.id AND m2.type = 'Vidange'
             ORDER BY m2.date_maintenance DESC LIMIT 1), 0
          ) > 10000)
        ORDER BY v.date_prochain_ct ASC
    """)


@router.get("/{id}", dependencies=[Connecte], response_model=VehiculeDetail, summary="Détail d'un camion")
async def get_by_id(id: int):
    """Camion avec ses 5 dernières missions et son historique de maintenance."""
    vehicule = ligne_ou_404(await db.query_one("SELECT * FROM vehicules WHERE id = %s", [id]), "Véhicule introuvable")

    missions = await db.query("""
        SELECT m.*, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM missions m
        JOIN chauffeurs c ON m.chauffeur_id = c.id
        WHERE m.vehicule_id = %s
        ORDER BY m.date_depart DESC
        LIMIT 5
    """, [id])
    maintenances = await db.query(
        "SELECT * FROM maintenances WHERE vehicule_id = %s ORDER BY date_maintenance DESC", [id]
    )
    return {**vehicule, "missions": missions, "maintenances": maintenances}


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Vehicule, summary="Ajouter un camion")
async def create(donnees: VehiculeCreation):
    champs = donnees.model_dump()
    champs["immatriculation"] = champs["immatriculation"].upper()

    if await db.query("SELECT id FROM vehicules WHERE immatriculation = %s", [champs["immatriculation"]]):
        raise ErreurApi(409, "Cette immatriculation existe déjà")

    colonnes = ", ".join(champs)
    new_id = await db.execute(
        f"INSERT INTO vehicules ({colonnes}) VALUES ({', '.join(['%s'] * len(champs))})", list(champs.values())
    )
    return await db.query_one("SELECT * FROM vehicules WHERE id = %s", [new_id])


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Vehicule, summary="Modifier un camion")
async def update(id: int, donnees: VehiculeMiseAJour):
    """Seuls les champs envoyés sont modifiés ; un champ facultatif envoyé vide est effacé."""
    ligne_ou_404(await db.query_one("SELECT id FROM vehicules WHERE id = %s", [id]), "Camion introuvable")

    champs = donnees.champs_fournis()
    if "immatriculation" in champs:
        champs["immatriculation"] = champs["immatriculation"].upper()
        if await db.query("SELECT id FROM vehicules WHERE immatriculation = %s AND id != %s",
                          [champs["immatriculation"], id]):
            raise ErreurApi(409, "Cette immatriculation existe déjà")

    if champs:
        colonnes, valeurs = clause_set(champs)
        await db.execute(f"UPDATE vehicules SET {colonnes} WHERE id = %s", [*valeurs, id])
    return await db.query_one("SELECT * FROM vehicules WHERE id = %s", [id])


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un camion")
async def remove(id: int):
    """Refusé si le camion a des missions, même terminées : l'historique doit être conservé."""
    existant = ligne_ou_404(
        await db.query_one("SELECT id, immatriculation FROM vehicules WHERE id = %s", [id]), "Camion introuvable"
    )
    stats = await db.query_one(
        """SELECT COUNT(*) AS nb, SUM(statut IN ('planifiee','en_cours')) AS actives
           FROM missions WHERE vehicule_id = %s""",
        [id],
    )
    immat = existant["immatriculation"]
    if (stats["actives"] or 0) > 0:
        raise ErreurApi(409, f"Impossible de supprimer : le camion {immat} a des missions en cours ou planifiées")
    if stats["nb"] > 0:
        raise ErreurApi(
            409,
            f"Impossible de supprimer : le camion {immat} a un historique de {stats['nb']} mission(s). "
            "Modifiez son statut à la place.",
        )

    await db.execute("DELETE FROM vehicules WHERE id = %s", [id])
    return {"message": "Camion supprimé avec succès"}
