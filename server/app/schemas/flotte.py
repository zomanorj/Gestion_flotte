# Schémas véhicules, chauffeurs et missions
from datetime import date, datetime
from typing import Annotated

from pydantic import Field, model_validator

from .commun import DateHeure, DateOpt, EntierPositif, Entree, Id, IdOpt, MontantOpt, Sortie, Texte, TexteOpt, Vide
from .enums import NouveauStatutMission, StatutChauffeur, StatutMission, StatutVehicule, TypeCamion

# ── Véhicules ──────────────────────────────────────────────────────────────────

Annee = Annotated[int, Vide, Field(ge=1950, le=2100)]
Consommation = Annotated[float, Vide, Field(gt=0, le=5, description="Litres par kilomètre")]


class VehiculeCreation(Entree):
    immatriculation: Texte(20)
    marque: Texte(50)
    modele: Texte(80)
    annee: Annee
    kilometrage: EntierPositif = 0
    consommation_litre_km: Consommation | None = Field(default=None, description="Paramètre « consommation par défaut » si absent")
    statut: StatutVehicule = StatutVehicule.disponible
    date_derniere_vidange: DateOpt = None
    date_prochain_ct: DateOpt = None
    tonnage: MontantOpt = None
    type_camion: TypeCamion = TypeCamion.porteur
    numero_chassis: TexteOpt(50) = None

    @model_validator(mode="before")
    @classmethod
    def _defauts_si_vide(cls, donnees):
        # Un champ de formulaire laissé vide ("") prend la valeur par défaut, comme s'il était absent
        if isinstance(donnees, dict):
            return {k: v for k, v in donnees.items()
                    if not (k in ("kilometrage", "consommation_litre_km") and v in (None, ""))}
        return donnees


class VehiculeMiseAJour(Entree):
    immatriculation: Texte(20) = None
    marque: Texte(50) = None
    modele: Texte(80) = None
    annee: Annee = None
    kilometrage: EntierPositif = None
    consommation_litre_km: Consommation = None
    statut: StatutVehicule = None
    date_derniere_vidange: DateOpt = None
    date_prochain_ct: DateOpt = None
    tonnage: MontantOpt = None
    type_camion: TypeCamion = None
    numero_chassis: TexteOpt(50) = None


class Vehicule(Sortie):
    id: int
    immatriculation: str
    marque: str
    modele: str
    annee: int
    kilometrage: int
    consommation_litre_km: float
    statut: StatutVehicule
    date_derniere_vidange: date | None = None
    date_prochain_ct: date | None = None
    tonnage: float | None = None
    type_camion: TypeCamion
    numero_chassis: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class VehiculeAlerte(Vehicule):
    jours_avant_ct: int | None = Field(default=None, description="Jours avant le contrôle technique")
    km_depuis_vidange: int | None = None


class MaintenanceHistorique(Sortie):
    """Intervention passée (table maintenances)."""

    id: int
    vehicule_id: int
    type: str
    description: str | None = None
    date_maintenance: date
    cout: float
    kilometrage_au_moment: int
    created_at: datetime | None = None


# ── Missions ───────────────────────────────────────────────────────────────────

class MissionCreation(Entree):
    titre: Texte(150)
    vehicule_id: Id
    chauffeur_id: Id
    client_id: IdOpt = None
    lieu_depart: Texte(150)
    lieu_destination: Texte(150)
    distance_km: MontantOpt = 0
    date_depart: DateHeure
    date_retour_prevue: DateHeure
    notes: TexteOpt() = None
    poids_charge: MontantOpt = None

    @model_validator(mode="after")
    def _periode(self):
        if self.date_retour_prevue <= self.date_depart:
            raise ValueError("La date de retour prévue doit être postérieure à la date de départ")
        return self


class ChangementStatutMission(Entree):
    statut: NouveauStatutMission


class Mission(Sortie):
    """Mission ; les champs de jointure ne sont présents que si l'endpoint les fournit."""

    id: int
    titre: str
    vehicule_id: int
    chauffeur_id: int
    client_id: int | None = None
    lieu_depart: str
    lieu_destination: str
    distance_km: float
    date_depart: datetime
    date_retour_prevue: datetime
    date_retour_reelle: datetime | None = None
    statut: StatutMission
    cout_carburant: float | None = None
    poids_charge: float | None = None
    notes: str | None = None
    salaire_mission: float | None = None
    produits_transportes: str | None = None
    poids_total: float | None = None
    valeur_marchandise: float | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Jointures
    immatriculation: str | None = None
    marque: str | None = None
    modele: str | None = None
    chauffeur_nom: str | None = None
    chauffeur_prenom: str | None = None
    chauffeur_tel: str | None = None


class VehiculeDetail(Vehicule):
    missions: list[Mission] = Field(description="5 dernières missions")
    maintenances: list[MaintenanceHistorique]


class ProprietesPlanning(Sortie):
    statut: StatutMission
    chauffeur: str
    vehicule: str
    lieu_depart: str
    lieu_destination: str
    distance_km: float
    poids_charge: float | None = None


class EvenementPlanning(Sortie):
    """Événement au format FullCalendar."""

    id: int
    title: str
    start: datetime
    end: datetime
    color: str
    textColor: str
    extendedProps: ProprietesPlanning


# ── Chauffeurs ─────────────────────────────────────────────────────────────────

class ChauffeurCreation(Entree):
    nom: Texte(80)
    prenom: Texte(80)
    telephone: Texte(20)
    numero_permis: Texte(50)
    categorie_permis: Texte(10) = "B"
    statut: StatutChauffeur = StatutChauffeur.disponible
    user_id: IdOpt = None


class ChauffeurMiseAJour(Entree):
    nom: Texte(80) = None
    prenom: Texte(80) = None
    telephone: Texte(20) = None
    numero_permis: Texte(50) = None
    categorie_permis: Texte(10) = None
    statut: StatutChauffeur = None


class Chauffeur(Sortie):
    """Les champs de rémunération sont absents pour qui n'a pas le droit de les voir."""

    id: int
    user_id: int | None = None
    nom: str
    prenom: str
    telephone: str
    numero_permis: str
    categorie_permis: str
    statut: StatutChauffeur
    salaire_base: float | None = None
    prime_mission: float | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class StatistiquesChauffeur(Sortie):
    total_missions: int
    total_km: float | None = None
    missions_terminees: int | None = None


class ChauffeurDetail(Chauffeur):
    stats: StatistiquesChauffeur

