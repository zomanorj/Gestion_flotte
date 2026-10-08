# Routes de simulation de mission en temps réel
from fastapi import APIRouter, Request

from .. import db
from ..auth import Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..services.route import VILLES_MADAGASCAR, VilleInconnue, get_route
from ..services.simulation import arreter_simulation, changer_vitesse, demarrer_simulation, etats_actifs
from ..utils import corps

router = APIRouter()


@router.get("/villes", dependencies=[Connecte])
async def villes():
    """Liste des villes disponibles pour les selects du formulaire."""
    return {"villes": list(VILLES_MADAGASCAR)}


@router.post("/route", dependencies=[Connecte])
async def calculer_route(request: Request):
    """Distance et durée réelles entre deux villes. Body : { villeDepart, villeArrivee }"""
    b = await corps(request)
    try:
        route = await get_route(b.get("villeDepart"), b.get("villeArrivee"))
    except VilleInconnue as err:
        raise ErreurApi(400, str(err))
    return {
        "distanceKm":  round(route["distanceKm"]),
        "dureeMin":    round(route["dureeMin"]),
        "totalPoints": len(route["points"]),
    }


@router.post("/demarrer/{mission_id}", dependencies=[Gestionnaire])
async def demarrer(mission_id: int):
    """Passe une mission planifiée en "en_cours" puis lance la boucle de simulation."""
    mission = await db.query_one(
        """SELECT m.*, c.nom AS chauffeur_nom,
                  v.immatriculation, v.statut AS vehicule_statut
           FROM missions m
           JOIN chauffeurs c ON m.chauffeur_id = c.id
           JOIN vehicules  v ON m.vehicule_id  = v.id
           WHERE m.id = %s""",
        [mission_id],
    )
    if not mission:
        raise ErreurApi(404, "Mission introuvable")

    if mission["statut"] != "planifiee":
        raise ErreurApi(409, f'Impossible de simuler une mission au statut "{mission["statut"]}"')

    await db.execute("UPDATE missions   SET statut = 'en_cours'   WHERE id = %s", [mission_id])
    await db.execute("UPDATE vehicules  SET statut = 'en_mission' WHERE id = %s", [mission["vehicule_id"]])
    await db.execute("UPDATE chauffeurs SET statut = 'en_mission' WHERE id = %s", [mission["chauffeur_id"]])

    await demarrer_simulation(str(mission_id), mission)

    return {
        "message": "Simulation démarrée",
        "mission": {
            "id":          mission["id"],
            "titre":       mission["titre"],
            "camion":      mission["immatriculation"],
            "chauffeur":   mission["chauffeur_nom"],
            "depart":      mission["lieu_depart"],
            "destination": mission["lieu_destination"],
        },
    }


@router.post("/arreter/{mission_id}", dependencies=[Gestionnaire])
async def arreter(mission_id: str):
    """Stoppe une simulation en cours sans modifier le statut en base."""
    arreter_simulation(mission_id)
    return {"message": "Simulation arrêtée"}


@router.post("/vitesse/{mission_id}", dependencies=[Gestionnaire])
async def vitesse(mission_id: str, request: Request):
    """Change le multiplicateur d'une simulation en cours. Body : { multiplicateur: 1 | 5 | 10 | 30 | 60 }"""
    mult = await changer_vitesse(mission_id, (await corps(request)).get("multiplicateur"))
    if mult is None:
        raise ErreurApi(404, f"Simulation {mission_id} introuvable")
    return {"message": "Vitesse mise à jour", "multiplicateur": mult}


@router.get("/actives", dependencies=[Connecte])
async def actives():
    """État actuel de toutes les simulations en cours (initialisation de CarteGlobale)."""
    return etats_actifs()
