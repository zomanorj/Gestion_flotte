# Schémas authentification, utilisateurs et notifications
from datetime import datetime

from pydantic import Field, field_validator

from .commun import Entree, Sortie, Texte, TexteOpt
from .enums import Role

LONGUEUR_MIN_MDP = 8
# bcrypt ne prend en compte que les 72 premiers octets d'un mot de passe
OCTETS_MAX_MDP = 72


def _valider_mdp(valeur: str) -> str:
    if len(valeur) < LONGUEUR_MIN_MDP:
        raise ValueError(f"Le mot de passe doit faire au moins {LONGUEUR_MIN_MDP} caractères")
    if len(valeur.encode()) > OCTETS_MAX_MDP:
        raise ValueError("Le mot de passe est trop long (72 octets maximum)")
    return valeur


def _valider_email(valeur: str) -> str:
    valeur = valeur.strip().lower()
    local, _, domaine = valeur.partition("@")
    if not local or "." not in domaine or " " in valeur:
        raise ValueError("Adresse email invalide")
    return valeur


class Connexion(Entree):
    email: Texte(150)
    password: str = Field(min_length=1)


class Utilisateur(Sortie):
    id: int
    nom: str
    email: str
    role: Role
    is_active: bool | None = None
    created_at: datetime | None = None
    # Liste des comptes : fiche chauffeur liée
    chauffeur_id: int | None = None
    chauffeur_nom: str | None = None
    chauffeur_prenom: str | None = None


class SessionOuverte(Sortie):
    token: str = Field(description="JWT à envoyer dans l'en-tête Authorization: Bearer <token>")
    user: Utilisateur


class UtilisateurCreation(Entree):
    nom: Texte(100)
    email: Texte(150)
    password: str
    role: Role

    @field_validator("email")
    @classmethod
    def valider_email(cls, valeur: str) -> str:
        return _valider_email(valeur)

    @field_validator("password")
    @classmethod
    def valider_mdp(cls, valeur: str) -> str:
        return _valider_mdp(valeur)


class UtilisateurMiseAJour(Entree):
    nom: Texte(100) = None
    email: Texte(150) = None
    role: Role = None
    is_active: bool = None

    @field_validator("email")
    @classmethod
    def valider_email(cls, valeur: str) -> str:
        return _valider_email(valeur)


class ChangementMotDePasse(Entree):
    password: str
    password_actuel: TexteOpt() = Field(default=None, description="Obligatoire sauf pour un administrateur")

    @field_validator("password")
    @classmethod
    def valider_mdp(cls, valeur: str) -> str:
        return _valider_mdp(valeur)


class MotDePasseChange(Sortie):
    message: str
    token: str | None = Field(default=None, description="Nouveau token, si l'utilisateur a changé son propre mot de passe")


class Notification(Sortie):
    id: int
    type: str | None = None
    titre: str | None = None
    message: str | None = None
    vehicule_id: int | None = None
    immatriculation: str | None = None
    est_lue: bool
    created_at: datetime | None = None


class ListeNotifications(Sortie):
    notifications: list[Notification]
    non_lues: int
