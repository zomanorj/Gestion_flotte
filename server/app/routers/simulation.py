# Routes de simulation de mission en temps réel
from ..auth import Connecte, Gestionnaire
from ..exceptions import DonneesInvalides, Introuvable
from ..schemas.commun import Message
from ..schemas.pilotage import (
    ChangementVitesse,
    DemandeItineraire,
    EtatSimulation,
    Itineraire,
    SimulationDemarree,
    Villes,
    VitesseModifiee,
)
from ..services import missions as service_missions
from ..services import simulation as service
from ..services.route import VILLES_MADAGASCAR, VilleInconnue, get_route
from ..utils import Routeur

router = Routeur()


@router.get("/villes", dependencies=[Connecte], response_model=Villes, summary="Villes disponibles")
async def villes():
    return {"villes": list(VILLES_MADAGASCAR)}


@router.post("/route", dependencies=[Connecte], response_model=Itineraire, summary="Calculer un itinéraire")
async def calculer_route(donnees: DemandeItineraire):
    """Distance et durée par la route entre deux villes (ligne droite si le calcul est indisponible)."""
    try:
        route = await get_route(donnees.villeDepart, donnees.villeArrivee)
    except VilleInconnue as err:
        raise DonneesInvalides(str(err)) from None
    return {"distanceKm": round(route["distanceKm"]), "dureeMin": round(route["dureeMin"]),
            "totalPoints": len(route["points"])}


@router.post("/demarrer/{mission_id}", dependencies=[Gestionnaire], response_model=SimulationDemarree,
             summary="Démarrer la simulation d'une mission")
async def demarrer(mission_id: int):
    """Passe la mission planifiée en cours, puis lance la simulation GPS."""
    mission = await service_missions.demarrer_simulation(mission_id)
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


@router.post("/arreter/{mission_id}", dependencies=[Gestionnaire], response_model=Message,
             summary="Arrêter une simulation")
async def arreter(mission_id: str):
    """Stoppe la simulation sans modifier le statut de la mission."""
    service.arreter_simulation(mission_id)
    return {"message": "Simulation arrêtée"}


@router.post("/vitesse/{mission_id}", dependencies=[Gestionnaire], response_model=VitesseModifiee,
             summary="Changer la vitesse d'une simulation")
async def vitesse(mission_id: str, donnees: ChangementVitesse):
    multiplicateur = await service.changer_vitesse(mission_id, donnees.multiplicateur)
    if multiplicateur is None:
        raise Introuvable(f"Simulation {mission_id} introuvable")
    return {"message": "Vitesse mise à jour", "multiplicateur": multiplicateur}


@router.get("/actives", dependencies=[Connecte], response_model=list[EtatSimulation], summary="Simulations en cours")
async def actives():
    """État de toutes les simulations en cours (initialisation de la carte globale)."""
    return service.etats_actifs()
