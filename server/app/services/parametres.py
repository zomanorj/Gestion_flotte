# Paramètres métier modifiables par l'administrateur
#
# Chaque paramètre est défini ici (libellé, unité, valeur par défaut, bornes). La base ne stocke
# que les valeurs modifiées, avec l'historique de chaque changement. Les services lisent les
# valeurs en vigueur avec `await actuels()` (cache de quelques secondes, invalidé à chaque
# modification dans ce processus).
#
# Ajouter un paramètre : un champ dans `Parametres` et sa `Definition` dans DEFINITIONS (un test
# vérifie que les deux correspondent). Aucune migration n'est nécessaire.
import time
from dataclasses import dataclass

from .. import db
from ..exceptions import DonneesInvalides, Introuvable
from ..repositories import parametres as depot

DUREE_CACHE_SECONDES = 30


@dataclass(frozen=True)
class Parametres:
    """Valeurs en vigueur (défauts, remplacés par les valeurs modifiées par l'administrateur)."""

    prix_litre_gasoil: float
    consommation_par_defaut: float
    salaire_base_defaut: float
    prime_mission_defaut: float
    seuil_bonus_km: int
    tranche_bonus_km: int
    bonus_par_tranche: float
    taux_cnaps: float
    jours_alerte_documents: int
    jours_alerte_controle_technique: int
    km_alerte_vidange: int
    jours_alerte_maintenances: int

    @classmethod
    def par_defaut(cls) -> "Parametres":
        return cls(**{cle: d.defaut for cle, d in DEFINITIONS.items()})


@dataclass(frozen=True)
class Definition:
    libelle: str
    description: str
    categorie: str
    unite: str
    defaut: float
    minimum: float
    maximum: float
    entier: bool = False

    def convertir(self, valeur: float) -> float | int:
        return int(valeur) if self.entier else float(valeur)


DEFINITIONS: dict[str, Definition] = {
    "prix_litre_gasoil": Definition(
        "Prix du gasoil", "Prix au litre utilisé pour le coût carburant des missions terminées.",
        "Missions", "Ar / L", 5200, 1, 100000),
    "consommation_par_defaut": Definition(
        "Consommation par défaut", "Consommation proposée pour un nouveau camion, et utilisée si un camion "
        "n'en a pas.", "Missions", "L / km", 0.30, 0.01, 5),
    "salaire_base_defaut": Definition(
        "Salaire de base par défaut", "Salaire mensuel attribué à un nouveau chauffeur.",
        "Paie", "Ar / mois", 800000, 0, 100000000),
    "prime_mission_defaut": Definition(
        "Prime par mission par défaut", "Prime attribuée à un nouveau chauffeur pour chaque mission terminée.",
        "Paie", "Ar", 50000, 0, 10000000),
    "seuil_bonus_km": Definition(
        "Seuil du bonus kilométrique", "Kilométrage mensuel à partir duquel le bonus est calculé.",
        "Paie", "km", 500, 0, 100000, entier=True),
    "tranche_bonus_km": Definition(
        "Tranche du bonus kilométrique", "Chaque tranche complète au-delà du seuil donne droit au bonus.",
        "Paie", "km", 500, 1, 100000, entier=True),
    "bonus_par_tranche": Definition(
        "Bonus par tranche", "Montant versé pour chaque tranche complète au-delà du seuil.",
        "Paie", "Ar", 20000, 0, 10000000),
    "taux_cnaps": Definition(
        "Cotisation CNAPS salariale", "Retenue sur le salaire brut.", "Paie", "%", 1, 0, 20),
    "jours_alerte_documents": Definition(
        "Alerte documents", "Un document est signalé quand il expire dans ce nombre de jours ou moins.",
        "Alertes", "jours", 30, 1, 365, entier=True),
    "jours_alerte_controle_technique": Definition(
        "Alerte contrôle technique", "Un camion est signalé quand son contrôle technique arrive dans ce délai.",
        "Alertes", "jours", 30, 1, 365, entier=True),
    "km_alerte_vidange": Definition(
        "Alerte vidange", "Un camion est signalé au-delà de ce kilométrage depuis sa dernière vidange.",
        "Alertes", "km", 10000, 500, 100000, entier=True),
    "jours_alerte_maintenances": Definition(
        "Alerte maintenances", "Une maintenance planifiée est signalée quand elle est prévue dans ce délai.",
        "Alertes", "jours", 7, 1, 90, entier=True),
}

_cache: tuple[Parametres, float] | None = None


def _texte(valeur: float | int) -> str:
    """Représentation stockée en base : entier sans décimale, sinon la forme la plus courte."""
    return str(int(valeur)) if float(valeur).is_integer() else repr(float(valeur))


