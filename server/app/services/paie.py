# Règles métier : paie mensuelle des chauffeurs
#
# Salaire brut = salaire de base + prime par mission terminée dans le mois
#                + bonus kilométrique par tranche complète au-delà d'un seuil.
# Net à payer  = brut − cotisation salariale CNAPS (taux en %).
# Une mission compte pour le mois de son retour réel. Le barème (défauts, seuil, tranche,
# bonus, taux) est un paramètre métier modifiable par l'administrateur (services/parametres.py).
#
# Limite connue : un mois passé est recalculé avec le barème en vigueur aujourd'hui (les mois
# ne sont pas encore clôturés).
from ..exceptions import AccesRefuse, trouve
from ..pdf.bulletin_paie import generer_bulletin_pdf
from ..repositories import chauffeurs as depot_chauffeurs
from ..repositories import missions as depot_missions
from ..schemas.pilotage import SalaireSaisie
from . import parametres
from .chauffeurs import peut_voir_remuneration
from .parametres import Parametres

INTROUVABLE = "Chauffeur introuvable"


def calculer_remuneration(salaire_base: float | None, prime_mission: float | None,
                          distances_km: list[float], bareme: Parametres) -> dict:
    """Calcul de paie d'un mois à partir des distances des missions terminées."""
    salaire_base = salaire_base or bareme.salaire_base_defaut
    prime_mission = prime_mission or bareme.prime_mission_defaut
    nb_missions = len(distances_km)
    total_km = sum(d or 0 for d in distances_km)
    total_primes = nb_missions * prime_mission
    km_bonus = (int((total_km - bareme.seuil_bonus_km) // bareme.tranche_bonus_km) * bareme.bonus_par_tranche
                if total_km > bareme.seuil_bonus_km else 0)
    total_brut = salaire_base + total_primes + km_bonus
    cnaps = round(total_brut * bareme.taux_cnaps / 100)
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
    bareme = await parametres.actuels()
    calcul = calculer_remuneration(chauffeur["salaire_base"], chauffeur["prime_mission"],
                                   [m["distance_km"] for m in missions], bareme)
    return {
        "chauffeur": {
            **{k: chauffeur[k] for k in ("id", "nom", "prenom", "telephone", "numero_permis", "categorie_permis")},
            "salaire_base":  calcul["salaire_base"],
            "prime_mission": chauffeur["prime_mission"] or bareme.prime_mission_defaut,
        },
        "periode": {"annee": annee, "mois": mois},
        "missions": missions,
        "calcul": calcul,
    }


async def masse_salariale(annee: int, mois: int) -> dict:
    """Résumé du mois pour tous les chauffeurs (deux requêtes au total, quel que soit leur nombre)."""
    chauffeurs = await depot_chauffeurs.tous_pour_paie()
    distances = await depot_missions.distances_terminees_du_mois(annee, mois)
    bareme = await parametres.actuels()

    fiches = []
    for c in chauffeurs:
        calcul = calculer_remuneration(c["salaire_base"], c["prime_mission"], distances.get(c["id"], []), bareme)
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
