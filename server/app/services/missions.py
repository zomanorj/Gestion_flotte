# Règles métier des missions : disponibilité des ressources et cycle de vie du statut
#
# Disponibilité : un camion ou un chauffeur ne peut pas être affecté à deux missions actives
# (planifiée ou en cours) dont les périodes se chevauchent. Une mission en cours qui dépasse
# son retour prévu est considérée comme occupant la ressource jusqu'à maintenant.
#
# Concurrence : les fonctions de ce module s'exécutent dans une transaction et verrouillent
# (SELECT ... FOR UPDATE) le camion et le chauffeur concernés. Deux créations simultanées sur
# la même ressource sont donc sérialisées : la seconde voit la mission de la première.
from datetime import datetime

from ..db import Connexion
from ..erreurs import ErreurApi

STATUTS_ACTIFS = ("planifiee", "en_cours")

# Transitions autorisées : statut actuel → nouveaux statuts possibles
TRANSITIONS = {
    "planifiee": {"en_cours", "annulee"},
    "en_cours":  {"terminee", "annulee"},
    "terminee":  set(),
    "annulee":   set(),
}

LIBELLES_STATUT = {
    "planifiee": "planifiée", "en_cours": "en cours", "terminee": "terminée", "annulee": "annulée",
}

VEHICULE_INDISPONIBLE  = ("en_panne", "maintenance")
CHAUFFEUR_INDISPONIBLE = ("conge",)


def _periode(debut: datetime, fin: datetime) -> str:
    return f"du {debut:%d/%m/%Y %H:%M} au {fin:%d/%m/%Y %H:%M}"


async def _mission_en_conflit(tx: Connexion, colonne: str, ressource_id: int,
                              debut: datetime, fin: datetime, exclure_id: int | None) -> dict | None:
    """Première mission active de la ressource dont la période chevauche [debut, fin[."""
    return await tx.query_one(
        f"""SELECT id, titre, date_depart, date_retour_prevue
            FROM missions
            WHERE {colonne} = %s
              AND statut IN ('planifiee', 'en_cours')
              AND id <> %s
              AND date_depart < %s
              AND (CASE WHEN statut = 'en_cours' THEN GREATEST(date_retour_prevue, NOW())
                        ELSE date_retour_prevue END) > %s
            ORDER BY date_depart
            LIMIT 1""",
        [ressource_id, exclure_id or 0, fin, debut],
    )


async def verifier_disponibilite(tx: Connexion, vehicule_id, chauffeur_id,
                                 debut: datetime, fin: datetime, exclure_id: int | None = None) -> None:
    """Verrouille camion et chauffeur, puis lève 404/409 s'ils ne sont pas disponibles sur la période."""
    if fin <= debut:
        raise ErreurApi(400, "La date de retour prévue doit être postérieure à la date de départ")

    vehicule = await tx.query_one(
        "SELECT id, immatriculation, statut FROM vehicules WHERE id = %s FOR UPDATE", [vehicule_id]
    )
    if not vehicule:
        raise ErreurApi(404, "Camion introuvable")
    if vehicule["statut"] in VEHICULE_INDISPONIBLE:
        raise ErreurApi(409, f"Le camion n'est pas disponible (statut : {vehicule['statut']})")

    chauffeur = await tx.query_one(
        "SELECT id, nom, prenom, statut FROM chauffeurs WHERE id = %s FOR UPDATE", [chauffeur_id]
    )
    if not chauffeur:
        raise ErreurApi(404, "Chauffeur introuvable")
    if chauffeur["statut"] in CHAUFFEUR_INDISPONIBLE:
        raise ErreurApi(409, f"Le chauffeur n'est pas disponible (statut : {chauffeur['statut']})")

    conflit = await _mission_en_conflit(tx, "vehicule_id", vehicule["id"], debut, fin, exclure_id)
    if conflit:
        raise ErreurApi(
            409,
            f"Le camion {vehicule['immatriculation']} est déjà affecté à la mission « {conflit['titre']} » "
            f"{_periode(conflit['date_depart'], conflit['date_retour_prevue'])}",
        )

    conflit = await _mission_en_conflit(tx, "chauffeur_id", chauffeur["id"], debut, fin, exclure_id)
    if conflit:
        raise ErreurApi(
            409,
            f"Le chauffeur {chauffeur['prenom']} {chauffeur['nom']} est déjà affecté à la mission "
            f"« {conflit['titre']} » {_periode(conflit['date_depart'], conflit['date_retour_prevue'])}",
        )


def verifier_transition(actuel: str, nouveau: str) -> None:
    if nouveau not in TRANSITIONS.get(actuel, set()):
        raise ErreurApi(
            409,
            f"Impossible de passer une mission {LIBELLES_STATUT.get(actuel, actuel)} "
            f"à l'état {LIBELLES_STATUT.get(nouveau, nouveau)}",
        )


async def occuper_ressources(tx: Connexion, mission: dict) -> None:
    """Départ de mission : camion et chauffeur passent en mission (s'ils sont utilisables)."""
    vehicule = await tx.query_one("SELECT statut FROM vehicules WHERE id = %s FOR UPDATE", [mission["vehicule_id"]])
    if vehicule and vehicule["statut"] in VEHICULE_INDISPONIBLE:
        raise ErreurApi(409, f"Le camion n'est pas disponible (statut : {vehicule['statut']})")
    chauffeur = await tx.query_one("SELECT statut FROM chauffeurs WHERE id = %s FOR UPDATE", [mission["chauffeur_id"]])
    if chauffeur and chauffeur["statut"] in CHAUFFEUR_INDISPONIBLE:
        raise ErreurApi(409, f"Le chauffeur n'est pas disponible (statut : {chauffeur['statut']})")

    await tx.execute("UPDATE vehicules  SET statut = 'en_mission' WHERE id = %s", [mission["vehicule_id"]])
    await tx.execute("UPDATE chauffeurs SET statut = 'en_mission' WHERE id = %s", [mission["chauffeur_id"]])


async def liberer_ressources(tx: Connexion, mission: dict) -> None:
    """
    Fin ou annulation d'une mission en cours : camion et chauffeur redeviennent disponibles.
    Un statut posé manuellement entre-temps (panne, maintenance, congé) est conservé.
    """
    await tx.execute(
        "UPDATE vehicules  SET statut = 'disponible' WHERE id = %s AND statut = 'en_mission'",
        [mission["vehicule_id"]],
    )
    await tx.execute(
        "UPDATE chauffeurs SET statut = 'disponible' WHERE id = %s AND statut = 'en_mission'",
        [mission["chauffeur_id"]],
    )
