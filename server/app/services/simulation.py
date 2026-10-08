# Moteur de simulation de mission en temps réel via Socket.io
# Supporte la vitesse variable (multiplicateur) et le broadcast global de flotte.
# Les simulations sont gardées en mémoire : elles sont perdues au redémarrage du serveur.
import asyncio

from ..socket import sio
from .evenement import generer_evenements
from .route import get_route

MULTIPLICATEURS = (1, 5, 10, 30, 60)

# { missionId: { route, evenements, indexActuel, enPause, multiplicateur, tache, mission, evenementActuel } }
simulations_actives: dict[str, dict] = {}

_tache_globale: asyncio.Task | None = None


def calculer_delai(route: dict, multiplicateur: int) -> float:
    """Délai (secondes) entre deux points GPS, basé sur ~60 km/h × multiplicateur."""
    distance_par_point = route["distanceKm"] / len(route["points"])
    ms_reel = distance_par_point / 60 * 3600 * 1000
    return max(50, round(ms_reel / multiplicateur)) / 1000


def calculer_pause_evenement(duree_min: int, multiplicateur: int) -> float:
    """Pause d'un événement : toujours visible (≥ 1 s) mais jamais bloquante (≤ 10 s)."""
    return max(1000, min(10000, round(duree_min * 1000 / multiplicateur))) / 1000


def etat_simulation(mission_id: str, sim: dict) -> dict | None:
    """État public d'une simulation (utilisé par flotte:positions et GET /simulation/actives)."""
    points = sim["route"]["points"]
    if sim["indexActuel"] >= len(points):
        return None
    mission = sim["mission"]
    return {
        "missionId":        mission_id,
        "position":         points[sim["indexActuel"]],
        "progression":      round(sim["indexActuel"] / len(points) * 100),
        "vitesse":          0 if sim["enPause"] else round(60 * sim["multiplicateur"] * 10) / 10,
        "multiplicateur":   sim["multiplicateur"],
        "enPause":          sim["enPause"],
        "evenementActuel":  sim["evenementActuel"],
        "immatriculation":  mission.get("immatriculation"),
        "chauffeur_nom":    mission.get("chauffeur_nom"),
        "titre":            mission.get("titre"),
        "lieu_depart":      mission.get("lieu_depart"),
        "lieu_destination": mission.get("lieu_destination"),
        "distanceKm":       sim["route"]["distanceKm"],
    }


def etats_actifs() -> list[dict]:
    return [e for mid, sim in list(simulations_actives.items()) if (e := etat_simulation(mid, sim))]


async def _broadcast_global():
    """Émet toutes les secondes les positions de tous les camions actifs ('flotte:positions')."""
    global _tache_globale
    try:
        while simulations_actives:
            positions = etats_actifs()
            if positions:
                await sio.emit("flotte:positions", positions)
            await asyncio.sleep(1)
    finally:
        _tache_globale = None


async def demarrer_simulation(mission_id: str, mission: dict) -> None:
    """Démarre la simulation d'une mission. Multiplicateur par défaut : x30."""
    global _tache_globale
    if mission_id in simulations_actives:
        print(f"[Sim] Mission {mission_id} déjà active")
        return

    try:
        route = await get_route(mission["lieu_depart"], mission["lieu_destination"])
        evenements = generer_evenements(route["points"])

        simulations_actives[mission_id] = {
            "route":           route,
            "evenements":      evenements,
            "indexActuel":     0,
            "enPause":         False,
            "multiplicateur":  30,
            "tache":           None,
            "mission": {
                k: mission.get(k)
                for k in ("titre", "immatriculation", "chauffeur_nom", "lieu_depart", "lieu_destination")
            },
            "evenementActuel": None,
        }

        # Données initiales pour le composant SimulationMission
        await sio.emit(f"mission:{mission_id}:debut", {
            "missionId":   mission_id,
            "route":       route["points"],
            "evenements":  [
                {k: e[k] for k in ("id", "label", "indexPoint", "couleur", "type", "dureeMin")}
                for e in evenements
            ],
            "distanceKm":     route["distanceKm"],
            "totalPoints":    len(route["points"]),
            "multiplicateur": 30,
        })

        _lancer_boucle(mission_id)

        # Lance le broadcast global si pas encore actif
        if _tache_globale is None:
            _tache_globale = asyncio.create_task(_broadcast_global())

    except Exception as err:
        print(f"[Sim] Erreur mission {mission_id} :", err)
        await sio.emit(f"mission:{mission_id}:erreur", {"message": str(err)})


