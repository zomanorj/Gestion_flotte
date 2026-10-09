# Règles métier : véhicules
from ..exceptions import Conflit, Introuvable, trouve
from ..repositories import missions as depot_missions
from ..repositories import vehicules as depot
from ..repositories.base import Plage, Resultat
from ..schemas.flotte import VehiculeCreation, VehiculeMiseAJour

INTROUVABLE = "Camion introuvable"


async def lister(statut: str | None, recherche: str | None, plage: Plage | None) -> Resultat:
    return await depot.lister(statut, recherche, plage)


async def alertes() -> list[dict]:
    return await depot.alertes()


async def detail(id: int) -> dict:
    """Camion avec ses 5 dernières missions et son historique de maintenance."""
    vehicule = trouve(await depot.obtenir(id), "Véhicule introuvable")
    return {
        **vehicule,
        "missions": await depot_missions.recentes_du_vehicule(id),
        "maintenances": await depot.maintenances_effectuees(id),
    }


async def _verifier_immatriculation_libre(immatriculation: str, sauf_id: int | None = None) -> None:
    if await depot.id_par_immatriculation(immatriculation, sauf_id):
        raise Conflit("Cette immatriculation existe déjà")


async def creer(donnees: VehiculeCreation) -> dict:
    champs = {**donnees.model_dump(), "immatriculation": donnees.immatriculation.upper()}
    await _verifier_immatriculation_libre(champs["immatriculation"])
    return await depot.obtenir(await depot.creer(champs))


async def modifier(id: int, donnees: VehiculeMiseAJour) -> dict:
    """Seuls les champs envoyés sont modifiés ; un champ facultatif envoyé vide est effacé."""
    trouve(await depot.obtenir(id), INTROUVABLE)
    champs = donnees.champs_fournis()
    if "immatriculation" in champs:
        champs["immatriculation"] = champs["immatriculation"].upper()
        await _verifier_immatriculation_libre(champs["immatriculation"], sauf_id=id)
    await depot.modifier(id, champs)
    return await depot.obtenir(id)


async def supprimer(id: int) -> None:
    """Refusé si le camion a des missions, même terminées : l'historique doit être conservé."""
    immatriculation = trouve(await depot.obtenir(id), INTROUVABLE)["immatriculation"]
    usage = await depot_missions.nombre_par_ressource("vehicule_id", id)
    if usage["actives"]:
        raise Conflit(f"Impossible de supprimer : le camion {immatriculation} a des missions en cours ou planifiées")
    if usage["nb"]:
        raise Conflit(
            f"Impossible de supprimer : le camion {immatriculation} a un historique de {usage['nb']} mission(s). "
            "Modifiez son statut à la place."
        )
    await depot.supprimer(id)


async def verifier_existe(id: int) -> None:
    if not await depot.existe(id):
        raise Introuvable("Véhicule introuvable")
