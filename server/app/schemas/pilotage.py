# Schémas paie, simulation et tableau de bord
# Les noms en camelCase (villeDepart, totalVehicules…) sont ceux du contrat JSON existant avec le frontend.
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, Field, model_validator

from .commun import Entree, MontantOpt, Position, Sortie, Texte

# ── Paie ───────────────────────────────────────────────────────────────────────

class ChauffeurPaie(Sortie):
    id: int
    nom: str
    prenom: str
    telephone: str | None = None
    numero_permis: str | None = None
    categorie_permis: str | None = None
    salaire_base: float
    prime_mission: float


class Periode(Sortie):
    annee: int
    mois: int


class MissionPaie(Sortie):
    id: int
    titre: str
    lieu_depart: str
    lieu_destination: str
    distance_km: float
    cout_carburant: float | None = None
    poids_charge: float | None = None
    date_depart: datetime
    date_retour_reelle: datetime | None = None
    immatriculation: str
    marque: str
    prime_saisie: float | None = None
    bonus: float | None = None
    statut_paiement: str | None = None


class CalculPaie(Sortie):
    nb_missions: int
    total_km: int
    salaire_base: float
    total_primes: float
    km_bonus: float = Field(description="20 000 Ar par tranche de 500 km au-delà de 500 km")
    total_brut: float
    cnaps: float = Field(description="Cotisation salariale CNAPS (1 %)")
    net_a_payer: float


class FichePaie(Sortie):
    chauffeur: ChauffeurPaie
    periode: Periode
    missions: list[MissionPaie]
    calcul: CalculPaie


class LignePaie(Sortie):
    chauffeur_id: int
    nom: str
    prenom: str
    nb_missions: int
    total_km: int
    salaire_base: float
    total_primes: float
    km_bonus: float
    net_a_payer: float


class PaieMensuelle(Sortie):
    fiches: list[LignePaie]
    masse_salariale: float
    nb_missions: int
    annee: int
    mois: int


class SalaireSaisie(Entree):
    salaire_base: MontantOpt = None
    prime_mission: MontantOpt = None

    @model_validator(mode="after")
    def _au_moins_un(self):
        if not self.champs_fournis():
            raise ValueError("Au moins salaire_base ou prime_mission requis")
        return self


class Salaire(Sortie):
    id: int
    nom: str
    prenom: str
    salaire_base: float | None = None
    prime_mission: float | None = None


# ── Simulation ─────────────────────────────────────────────────────────────────

class DemandeItineraire(Entree):
    villeDepart: Texte(100)
    villeArrivee: Texte(100)


class Itineraire(Sortie):
    distanceKm: int
    dureeMin: int
    totalPoints: int


MULTIPLICATEURS = (1, 5, 10, 30, 60)


def _multiplicateur_propose(valeur: int) -> int:
    if valeur not in MULTIPLICATEURS:
        raise ValueError(f"multiplicateur doit valoir {', '.join(map(str, MULTIPLICATEURS))}")
    return valeur


class ChangementVitesse(Entree):
    multiplicateur: Annotated[int, AfterValidator(_multiplicateur_propose)] = Field(
        description="Facteur d'accélération : 1, 5, 10, 30 ou 60")


class VitesseModifiee(Sortie):
    message: str
    multiplicateur: int


class MissionDemarree(Sortie):
    id: int
    titre: str
    camion: str
    chauffeur: str
    depart: str
    destination: str


class SimulationDemarree(Sortie):
    message: str
    mission: MissionDemarree


class EvenementEnCours(Sortie):
    id: str
    label: str
    type: str
    couleur: str


class EtatSimulation(Sortie):
    missionId: str
    position: Position
    progression: int
    vitesse: float
    multiplicateur: int
    enPause: bool
    evenementActuel: EvenementEnCours | None = None
    immatriculation: str | None = None
    chauffeur_nom: str | None = None
    titre: str | None = None
    lieu_depart: str | None = None
    lieu_destination: str | None = None
    distanceKm: float


class Villes(Sortie):
    villes: list[str]


# ── Tableau de bord ────────────────────────────────────────────────────────────

class MissionsSemaine(Sortie):
    semaine: str
    count: int


class AlerteVehicule(Sortie):
    id: int
    vehicule_id: int
    type: str
    message: str
    est_lue: bool
    created_at: datetime | None = None
    immatriculation: str
    marque: str


class VehiculeEnMission(Sortie):
    id: int
    immatriculation: str
    marque: str
    modele: str
    lieu_destination: str
    titre: str
    chauffeur_nom: str
    chauffeur_prenom: str


class StatistiquesTableauDeBord(Sortie):
    totalVehicules: int
    vehiculesDisponibles: int
    vehiculesEnMission: int
    vehiculesEnPanne: int
    vehiculesMaintenance: int
    missionsEnCours: int
    missionsPlanifiees: int
    missionsAujourdhui: int
    missionsTermineesThisMois: int
    coutTotalMois: float
    alertesMaintenance: int
    documentsExpires: int
    missionsParSemaine: list[MissionsSemaine]
    dernieresAlertes: list[AlerteVehicule]
    vehiculesEnMissionCarte: list[VehiculeEnMission]

