# Schémas documents, carburant, dépenses, maintenances planifiées et clients
# Les noms en camelCase des statistiques sont ceux du contrat JSON existant avec le frontend.
from datetime import date, datetime

from pydantic import Field, model_validator

from .commun import Date, DateOpt, EntierPositifOpt, Entree, Id, IdOpt, Montant, MontantOpt, Sortie, Texte, TexteOpt
from .enums import (
    CategorieDepense,
    Priorite,
    StatutDocument,
    StatutMaintenance,
    TypeCarburant,
    TypeClient,
    TypeDocument,
    TypeMaintenance,
)
from .flotte import Mission


def _champs_vides_ignores(donnees, champs: tuple[str, ...]):
    """Un champ de formulaire laissé vide prend la valeur par défaut, comme s'il était absent."""
    if isinstance(donnees, dict):
        return {k: v for k, v in donnees.items() if not (k in champs and v in (None, ""))}
    return donnees


# ── Documents ──────────────────────────────────────────────────────────────────

class DocumentSaisie(Entree):
    """Création et modification (le fichier joint se gère via POST /documents/{id}/fichier)."""

    vehicule_id: Id
    type: TypeDocument
    numero: TexteOpt(100) = None
    date_emission: Date
    date_expiration: Date
    notes: TexteOpt() = None

    @model_validator(mode="after")
    def _dates(self):
        if self.date_expiration < self.date_emission:
            raise ValueError("La date d'expiration doit être postérieure à la date d'émission")
        return self


class Document(Sortie):
    id: int
    vehicule_id: int
    type: TypeDocument
    numero: str | None = None
    date_emission: date
    date_expiration: date
    fichier_nom: str | None = None
    fichier_url: str | None = Field(default=None, description="Chemin à appeler sous /api pour télécharger")
    notes: str | None = None
    created_at: datetime | None = None
    immatriculation: str | None = None
    marque: str | None = None
    modele: str | None = None
    jours_restants: int = Field(description="Jours avant expiration (négatif si expiré)")
    statut: StatutDocument


class FichierEnvoye(Sortie):
    message: str
    fichier_url: str
    fichier_nom: str


# ── Carburant ──────────────────────────────────────────────────────────────────

class PleinSaisie(Entree):
    """Le coût total est calculé par l'API (litres × prix au litre)."""

    vehicule_id: Id
    mission_id: IdOpt = None
    date_plein: Date
    litres: Montant
    prix_litre: Montant
    kilometrage_au_plein: EntierPositifOpt = None
    consommation_reelle: MontantOpt = None
    station: TexteOpt(100) = None
    ville: TexteOpt(100) = None
    type_carburant: TypeCarburant = TypeCarburant.diesel
    notes: TexteOpt() = None

    @model_validator(mode="before")
    @classmethod
    def _defauts_si_vide(cls, donnees):
        return _champs_vides_ignores(donnees, ("type_carburant",))


class Plein(Sortie):
    id: int
    vehicule_id: int
    mission_id: int | None = None
    date_plein: date
    litres: float
    prix_litre: float
    cout_total: float
    kilometrage_au_plein: int | None = None
    consommation_reelle: float | None = None
    station: str | None = None
    ville: str | None = None
    type_carburant: TypeCarburant
    notes: str | None = None
    created_at: datetime | None = None
    immatriculation: str | None = None
    marque: str | None = None
    modele: str | None = None


class CarburantParVehicule(Sortie):
    immatriculation: str
    marque: str
    litres: float
    cout: float


class CarburantParMois(Sortie):
    mois: str = Field(description="AAAA-MM")
    label: str
    litres: float
    cout: float


class StatistiquesCarburant(Sortie):
    totalLitres: float
    coutTotal: float
    consommationMoyenne: float
    coutMois: float
    parVehicule: list[CarburantParVehicule]
    evolutionMensuelle: list[CarburantParMois]


# ── Dépenses ───────────────────────────────────────────────────────────────────

class DepenseSaisie(Entree):
    vehicule_id: Id
    mission_id: IdOpt = None
    categorie: CategorieDepense
    montant: Montant
    date_depense: Date
    description: TexteOpt() = None
    justificatif_url: TexteOpt(500) = None


