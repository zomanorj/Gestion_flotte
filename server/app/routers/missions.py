# Routes missions — création, suivi, workflow de statuts, planning et bon de livraison
from datetime import date
from typing import Annotated

from fastapi import Depends, Query
from fastapi.responses import Response

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..schemas.commun import Message, Page, Vide
from ..schemas.enums import StatutMission
from ..schemas.flotte import ChangementStatutMission, EvenementPlanning, Mission, MissionCreation
from ..services.bon_livraison import generer_bon_livraison
from ..services.missions import liberer_ressources, occuper_ressources, verifier_disponibilite, verifier_transition
from ..services.simulation import arreter_simulation
from ..socket import sio
from ..utils import Pagination, Routeur, ligne_ou_404

router = Routeur()

# Prix du carburant en Ariary par litre (données marché Madagascar 2024)
PRIX_LITRE_ARIARY = 5200

COULEURS_PLANNING = {
    "planifiee": "#f59e0b",
    "en_cours":  "#3b82f6",
    "terminee":  "#22c55e",
    "annulee":   "#9ca3af",
}

SELECT_MISSION_RESUME = """
    SELECT m.*, v.immatriculation, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
    FROM missions m
    JOIN vehicules v ON m.vehicule_id = v.id
    JOIN chauffeurs c ON m.chauffeur_id = c.id
    WHERE m.id = %s
"""


@router.get("/planning", dependencies=[Connecte], response_model=list[EvenementPlanning],
            summary="Missions au format calendrier")
async def get_planning():
    """Format FullCalendar ; couleur selon le statut (planifiée, en cours, terminée, annulée)."""
    rows = await db.query("""
        SELECT m.*, v.immatriculation, v.marque,
          c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM missions m
        JOIN vehicules  v ON m.vehicule_id  = v.id
        JOIN chauffeurs c ON m.chauffeur_id = c.id
        ORDER BY m.date_depart ASC
    """)
    return [
        {
            "id":    m["id"],
            "title": f"{m['immatriculation']} — {m['titre']}",
            "start": m["date_depart"],
            "end":   m["date_retour_prevue"],
            "color": COULEURS_PLANNING.get(m["statut"], "#9ca3af"),
            "extendedProps": {
                "statut":           m["statut"],
                "chauffeur":        f"{m['chauffeur_prenom']} {m['chauffeur_nom']}",
                "vehicule":         f"{m['immatriculation']} {m['marque']}",
                "lieu_depart":      m["lieu_depart"],
                "lieu_destination": m["lieu_destination"],
                "distance_km":      m["distance_km"],
                "poids_charge":     m["poids_charge"],
            },
        }
        for m in rows
    ]


@router.get("", dependencies=[Connecte], response_model=list[Mission] | Page[Mission], summary="Liste des missions")
async def get_all(
    statut: Annotated[StatutMission | None, Vide] = None,
    debut: Annotated[date | None, Vide, Query(description="Départ à partir de cette date")] = None,
    fin: Annotated[date | None, Vide, Query(description="Départ jusqu'à cette date incluse")] = None,
    pg: Pagination = Depends(),
):
    where, params = " WHERE 1=1", []
    if statut:
        where += " AND m.statut = %s"
        params.append(statut)
    if debut:
        where += " AND m.date_depart >= %s"
        params.append(debut)
    if fin:
        where += " AND m.date_depart < DATE_ADD(%s, INTERVAL 1 DAY)"
        params.append(fin)

    query = """
        SELECT
          m.*,
          v.immatriculation, v.marque, v.modele,
          c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom, c.telephone AS chauffeur_tel
        FROM missions m
        JOIN vehicules  v ON m.vehicule_id  = v.id
        JOIN chauffeurs c ON m.chauffeur_id = c.id
    """ + where + " ORDER BY m.date_depart DESC"

    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM missions m" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])
    return await db.query(query, params)


@router.get("/{id}/bon-livraison", dependencies=[Connecte], response_class=Response, summary="Bon de livraison PDF",
            responses={200: {"content": {"application/pdf": {}}, "description": "Fichier PDF"}})
