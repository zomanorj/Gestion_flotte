# Service de calcul de route via OSRM (OpenStreetMap Routing Machine)
# Pas de clé API requise — serveur public OSRM basé sur OpenStreetMap
import math

import httpx

# Coordonnées GPS des principales villes de Madagascar
VILLES_MADAGASCAR = {
    "Antananarivo": {"lat": -18.9136, "lng": 47.5362},
    "Toamasina":    {"lat": -18.1492, "lng": 49.4023},
    "Antsirabe":    {"lat": -19.8659, "lng": 47.0333},
    "Fianarantsoa": {"lat": -21.4538, "lng": 47.0855},
    "Mahajanga":    {"lat": -15.7167, "lng": 46.3167},
    "Toliara":      {"lat": -23.3568, "lng": 43.6917},
    "Antsiranana":  {"lat": -12.2795, "lng": 49.2913},
    "Moramanga":    {"lat": -18.9333, "lng": 48.2167},
    "Ambositra":    {"lat": -20.5333, "lng": 47.2500},
    "Manakara":     {"lat": -22.1333, "lng": 48.0167},
}

# Serveur OSRM public — profil voiture
OSRM_URL = "http://router.project-osrm.org/route/v1/driving"

# Nombre cible de points après décimation — compromis précision/performance Socket.io
POINTS_CIBLE = 300


class VilleInconnue(ValueError):
    pass


def decimer_points(points: list, n: int) -> list:
    """Garde exactement n points répartis uniformément (premier et dernier inclus)."""
    if len(points) <= n:
        return points
    pas = (len(points) - 1) / (n - 1)
    # round() Python arrondit au pair : floor(x + 0.5) reproduit Math.round
    return [points[math.floor(i * pas + 0.5)] for i in range(n)]


async def get_route(ville_depart: str, ville_arrivee: str) -> dict:
    """
    Tracé réel des routes entre deux villes via OSRM, décimé à ~300 points.
    Bascule sur un fallback ligne droite uniquement si OSRM est inaccessible.
    Retourne { points, distanceKm, dureeMin, villeDepart, villeArrivee }.
    """
    depart = VILLES_MADAGASCAR.get(ville_depart)
    arrivee = VILLES_MADAGASCAR.get(ville_arrivee)
    if not depart or not arrivee:
        raise VilleInconnue(f'Ville inconnue : "{ville_depart}" ou "{ville_arrivee}"')

    print(f"[OSRM] Calcul route : {ville_depart} → {ville_arrivee}")

    try:
        # OSRM attend les coordonnées sous la forme lng,lat;lng,lat
        url = f"{OSRM_URL}/{depart['lng']},{depart['lat']};{arrivee['lng']},{arrivee['lat']}"
        async with httpx.AsyncClient(timeout=10) as client:
            reponse = await client.get(url, params={"overview": "full", "geometries": "geojson"})
        data = reponse.json()

        if data.get("code") != "Ok" or not data.get("routes"):
            raise RuntimeError(f"Réponse OSRM invalide : {data.get('code')}")

        route = data["routes"][0]
        leg = route["legs"][0]

        # [lng, lat] → { lat, lng } pour Leaflet + décimation
        tous_points = [{"lat": c[1], "lng": c[0]} for c in route["geometry"]["coordinates"]]
        points = decimer_points(tous_points, POINTS_CIBLE)

        print(f"[OSRM] Succès : {len(tous_points)} pts bruts → {len(points)} pts, {leg['distance'] / 1000:.1f} km")
        return {
            "points":       points,
            "distanceKm":   leg["distance"] / 1000,
            "dureeMin":     leg["duration"] / 60,
            "villeDepart":  ville_depart,
            "villeArrivee": ville_arrivee,
        }
    except Exception as err:
        print("[OSRM] Erreur :", err)
        print("[OSRM] Bascule sur fallback ligne droite")
        return route_ligne_droite(depart, arrivee, ville_depart, ville_arrivee)


def route_ligne_droite(depart: dict, arrivee: dict, nom_depart: str, nom_arrivee: str) -> dict:
    """Tracé de remplacement : ligne droite de 51 points, ~60 km/h."""
    nb_points = 50
    points = [
        {
            "lat": depart["lat"] + (arrivee["lat"] - depart["lat"]) * i / nb_points,
            "lng": depart["lng"] + (arrivee["lng"] - depart["lng"]) * i / nb_points,
        }
        for i in range(nb_points + 1)
    ]
    distance = calculer_distance(depart, arrivee)
    return {
        "points":       points,
        "distanceKm":   distance,
        "dureeMin":     distance,  # à 60 km/h : 1 km ≈ 1 min
        "villeDepart":  nom_depart,
        "villeArrivee": nom_arrivee,
    }


def calculer_distance(p1: dict, p2: dict) -> float:
    """Distance orthodromique (formule Haversine) en kilomètres."""
    r = 6371
    d_lat = math.radians(p2["lat"] - p1["lat"])
    d_lng = math.radians(p2["lng"] - p1["lng"])
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(p1["lat"])) * math.cos(math.radians(p2["lat"])) * math.sin(d_lng / 2) ** 2)
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
