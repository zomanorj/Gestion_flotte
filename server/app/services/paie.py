# Règles métier : paie mensuelle des chauffeurs
#
# Salaire brut = salaire de base + prime par mission terminée dans le mois
#                + bonus kilométrique de 20 000 Ar par tranche de 500 km au-delà de 500 km.
# Net à payer  = brut − cotisation salariale CNAPS de 1 % (simplifiée).
# Une mission compte pour le mois de son retour réel.
from ..exceptions import AccesRefuse, trouve
from ..pdf.bulletin_paie import generer_bulletin_pdf
from ..repositories import chauffeurs as depot_chauffeurs
from ..repositories import missions as depot_missions
from ..schemas.pilotage import SalaireSaisie
from .chauffeurs import peut_voir_remuneration

SALAIRE_BASE_DEFAUT = 800000
PRIME_MISSION_DEFAUT = 50000
SEUIL_BONUS_KM = 500
TRANCHE_BONUS_KM = 500
BONUS_PAR_TRANCHE = 20000
TAUX_CNAPS = 0.01

INTROUVABLE = "Chauffeur introuvable"


def calculer_remuneration(salaire_base: float | None, prime_mission: float | None,
                          distances_km: list[float]) -> dict:
    """Calcul de paie d'un mois à partir des distances des missions terminées."""
    salaire_base = salaire_base or SALAIRE_BASE_DEFAUT
    prime_mission = prime_mission or PRIME_MISSION_DEFAUT
    nb_missions = len(distances_km)
    total_km = sum(d or 0 for d in distances_km)
    total_primes = nb_missions * prime_mission
    km_bonus = (int((total_km - SEUIL_BONUS_KM) // TRANCHE_BONUS_KM) * BONUS_PAR_TRANCHE
                if total_km > SEUIL_BONUS_KM else 0)
    total_brut = salaire_base + total_primes + km_bonus
    cnaps = round(total_brut * TAUX_CNAPS)
    return {
        "nb_missions":  nb_missions,
        "total_km":     round(total_km),
        "salaire_base": salaire_base,
        "total_primes": total_primes,
        "km_bonus":     km_bonus,
        "total_brut":   total_brut,
        "cnaps":        cnaps,
        "net_a_payer":  total_brut - cnaps,
    }


async def fiche(chauffeur_id: int, annee: int, mois: int) -> dict:
    """Fiche de paie détaillée d'un chauffeur pour un mois (1–12)."""
    chauffeur = trouve(await depot_chauffeurs.obtenir(chauffeur_id), INTROUVABLE)
    missions = await depot_missions.terminees_du_mois(chauffeur_id, annee, mois)
    calcul = calculer_remuneration(chauffeur["salaire_base"], chauffeur["prime_mission"],
                                   [m["distance_km"] for m in missions])
    return {
        "chauffeur": {
            **{k: chauffeur[k] for k in ("id", "nom", "prenom", "telephone", "numero_permis", "categorie_permis")},
            "salaire_base":  calcul["salaire_base"],
            "prime_mission": chauffeur["prime_mission"] or PRIME_MISSION_DEFAUT,
        },
        "periode": {"annee": annee, "mois": mois},
        "missions": missions,
        "calcul": calcul,
    }


async def masse_salariale(annee: int, mois: int) -> dict:
    """Résumé du mois pour tous les chauffeurs (deux requêtes au total, quel que soit leur nombre)."""
    chauffeurs = await depot_chauffeurs.tous_pour_paie()
    distances = await depot_missions.distances_terminees_du_mois(annee, mois)

    fiches = []
    for c in chauffeurs:
        calcul = calculer_remuneration(c["salaire_base"], c["prime_mission"], distances.get(c["id"], []))
        fiches.append({
            "chauffeur_id": c["id"], "nom": c["nom"], "prenom": c["prenom"],
            **{k: calcul[k] for k in ("nb_missions", "total_km", "salaire_base", "total_primes", "km_bonus",
                                      "net_a_payer")},
        })
    return {
        "fiches":          fiches,
        "masse_salariale": sum(f["net_a_payer"] for f in fiches),
        "nb_missions":     sum(f["nb_missions"] for f in fiches),
        "annee":           annee,
        "mois":            mois,
    }


async def bulletin_pdf(chauffeur_id: int, annee: int, mois: int, user: dict) -> tuple[bytes, str]:
    """(contenu PDF, nom de fichier) : gestion, ou le chauffeur lui-même pour son propre bulletin."""
    # Réponse identique pour une fiche inexistante ou appartenant à un autre : on ne révèle rien
    if not peut_voir_remuneration({"user_id": await depot_chauffeurs.proprietaire(chauffeur_id)}, user):
        raise AccesRefuse("Accès refusé : ce bulletin ne vous appartient pas")
    contenu = await fiche(chauffeur_id, annee, mois)
    return generer_bulletin_pdf(contenu), f"bulletin_{contenu['chauffeur']['nom']}_{mois}_{annee}.pdf"


async def modifier_salaire(chauffeur_id: int, donnees: SalaireSaisie) -> dict:
    trouve(await depot_chauffeurs.obtenir(chauffeur_id), INTROUVABLE)
    await depot_chauffeurs.modifier(chauffeur_id, donnees.champs_fournis())
    return await depot_chauffeurs.salaire(chauffeur_id)
