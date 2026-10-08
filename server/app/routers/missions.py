# Routes missions — création, suivi, workflow de statuts, planning et bon de livraison
from fastapi import APIRouter, Request
from fastapi.responses import Response

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..services.bon_livraison import generer_bon_livraison
from ..services.simulation import arreter_simulation
from ..socket import sio
from ..utils import Pagination, corps, ou_none

router = APIRouter()

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


@router.get("/planning", dependencies=[Connecte])
async def get_planning():
    """
    Missions formatées pour FullCalendar.
    Couleur selon le statut : planifiée=jaune, en_cours=bleu, terminée=vert, annulée=gris.
    """
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


@router.get("", dependencies=[Connecte])
async def get_all(request: Request, statut: str | None = None, debut: str | None = None, fin: str | None = None):
    """Toutes les missions avec infos véhicule et chauffeur. ?statut=&debut=&fin="""
    where, params = " WHERE 1=1", []
    if statut:
        where += " AND m.statut = %s"
        params.append(statut)
    if debut:
        where += " AND m.date_depart >= %s"
        params.append(debut)
    if fin:
        where += " AND m.date_depart <= %s"
        params.append(fin + " 23:59:59")

    query = """
        SELECT
          m.*,
          v.immatriculation, v.marque, v.modele,
          c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom, c.telephone AS chauffeur_tel
        FROM missions m
        JOIN vehicules  v ON m.vehicule_id  = v.id
        JOIN chauffeurs c ON m.chauffeur_id = c.id
    """ + where + " ORDER BY m.date_depart DESC"

    pg = Pagination(request)
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM missions m" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])

    return await db.query(query, params)


@router.get("/{id}/bon-livraison", dependencies=[Connecte])
async def bon_livraison(id: int):
    """Génère et télécharge le bon de livraison PDF de la mission."""
    mission = await db.query_one("""
        SELECT m.*,
          v.immatriculation, v.marque, v.modele,
          ch.nom AS chauffeur_nom, ch.prenom AS chauffeur_prenom, ch.numero_permis,
          cl.nom AS client_nom, cl.contact_nom AS client_contact, cl.telephone AS client_tel
        FROM missions m
        JOIN vehicules  v  ON m.vehicule_id  = v.id
        JOIN chauffeurs ch ON m.chauffeur_id = ch.id
        LEFT JOIN clients cl ON m.client_id  = cl.id
        WHERE m.id = %s
    """, [id])
    if not mission:
        raise ErreurApi(404, "Mission introuvable")

    return Response(
        content=generer_bon_livraison(mission),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=bon-livraison-{mission['id']}.pdf"},
    )


@router.post("", status_code=201, dependencies=[Gestionnaire])
async def create(request: Request):
    """Crée une nouvelle mission après vérification de la disponibilité du véhicule et du chauffeur."""
    b = await corps(request)
    requis = ("titre", "vehicule_id", "chauffeur_id", "lieu_depart", "lieu_destination",
              "date_depart", "date_retour_prevue")
    if not all(b.get(k) for k in requis):
        raise ErreurApi(400, "Champs obligatoires manquants")

    vehicule = await db.query_one("SELECT id, statut FROM vehicules WHERE id = %s", [b["vehicule_id"]])
    if not vehicule:
        raise ErreurApi(404, "Camion introuvable")
    if vehicule["statut"] != "disponible":
        raise ErreurApi(409, f"Le camion n'est pas disponible (statut : {vehicule['statut']})")

    chauffeur = await db.query_one("SELECT id, statut FROM chauffeurs WHERE id = %s", [b["chauffeur_id"]])
    if not chauffeur:
        raise ErreurApi(404, "Chauffeur introuvable")
    if chauffeur["statut"] != "disponible":
        raise ErreurApi(409, f"Le chauffeur n'est pas disponible (statut : {chauffeur['statut']})")

    new_id = await db.execute(
        """INSERT INTO missions
             (titre, vehicule_id, chauffeur_id, lieu_depart, lieu_destination,
              distance_km, date_depart, date_retour_prevue, notes, poids_charge, statut)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'planifiee')""",
        [
            b["titre"], b["vehicule_id"], b["chauffeur_id"], b["lieu_depart"], b["lieu_destination"],
            b.get("distance_km") or 0, b["date_depart"], b["date_retour_prevue"],
            ou_none(b.get("notes")), ou_none(b.get("poids_charge")),
        ],
    )

    # Notifier via Socket.io les autres clients connectés
    await sio.emit("mission:nouvelle", {"id": new_id, "titre": b["titre"]})

    return await db.query_one(SELECT_MISSION_RESUME, [new_id])


@router.put("/{id}/statut", dependencies=[Gestionnaire])
async def update_statut(id: int, request: Request):
    """
    Met à jour le statut d'une mission et synchronise véhicule + chauffeur.
    Calcule le coût carburant lors de la clôture.
    """
    statut = (await corps(request)).get("statut")
    statuts_valides = ["en_cours", "terminee", "annulee"]
    if not statut or statut not in statuts_valides:
        raise ErreurApi(400, f"Statut invalide. Valeurs acceptées : {', '.join(statuts_valides)}")

    mission = await db.query_one("SELECT * FROM missions WHERE id = %s", [id])
    if not mission:
        raise ErreurApi(404, "Mission introuvable")

    update_mission, params_mission = "UPDATE missions SET statut = %s", [statut]

    if statut == "en_cours":
        statut_ressources = "en_mission"
    else:
        # terminee ou annulee : camion et chauffeur redeviennent disponibles
        statut_ressources = "disponible"

    if statut == "terminee":
        # Calcul du coût carburant : distance × consommation × prix/litre
        vehicule = await db.query_one(
            "SELECT consommation_litre_km FROM vehicules WHERE id = %s", [mission["vehicule_id"]]
        )
        consommation = (vehicule or {}).get("consommation_litre_km") or 0.08
        cout_carburant = round((mission["distance_km"] or 0) * consommation * PRIX_LITRE_ARIARY, 2)
        update_mission += ", date_retour_reelle = NOW(), cout_carburant = %s"
        params_mission.append(cout_carburant)

    await db.execute(update_mission + " WHERE id = %s", params_mission + [id])
    await db.execute("UPDATE vehicules SET statut = %s WHERE id = %s", [statut_ressources, mission["vehicule_id"]])
    await db.execute("UPDATE chauffeurs SET statut = %s WHERE id = %s", [statut_ressources, mission["chauffeur_id"]])

    # Événement temps réel
    await sio.emit("mission:statut", {"id": id, "statut": statut})

    return await db.query_one(SELECT_MISSION_RESUME, [id])


@router.delete("/{id}", dependencies=[Admin])
async def remove(id: int):
    """
    Supprime une mission quel que soit son statut.
    Si la mission est en cours : remet camion + chauffeur à "disponible"
    et arrête la simulation si elle est active.
    """
    mission = await db.query_one("SELECT * FROM missions WHERE id = %s", [id])
    if not mission:
        raise ErreurApi(404, "Mission introuvable")

    if mission["statut"] == "en_cours":
        await db.execute("UPDATE vehicules  SET statut = 'disponible' WHERE id = %s", [mission["vehicule_id"]])
        await db.execute("UPDATE chauffeurs SET statut = 'disponible' WHERE id = %s", [mission["chauffeur_id"]])
        arreter_simulation(str(id))

    await db.execute("DELETE FROM missions WHERE id = %s", [id])
    return {"message": "Mission supprimée"}