def _lancer_boucle(mission_id: str) -> None:
    sim = simulations_actives.get(mission_id)
    if sim:
        sim["tache"] = asyncio.create_task(_avancer(mission_id))


async def _reprendre_apres(mission_id: str, secondes: float) -> None:
    await asyncio.sleep(secondes)
    sim = simulations_actives.get(mission_id)
    if sim:
        sim["enPause"] = False
        sim["evenementActuel"] = None
        await sio.emit(f"mission:{mission_id}:reprise", {"missionId": mission_id})


async def _avancer(mission_id: str) -> None:
    """Boucle principale : avance le camion d'un point GPS à chaque intervalle."""
    sim = simulations_actives.get(mission_id)
    if not sim:
        return
    delai = calculer_delai(sim["route"], sim["multiplicateur"])

    while True:
        await asyncio.sleep(delai)
        sim = simulations_actives.get(mission_id)
        if not sim:
            return
        if sim["enPause"]:
            continue

        route, index = sim["route"], sim["indexActuel"]
        points = route["points"]

        # Arrivée à destination
        if index >= len(points) - 1:
            simulations_actives.pop(mission_id, None)
            await sio.emit(f"mission:{mission_id}:termine", {
                "missionId":         mission_id,
                "message":           f"Arrivée à {route['villeArrivee']} !",
                "distanceParcourue": route["distanceKm"],
            })
            return

        position = points[index]
        await sio.emit(f"mission:{mission_id}:position", {
            "missionId":   mission_id,
            "position":    position,
            "indexActuel": index,
            "progression": round(index / len(points) * 100),
            "totalPoints": len(points),
        })

        # Détection d'événement
        evenement = next((e for e in sim["evenements"] if e["indexPoint"] == index and not e["declenche"]), None)
        if evenement:
            evenement["declenche"] = True
            sim["enPause"] = True
            sim["evenementActuel"] = {k: evenement[k] for k in ("id", "label", "type", "couleur")}

            await sio.emit(f"mission:{mission_id}:evenement", {
                "missionId": mission_id,
                "evenement": {
                    **{k: evenement[k] for k in ("id", "label", "description", "dureeMin", "type", "couleur")},
                    "position": position,
                },
            })
            pause = calculer_pause_evenement(evenement["dureeMin"], sim["multiplicateur"])
            asyncio.create_task(_reprendre_apres(mission_id, pause))

        sim["indexActuel"] += 1


async def changer_vitesse(mission_id: str, multiplicateur) -> int | None:
    """
    Change la vitesse d'une simulation en cours (relance la boucle avec le nouveau délai).
    Retourne le multiplicateur appliqué, ou None si la simulation n'existe pas.
    """
    sim = simulations_actives.get(mission_id)
    if not sim:
        return None

    try:
        mult = int(float(multiplicateur))
    except (TypeError, ValueError):
        mult = 30
    if mult not in MULTIPLICATEURS:
        mult = 30

    if sim["tache"]:
        sim["tache"].cancel()
    sim["multiplicateur"] = mult

    await sio.emit(f"mission:{mission_id}:vitesse", {"missionId": mission_id, "multiplicateur": mult})
    _lancer_boucle(mission_id)
    return mult


def arreter_simulation(mission_id: str) -> None:
    """Arrête une simulation et nettoie la mémoire (le broadcast global s'arrête tout seul)."""
    sim = simulations_actives.pop(mission_id, None)
    if sim:
        if sim["tache"]:
            sim["tache"].cancel()
        print(f"[Sim] Mission {mission_id} arrêtée")
