# Règles métier : chauffeurs (et confidentialité de leur rémunération)
from ..auth import ROLES_GESTION
from ..exceptions import Conflit, trouve
from ..repositories import chauffeurs as depot
from ..repositories import missions as depot_missions
from ..repositories.base import Plage, Resultat
from ..schemas.flotte import ChauffeurCreation, ChauffeurMiseAJour
from . import parametres

INTROUVABLE = "Chauffeur introuvable"
CHAMPS_SALAIRE = ("salaire_base", "prime_mission")


def peut_voir_remuneration(chauffeur: dict, user: dict) -> bool:
    """La rémunération est visible par la gestion, ou par le chauffeur pour sa propre fiche."""
    return user["role"] in ROLES_GESTION or (chauffeur.get("user_id") is not None
                                             and chauffeur.get("user_id") == user["id"])


def masquer_salaire(chauffeur: dict, user: dict) -> dict:
    if peut_voir_remuneration(chauffeur, user):
        return chauffeur
    return {k: v for k, v in chauffeur.items() if k not in CHAMPS_SALAIRE}


async def lister(statut: str | None, recherche: str | None, plage: Plage | None, user: dict) -> Resultat:
    resultat = await depot.lister(statut, recherche, plage)
    resultat.lignes = [masquer_salaire(c, user) for c in resultat.lignes]
    return resultat


async def detail(id: int, user: dict) -> dict:
    chauffeur = trouve(await depot.obtenir(id), INTROUVABLE)
    return {**masquer_salaire(chauffeur, user), "stats": await depot_missions.statistiques_chauffeur(id)}


async def missions(id: int) -> list[dict]:
    trouve(await depot.obtenir(id), INTROUVABLE)
    return await depot_missions.du_chauffeur(id)


async def _verifier_permis_libre(numero_permis: str, sauf_id: int | None = None) -> None:
    if await depot.id_par_permis(numero_permis, sauf_id):
        raise Conflit("Ce numéro de permis est déjà enregistré")


async def creer(donnees: ChauffeurCreation) -> dict:
    await _verifier_permis_libre(donnees.numero_permis)
    p = await parametres.actuels()
    remuneration = {"salaire_base": p.salaire_base_defaut, "prime_mission": p.prime_mission_defaut}
    return await depot.obtenir(await depot.creer({**donnees.model_dump(), **remuneration}))


async def modifier(id: int, donnees: ChauffeurMiseAJour) -> dict:
    """Seuls les champs envoyés sont modifiés."""
    trouve(await depot.obtenir(id), INTROUVABLE)
    champs = donnees.champs_fournis()
    if "numero_permis" in champs:
        await _verifier_permis_libre(champs["numero_permis"], sauf_id=id)
    await depot.modifier(id, champs)
    return await depot.obtenir(id)


async def supprimer(id: int) -> None:
    """Refusé si le chauffeur a des missions : le passer en congé à la place."""
    chauffeur = trouve(await depot.obtenir(id), INTROUVABLE)
    nom = f"{chauffeur['prenom']} {chauffeur['nom']}"
    usage = await depot_missions.nombre_par_ressource("chauffeur_id", id)
    if usage["actives"]:
        raise Conflit(f"Impossible de supprimer : {nom} a des missions en cours ou planifiées")
    if usage["nb"]:
        raise Conflit(
            f"Impossible de supprimer : {nom} a un historique de {usage['nb']} mission(s). "
            'Passez-le en statut "congé" à la place.'
        )
    await depot.supprimer(id)