def _depuis_texte(cle: str, texte: str) -> float | int:
    """Valeur stockée relue ; une valeur devenue invalide (bornes changées) revient au défaut."""
    definition = DEFINITIONS[cle]
    try:
        valeur = definition.convertir(float(texte))
    except ValueError:
        return definition.defaut
    return valeur if definition.minimum <= valeur <= definition.maximum else definition.defaut


def composer(modifiees: dict[str, str]) -> Parametres:
    """Défauts remplacés par les valeurs modifiées connues (les clés inconnues sont ignorées)."""
    valeurs = {cle: d.convertir(d.defaut) for cle, d in DEFINITIONS.items()}
    valeurs.update({cle: _depuis_texte(cle, texte) for cle, texte in modifiees.items() if cle in DEFINITIONS})
    return Parametres(**valeurs)


def valider(changements: dict[str, float]) -> dict[str, float | int]:
    """Vérifie clés, type et bornes ; retourne les valeurs converties. Lève DonneesInvalides."""
    if not changements:
        raise DonneesInvalides("Aucun paramètre à modifier")
    inconnus = sorted(set(changements) - set(DEFINITIONS))
    if inconnus:
        raise DonneesInvalides(f"Paramètre inconnu : {', '.join(inconnus)}")
    valides = {}
    for cle, valeur in changements.items():
        d = DEFINITIONS[cle]
        if d.entier and not float(valeur).is_integer():
            raise DonneesInvalides(f"{d.libelle} : un nombre entier est attendu")
        if not d.minimum <= valeur <= d.maximum:
            raise DonneesInvalides(f"{d.libelle} : la valeur doit être comprise entre "
                                   f"{_texte(d.minimum)} et {_texte(d.maximum)} {d.unite}")
        valides[cle] = d.convertir(valeur)
    return valides


async def actuels() -> Parametres:
    """Valeurs en vigueur, relues en base au plus toutes les DUREE_CACHE_SECONDES."""
    global _cache
    if _cache is None or _cache[1] <= time.monotonic():
        _cache = (composer(await depot.valeurs_brutes()), time.monotonic() + DUREE_CACHE_SECONDES)
    return _cache[0]


def invalider_cache() -> None:
    global _cache
    _cache = None


async def lister() -> list[dict]:
    """Tous les paramètres avec leur définition, leur valeur en vigueur et la dernière modification."""
    modifies = {ligne["cle"]: ligne for ligne in await depot.valeurs_modifiees()}
    en_vigueur = composer({cle: ligne["valeur"] for cle, ligne in modifies.items()})
    resultat = []
    for cle, d in DEFINITIONS.items():
        modification = modifies.get(cle)
        resultat.append({
            "cle": cle, "libelle": d.libelle, "description": d.description, "categorie": d.categorie,
            "unite": d.unite, "type": "entier" if d.entier else "decimal",
            "valeur": getattr(en_vigueur, cle), "defaut": d.convertir(d.defaut),
            "minimum": d.convertir(d.minimum), "maximum": d.convertir(d.maximum),
            "personnalise": modification is not None,
            "modifie_le": modification["modifie_le"] if modification else None,
            "modifie_par_nom": modification["modifie_par_nom"] if modification else None,
        })
    return resultat


async def modifier(changements: dict[str, float], auteur: dict) -> list[dict]:
    """Applique toutes les valeurs ou aucune, et trace chaque changement effectif."""
    valides = valider(changements)
    async with db.transaction() as tx:
        actuelles = await depot.valeurs_brutes(tx, verrou=True)
        for cle, valeur in valides.items():
            nouvelle, ancienne = _texte(valeur), actuelles.get(cle)
            if nouvelle == (ancienne if ancienne is not None else _texte(DEFINITIONS[cle].defaut)):
                continue  # aucun changement réel : rien à tracer
            await depot.enregistrer(cle, nouvelle, auteur["id"], tx)
            await depot.tracer(cle, ancienne, nouvelle, auteur["id"], tx)
    invalider_cache()
    return await lister()


async def reinitialiser(cle: str, auteur: dict) -> list[dict]:
    """Revient à la valeur par défaut."""
    if cle not in DEFINITIONS:
        raise Introuvable(f"Paramètre inconnu : {cle}")
    async with db.transaction() as tx:
        ancienne = (await depot.valeurs_brutes(tx, verrou=True)).get(cle)
        if ancienne is not None:
            await depot.supprimer(cle, tx)
            await depot.tracer(cle, ancienne, None, auteur["id"], tx)
    invalider_cache()
    return await lister()


async def historique() -> list[dict]:
    return [{**ligne, "libelle": DEFINITIONS[ligne["cle"]].libelle if ligne["cle"] in DEFINITIONS else ligne["cle"]}
            for ligne in await depot.historique()]

