# Indicateurs du tableau de bord
import asyncio

from ..repositories import tableau_de_bord as depot


def semaines_numerotees(lignes: list[dict]) -> list[dict]:
    """Missions par semaine, libellées « Sem 1 » à « Sem n » de la plus ancienne à la plus récente."""
    return [{"semaine": f"Sem {i + 1}", "count": ligne["count"]} for i, ligne in enumerate(lignes)]


async def indicateurs() -> dict:
    """Toutes les métriques du tableau de bord ; les requêtes indépendantes partent en parallèle."""
    vehicules, missions, alertes, documents, par_semaine, dernieres, en_mission = await asyncio.gather(
        depot.compteurs_vehicules(),
        depot.compteurs_missions(),
        depot.nombre_alertes_non_lues(),
        depot.nombre_documents_a_renouveler(),
        depot.missions_par_semaine(),
        depot.dernieres_alertes(),
        depot.vehicules_en_mission(),
    )
    # SUM() renvoie NULL sur une table vide : 0 par défaut
    compteurs = {cle: valeur or 0 for cle, valeur in {**vehicules, **missions}.items()}
    return {
        **compteurs,
        "alertesMaintenance":      alertes,
        "documentsExpires":        documents,
        "missionsParSemaine":      semaines_numerotees(par_semaine),
        "dernieresAlertes":        dernieres,
        "vehiculesEnMissionCarte": en_mission,
    }