class Depense(Sortie):
    id: int
    vehicule_id: int
    mission_id: int | None = None
    categorie: CategorieDepense
    montant: float
    date_depense: date
    description: str | None = None
    justificatif_url: str | None = None
    created_at: datetime | None = None
    immatriculation: str | None = None
    marque: str | None = None
    modele: str | None = None


class DepensesParCategorie(Sortie):
    categorie: CategorieDepense
    total: float
    nb: int


class DepensesParVehicule(Sortie):
    immatriculation: str
    marque: str
    total: float


class DepensesParMois(Sortie):
    mois: str
    label: str
    total: float


class StatistiquesDepenses(Sortie):
    totalMois: float
    totalAnnee: float
    nbDepenses: int
    parCategorie: list[DepensesParCategorie]
    parVehicule: list[DepensesParVehicule]
    evolutionMensuelle: list[DepensesParMois]


# ── Maintenances planifiées ────────────────────────────────────────────────────

class MaintenanceCreation(Entree):
    vehicule_id: Id
    type: TypeMaintenance
    description: TexteOpt() = None
    kilometrage_declencheur: EntierPositifOpt = None
    date_prevue: DateOpt = None
    cout_estime: MontantOpt = None
    garage: TexteOpt(200) = None
    priorite: Priorite = Priorite.normale

    @model_validator(mode="before")
    @classmethod
    def _defauts_si_vide(cls, donnees):
        return _champs_vides_ignores(donnees, ("priorite",))


class MaintenanceMiseAJour(Entree):
    """Seuls les champs envoyés sont modifiés (le statut et les notes de clôture sont conservés)."""

    vehicule_id: Id = None
    type: TypeMaintenance = None
    description: TexteOpt() = None
    kilometrage_declencheur: EntierPositifOpt = None
    date_prevue: DateOpt = None
    cout_estime: MontantOpt = None
    garage: TexteOpt(200) = None
    statut: StatutMaintenance = None
    priorite: Priorite = None
    notes: TexteOpt() = None


class ClotureMaintenance(Entree):
    date_realisee: DateOpt = Field(default=None, description="Aujourd'hui si absente")
    cout_reel: MontantOpt = None
    notes: TexteOpt() = None


class Maintenance(Sortie):
    id: int
    vehicule_id: int
    type: TypeMaintenance
    description: str | None = None
    kilometrage_declencheur: int | None = None
    date_prevue: date | None = None
    date_realisee: date | None = None
    cout_estime: float | None = None
    cout_reel: float | None = None
    garage: str | None = None
    statut: StatutMaintenance | None = None
    priorite: Priorite | None = None
    notes: str | None = None
    created_at: datetime | None = None
    immatriculation: str | None = None
    marque: str | None = None
    modele: str | None = None
    kilometrage: int | None = Field(default=None, description="Kilométrage actuel du véhicule")
    depassee: bool | None = Field(default=None, description="Date prévue passée sans clôture")


# ── Clients ────────────────────────────────────────────────────────────────────

class ClientSaisie(Entree):
    nom: Texte(200)
    type: TypeClient = TypeClient.entreprise
    contact_nom: TexteOpt(100) = None
    telephone: TexteOpt(20) = None
    email: TexteOpt(150) = None
    adresse: TexteOpt() = None
    ville: TexteOpt(100) = None
    notes: TexteOpt() = None
    nif: TexteOpt(50) = None
    stat_num: TexteOpt(50) = None
    site_web: TexteOpt(200) = None
    secteur: TexteOpt(100) = None
    limite_credit: MontantOpt = None

    @model_validator(mode="before")
    @classmethod
    def _defauts_si_vide(cls, donnees):
        return _champs_vides_ignores(donnees, ("type",))


class Client(Sortie):
    id: int
    nom: str
    type: TypeClient | None = None
    contact_nom: str | None = None
    telephone: str | None = None
    email: str | None = None
    adresse: str | None = None
    ville: str | None = None
    notes: str | None = None
    nif: str | None = None
    stat_num: str | None = None
    site_web: str | None = None
    secteur: str | None = None
    limite_credit: float | None = None
    created_at: datetime | None = None
    nb_missions: int | None = None
    chiffre_affaires: float | None = None


class ClientResume(Sortie):
    id: int
    nom: str


class MissionsClient(Sortie):
    client: ClientResume
    missions: list[Mission]
