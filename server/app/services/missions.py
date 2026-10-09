# Règles métier : missions (disponibilité des ressources, cycle de vie, coût, planning)
#
# Disponibilité : un camion ou un chauffeur ne peut pas être affecté à deux missions actives
# (planifiée ou en cours) dont les périodes se chevauchent. Une mission en cours qui dépasse
# son retour prévu est considérée comme occupant la ressource jusqu'à maintenant.
#
# Concurrence : les écritures se font en transaction et verrouillent (SELECT ... FOR UPDATE) la
# mission, le camion et le chauffeur concernés. Deux créations simultanées sur la même ressource
# sont donc sérialisées : la seconde voit la mission de la première.
from datetime import datetime

from .. import db
from ..db import Executeur
from ..exceptions import Conflit, Introuvable, trouve
from ..pdf.bon_livraison import generer_bon_livraison
from ..repositories import chauffeurs as depot_chauffeurs
from ..repositories import missions as depot
from ..repositories import operations as depot_operations
from ..repositories import vehicules as depot_vehicules
from ..repositories.base import Plage, Resultat
from ..schemas.flotte import MissionCreation
from ..socket import sio
from . import parametres, simulation

INTROUVABLE = "Mission introuvable"

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

COULEURS_PLANNING = {
    "planifiee": "#f59e0b",
    "en_cours":  "#3b82f6",
    "terminee":  "#22c55e",
    "annulee":   "#9ca3af",
}


# ── Règles pures ───────────────────────────────────────────────────────────────

def cout_carburant(distance_km: float | None, consommation_litre_km: float | None, prix_litre: float,
                   consommation_par_defaut: float) -> float:
    """
    Distance × consommation × prix au litre, en Ariary, arrondi au centime. La consommation par
    défaut sert si le camion n'en a pas.
    """
    return round((distance_km or 0) * (consommation_litre_km or consommation_par_defaut) * prix_litre, 2)


def verifier_transition(actuel: str, nouveau: str) -> None:
    if nouveau not in TRANSITIONS.get(actuel, set()):
        raise Conflit(
            f"Impossible de passer une mission {LIBELLES_STATUT.get(actuel, actuel)} "
            f"à l'état {LIBELLES_STATUT.get(nouveau, nouveau)}"
        )


