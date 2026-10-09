# Valeurs autorisées — identiques aux ENUM de la base (database/*.sql)
from enum import StrEnum


class Role(StrEnum):
    admin = "admin"
    gestionnaire = "gestionnaire"
    chauffeur = "chauffeur"


class StatutVehicule(StrEnum):
    disponible = "disponible"
    en_mission = "en_mission"
    en_panne = "en_panne"
    maintenance = "maintenance"


class TypeCamion(StrEnum):
    porteur = "porteur"
    tracteur = "tracteur"
    benne = "benne"
    frigorifique = "frigorifique"
    citerne = "citerne"


class StatutChauffeur(StrEnum):
    disponible = "disponible"
    en_mission = "en_mission"
    conge = "conge"


class StatutMission(StrEnum):
    planifiee = "planifiee"
    en_cours = "en_cours"
    terminee = "terminee"
    annulee = "annulee"


class NouveauStatutMission(StrEnum):
    """Statuts qu'un changement manuel peut demander (planifiee est l'état initial)."""

    en_cours = "en_cours"
    terminee = "terminee"
    annulee = "annulee"


class TypeDocument(StrEnum):
    carte_grise = "carte_grise"
    assurance = "assurance"
    vignette = "vignette"
    visite_technique = "visite_technique"
    autorisation_transport = "autorisation_transport"


class StatutDocument(StrEnum):
    """Calculé à partir de la date d'expiration (non stocké)."""

    valide = "valide"
    expire_bientot = "expire_bientot"
    expire = "expire"


class TypeCarburant(StrEnum):
    diesel = "diesel"
    essence = "essence"
    gasoil = "gasoil"


class CategorieDepense(StrEnum):
    peage = "peage"
    amende = "amende"
    lavage = "lavage"
    pneu = "pneu"
    pieces_detachees = "pieces_detachees"
    main_oeuvre = "main_oeuvre"
    parking = "parking"
    divers = "divers"


class TypeMaintenance(StrEnum):
    vidange = "vidange"
    freins = "freins"
    pneus = "pneus"
    courroie = "courroie"
    filtres = "filtres"
    revision_generale = "revision_generale"
    autre = "autre"


class StatutMaintenance(StrEnum):
    planifiee = "planifiee"
    en_cours = "en_cours"
    terminee = "terminee"
    annulee = "annulee"


class Priorite(StrEnum):
    faible = "faible"
    normale = "normale"
    haute = "haute"
    urgente = "urgente"


class TypeClient(StrEnum):
    entreprise = "entreprise"
    particulier = "particulier"
