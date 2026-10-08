# Événements réalistes pouvant survenir durant une mission de transport à Madagascar
# Probabilités réduites + max 3 événements espacés sur le trajet
import random

EVENEMENTS = [
    {
        "id": "crevaison", "label": "Crevaison détectée",
        "description": "Le camion a une crevaison. Arrêt pour réparation sur le côté de la route.",
        "dureeMin": 25, "probabilite": 0.03, "type": "panne", "couleur": "red",
    },
    {
        "id": "carburant", "label": "Arrêt carburant",
        "description": "Le réservoir est bas. Arrêt à la station pour faire le plein.",
        "dureeMin": 15, "probabilite": 0.05, "type": "arret", "couleur": "yellow",
    },
    {
        "id": "gendarmerie", "label": "Contrôle gendarmerie",
        "description": "Contrôle de routine par la gendarmerie malgache. Vérification des documents du camion.",
        "dureeMin": 10, "probabilite": 0.04, "type": "controle", "couleur": "blue",
    },
    {
        "id": "pause_repas", "label": "Pause repas chauffeur",
        "description": "Le chauffeur s'arrête dans un hotely (restaurant local) pour manger.",
        "dureeMin": 30, "probabilite": 0.03, "type": "pause", "couleur": "green",
    },
    {
        "id": "route_degradee", "label": "Route dégradée",
        "description": "Tronçon de route en mauvais état. Le camion ralentit pour protéger la marchandise.",
        "dureeMin": 20, "probabilite": 0.04, "type": "ralentissement", "couleur": "orange",
    },
    {
        "id": "panne_moteur", "label": "Panne moteur",
        "description": "Défaillance mécanique. Le camion est immobilisé en attente du mécanicien.",
        "dureeMin": 60, "probabilite": 0.01, "type": "panne", "couleur": "red",
    },
    {
        "id": "verification_chargement", "label": "Vérification du chargement",
        "description": "Arrêt préventif pour vérifier l'arrimage et l'état de la marchandise.",
        "dureeMin": 10, "probabilite": 0.02, "type": "controle", "couleur": "purple",
    },
]


def generer_evenements(points: list) -> list[dict]:
    """
    Événements aléatoires pour un trajet :
    - au plus 3 événements
    - espacement minimum de 20 % du trajet entre deux événements
    """
    candidats = []
    nb_checkpoints = len(points) // 10
    espace_min = int(len(points) * 0.20)

    for i in range(1, nb_checkpoints):
        index_point = i * len(points) // nb_checkpoints
        for evt in EVENEMENTS:
            if random.random() < evt["probabilite"]:
                candidats.append({**evt, "indexPoint": index_point, "position": points[index_point], "declenche": False})

    # Tri par position sur le trajet
    candidats.sort(key=lambda e: e["indexPoint"])

    # Filtre les événements trop proches du précédent candidat, puis limite à 3
    espaces = [
        evt for i, evt in enumerate(candidats)
        if i == 0 or evt["indexPoint"] - candidats[i - 1]["indexPoint"] > espace_min
    ]
    return espaces[:3]