def evenement_planning(m: dict) -> dict:
    """Mission (avec immatriculation, marque et nom du chauffeur) au format FullCalendar."""
    return {
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


def _periode(debut: datetime, fin: datetime) -> str:
    return f"du {debut:%d/%m/%Y %H:%M} au {fin:%d/%m/%Y %H:%M}"


# ── Ressources (dans une transaction) ──────────────────────────────────────────

async def verifier_disponibilite(tx: Executeur, vehicule_id: int, chauffeur_id: int,
                                 debut: datetime, fin: datetime, exclure_id: int | None = None) -> None:
    """Verrouille camion et chauffeur, puis lève une erreur s'ils ne sont pas disponibles sur la période."""
    if fin <= debut:
        raise Conflit("La date de retour prévue doit être postérieure à la date de départ")

    vehicule = trouve(await depot_vehicules.obtenir(vehicule_id, tx, verrou=True), "Camion introuvable")
    if vehicule["statut"] in VEHICULE_INDISPONIBLE:
        raise Conflit(f"Le camion n'est pas disponible (statut : {vehicule['statut']})")

    chauffeur = trouve(await depot_chauffeurs.obtenir(chauffeur_id, tx, verrou=True), "Chauffeur introuvable")
    if chauffeur["statut"] in CHAUFFEUR_INDISPONIBLE:
        raise Conflit(f"Le chauffeur n'est pas disponible (statut : {chauffeur['statut']})")

    conflit = await depot.premiere_en_conflit(tx, "vehicule_id", vehicule_id, debut, fin, exclure_id)
    if conflit:
        raise Conflit(
            f"Le camion {vehicule['immatriculation']} est déjà affecté à la mission « {conflit['titre']} » "
            f"{_periode(conflit['date_depart'], conflit['date_retour_prevue'])}"
        )

    conflit = await depot.premiere_en_conflit(tx, "chauffeur_id", chauffeur_id, debut, fin, exclure_id)
    if conflit:
        raise Conflit(
            f"Le chauffeur {chauffeur['prenom']} {chauffeur['nom']} est déjà affecté à la mission "
            f"« {conflit['titre']} » {_periode(conflit['date_depart'], conflit['date_retour_prevue'])}"
        )


async def occuper_ressources(tx: Executeur, mission: dict) -> None:
    """Départ de mission : camion et chauffeur passent en mission (s'ils sont utilisables)."""
    vehicule = await depot_vehicules.obtenir(mission["vehicule_id"], tx, verrou=True)
    if vehicule and vehicule["statut"] in VEHICULE_INDISPONIBLE:
        raise Conflit(f"Le camion n'est pas disponible (statut : {vehicule['statut']})")
    chauffeur = await depot_chauffeurs.obtenir(mission["chauffeur_id"], tx, verrou=True)
    if chauffeur and chauffeur["statut"] in CHAUFFEUR_INDISPONIBLE:
        raise Conflit(f"Le chauffeur n'est pas disponible (statut : {chauffeur['statut']})")

    await depot_vehicules.definir_statut(mission["vehicule_id"], "en_mission", tx)
    await depot_chauffeurs.definir_statut(mission["chauffeur_id"], "en_mission", tx)


async def liberer_ressources(tx: Executeur, mission: dict) -> None:
    """
    Fin ou annulation d'une mission en cours : camion et chauffeur redeviennent disponibles.
    Un statut posé manuellement entre-temps (panne, maintenance, congé) est conservé.
    """
    await depot_vehicules.definir_statut(mission["vehicule_id"], "disponible", tx, seulement_si="en_mission")
    await depot_chauffeurs.definir_statut(mission["chauffeur_id"], "disponible", tx, seulement_si="en_mission")


# ── Opérations ─────────────────────────────────────────────────────────────────

async def lister(statut: str | None, debut, fin, plage: Plage | None) -> Resultat:
    return await depot.lister(statut, debut, fin, plage)


async def planning() -> list[dict]:
    return [evenement_planning(m) for m in await depot.pour_planning()]


async def bon_de_livraison(id: int) -> tuple[bytes, str]:
    """(contenu PDF, nom de fichier)."""
    mission = trouve(await depot.pour_bon_livraison(id), INTROUVABLE)
    return generer_bon_livraison(mission), f"bon-livraison-{mission['id']}.pdf"


async def creer(donnees: MissionCreation) -> dict:
    """Mission planifiée ; ressources vérifiées et verrouillées dans la même transaction."""
    async with db.transaction() as tx:
        await verifier_disponibilite(tx, donnees.vehicule_id, donnees.chauffeur_id,
                                     donnees.date_depart, donnees.date_retour_prevue)
        if donnees.client_id and not await depot_operations.obtenir_client(donnees.client_id, tx):
            raise Introuvable("Client introuvable")
        nouvel_id = await depot.creer(
            {**donnees.model_dump(), "distance_km": donnees.distance_km or 0, "statut": "planifiee"}, tx
        )

    # Émis après le commit : les autres clients rechargent des données déjà visibles
    await sio.emit("mission:nouvelle", {"id": nouvel_id, "titre": donnees.titre})
    return await depot.resume(nouvel_id)


async def changer_statut(id: int, statut: str) -> dict:
    """
    Cycle de vie : planifiee → en_cours | annulee, en_cours → terminee | annulee.
    Synchronise camion + chauffeur et calcule le coût carburant à la clôture.
    """
    async with db.transaction() as tx:
        mission = trouve(await depot.obtenir(id, tx, verrou=True), INTROUVABLE)
        verifier_transition(mission["statut"], statut)

        if statut == "terminee":
            vehicule = await depot_vehicules.obtenir(mission["vehicule_id"], tx)
            p = await parametres.actuels()
            cout = cout_carburant(mission["distance_km"], (vehicule or {}).get("consommation_litre_km"),
                                  p.prix_litre_gasoil, p.consommation_par_defaut)
            await depot.cloturer(id, cout, tx)
        else:
            await depot.modifier(id, {"statut": statut}, tx)

        if statut == "en_cours":
            await occuper_ressources(tx, mission)
        elif mission["statut"] == "en_cours":
            # terminee / annulee depuis en_cours : les ressources étaient occupées
            await liberer_ressources(tx, mission)

    if statut != "en_cours":
        simulation.arreter_simulation(str(id))
    await sio.emit("mission:statut", {"id": id, "statut": statut})
    return await depot.resume(id)


async def supprimer(id: int) -> None:
    """Une mission en cours libère son camion et son chauffeur, et sa simulation est arrêtée."""
    async with db.transaction() as tx:
        mission = trouve(await depot.obtenir(id, tx, verrou=True), INTROUVABLE)
        if mission["statut"] == "en_cours":
            await liberer_ressources(tx, mission)
        await depot.supprimer(id, tx)
    simulation.arreter_simulation(str(id))


async def demarrer_simulation(id: int) -> dict:
    """Passe la mission planifiée en cours, puis lance sa simulation GPS. Retourne la mission."""
    async with db.transaction() as tx:
        # Verrou sur la mission : deux démarrages simultanés ne peuvent pas réussir tous les deux
        mission = trouve(await depot.pour_simulation(id, tx), INTROUVABLE)
        verifier_transition(mission["statut"], "en_cours")
        await depot.modifier(id, {"statut": "en_cours"}, tx)
        await occuper_ressources(tx, mission)

    # Comme pour un changement de statut manuel : les écrans des autres utilisateurs se mettent à jour
    await sio.emit("mission:statut", {"id": id, "statut": "en_cours"})
    await simulation.demarrer_simulation(str(id), mission)
    return mission