async def bon_livraison(id: int):
    mission = ligne_ou_404(await db.query_one("""
        SELECT m.*,
          v.immatriculation, v.marque, v.modele,
          ch.nom AS chauffeur_nom, ch.prenom AS chauffeur_prenom, ch.numero_permis,
          cl.nom AS client_nom, cl.contact_nom AS client_contact, cl.telephone AS client_tel
        FROM missions m
        JOIN vehicules  v  ON m.vehicule_id  = v.id
        JOIN chauffeurs ch ON m.chauffeur_id = ch.id
        LEFT JOIN clients cl ON m.client_id  = cl.id
        WHERE m.id = %s
    """, [id]), "Mission introuvable")

    return Response(
        content=generer_bon_livraison(mission),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=bon-livraison-{mission['id']}.pdf"},
    )


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Mission, summary="Planifier une mission")
async def create(donnees: MissionCreation):
    """
    Le camion et le chauffeur ne doivent avoir aucune autre mission active sur la même période
    (vérifié en transaction, ressources verrouillées).
    """
    async with db.transaction() as tx:
        await verifier_disponibilite(tx, donnees.vehicule_id, donnees.chauffeur_id,
                                     donnees.date_depart, donnees.date_retour_prevue)
        if donnees.client_id and not await tx.query_one("SELECT id FROM clients WHERE id = %s", [donnees.client_id]):
            raise ErreurApi(404, "Client introuvable")

        new_id = await tx.execute(
            """INSERT INTO missions
                 (titre, vehicule_id, chauffeur_id, client_id, lieu_depart, lieu_destination,
                  distance_km, date_depart, date_retour_prevue, notes, poids_charge, statut)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'planifiee')""",
            [
                donnees.titre, donnees.vehicule_id, donnees.chauffeur_id, donnees.client_id,
                donnees.lieu_depart, donnees.lieu_destination, donnees.distance_km or 0,
                donnees.date_depart, donnees.date_retour_prevue, donnees.notes, donnees.poids_charge,
            ],
        )

    # Émis après le commit : les autres clients rechargent des données déjà visibles
    await sio.emit("mission:nouvelle", {"id": new_id, "titre": donnees.titre})
    return await db.query_one(SELECT_MISSION_RESUME, [new_id])


@router.put("/{id}/statut", dependencies=[Gestionnaire], response_model=Mission, summary="Changer le statut")
async def update_statut(id: int, donnees: ChangementStatutMission):
    """
    Cycle de vie : planifiee → en_cours | annulee, en_cours → terminee | annulee.
    Synchronise camion + chauffeur et calcule le coût carburant à la clôture.
    """
    statut = donnees.statut
    async with db.transaction() as tx:
        mission = ligne_ou_404(await tx.query_one("SELECT * FROM missions WHERE id = %s FOR UPDATE", [id]),
                               "Mission introuvable")
        verifier_transition(mission["statut"], statut)

        update_mission, params_mission = "UPDATE missions SET statut = %s", [statut]

        if statut == "terminee":
            # Coût carburant : distance × consommation × prix/litre
            vehicule = await tx.query_one(
                "SELECT consommation_litre_km FROM vehicules WHERE id = %s", [mission["vehicule_id"]]
            )
            consommation = (vehicule or {}).get("consommation_litre_km") or 0.08
            cout_carburant = round((mission["distance_km"] or 0) * consommation * PRIX_LITRE_ARIARY, 2)
            update_mission += ", date_retour_reelle = NOW(), cout_carburant = %s"
            params_mission.append(cout_carburant)

        await tx.execute(update_mission + " WHERE id = %s", params_mission + [id])

        if statut == "en_cours":
            await occuper_ressources(tx, mission)
        elif mission["statut"] == "en_cours":
            # terminee / annulee depuis en_cours : les ressources étaient occupées
            await liberer_ressources(tx, mission)

    if statut != "en_cours":
        arreter_simulation(str(id))

    await sio.emit("mission:statut", {"id": id, "statut": statut})
    return await db.query_one(SELECT_MISSION_RESUME, [id])


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer une mission")
async def remove(id: int):
    """Une mission en cours libère son camion et son chauffeur, et sa simulation est arrêtée."""
    async with db.transaction() as tx:
        mission = ligne_ou_404(await tx.query_one("SELECT * FROM missions WHERE id = %s FOR UPDATE", [id]),
                               "Mission introuvable")
        if mission["statut"] == "en_cours":
            await liberer_ressources(tx, mission)
        await tx.execute("DELETE FROM missions WHERE id = %s", [id])

    arreter_simulation(str(id))
    return {"message": "Mission supprimée"}
