# Routes de simulation de mission en temps réel
from .. import db
from ..auth import Connecte, Gestionnaire
from ..erreurs import ErreurApi
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
from ..services.missions import occuper_ressources, verifier_transition
from ..services.route import VILLES_MADAGASCAR, VilleInconnue, get_route
from ..services.simulation import arreter_simulation, changer_vitesse, demarrer_simulation, etats_actifs
from ..utils import Routeur, ligne_ou_404

router = Routeur()


@router.get("/villes", dependencies=[Connecte], response_model=Villes, summary="Villes disponibles")
async def villes():
    """Liste des villes disponibles pour les selects du formulaire."""
    return {"villes": list(VILLES_MADAGASCAR)}


@router.post("/route", dependencies=[Connecte], response_model=Itineraire, summary="Calculer un itinéraire")
async def calculer_route(donnees: DemandeItineraire):
    """Distance et durée par la route entre deux villes (ligne droite si le calcul est indisponible)."""
    try:
        route = await get_route(donnees.villeDepart, donnees.villeArrivee)
    except VilleInconnue as err:
        raise ErreurApi(400, str(err)) from None
    return {
        "distanceKm":  round(route["distanceKm"]),
        "dureeMin":    round(route["dureeMin"]),
        "totalPoints": len(route["points"]),
    }


@router.post("/demarrer/{mission_id}", dependencies=[Gestionnaire], response_model=SimulationDemarree,
             summary="Démarrer la simulation d'une mission")
async def demarrer(mission_id: int):
    """Passe une mission planifiée en "en_cours" puis lance la boucle de simulation."""
    async with db.transaction() as tx:
        # FOR UPDATE sur la mission : deux démarrages simultanés ne peuvent pas réussir tous les deux
        mission = await tx.query_one(
            """SELECT m.*, c.nom AS chauffeur_nom, v.immatriculation
               FROM missions m
               JOIN chauffeurs c ON m.chauffeur_id = c.id
               JOIN vehicules  v ON m.vehicule_id  = v.id
               WHERE m.id = %s
               FOR UPDATE""",
            [mission_id],
        )
        ligne_ou_404(mission, "Mission introuvable")
        verifier_transition(mission["statut"], "en_cours")

        await tx.execute("UPDATE missions SET statut = 'en_cours' WHERE id = %s", [mission_id])
        await occuper_ressources(tx, mission)

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


@router.post("/arreter/{mission_id}", dependencies=[Gestionnaire], response_model=Message,
             summary="Arrêter une simulation")
async def arreter(mission_id: str):
    """Stoppe une simulation en cours sans modifier le statut en base."""
    arreter_simulation(mission_id)
    return {"message": "Simulation arrêtée"}


@router.post("/vitesse/{mission_id}", dependencies=[Gestionnaire], response_model=VitesseModifiee,
             summary="Changer la vitesse d'une simulation")
async def vitesse(mission_id: str, donnees: ChangementVitesse):
    mult = await changer_vitesse(mission_id, donnees.multiplicateur)
    if mult is None:
        raise ErreurApi(404, f"Simulation {mission_id} introuvable")
    return {"message": "Vitesse mise à jour", "multiplicateur": mult}


@router.get("/actives", dependencies=[Connecte], response_model=list[EtatSimulation],
            summary="Simulations en cours")
async def actives():
    """État actuel de toutes les simulations en cours (initialisation de CarteGlobale)."""
    return etats_actifs()
