# Socle des schémas : types réutilisables et classes de base
#
# Entrées (corps de requête) : le frontend envoie les valeurs de formulaire telles quelles
# ("" pour un champ vide, "50" pour un nombre). Les types ci-dessous convertissent "" en None
# et laissent Pydantic convertir les nombres et les dates.
#
# Mises à jour : un champ absent du corps n'est pas modifié ; un champ présent est écrit
# (null ou "" efface la valeur si la colonne l'autorise). Les colonnes NOT NULL sont typées
# sans None : les envoyer vides renvoie une erreur 400.
#
# Sorties : en temps normal, une colonne SQL absente du modèle est ignorée. Avec
# API_SCHEMAS_STRICTS=1 (tests et CI), elle provoque une erreur : un modèle de réponse
# incomplet est détecté avant d'arriver en production.
from datetime import date, datetime
from typing import Annotated, Any, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints

from ..config import config


def vide_vers_none(valeur: Any) -> Any:
    """"" ou espaces seuls → None (champ de formulaire laissé vide)."""
    if isinstance(valeur, str) and not valeur.strip():
        return None
    return valeur


def _sans_fuseau(valeur: datetime) -> datetime:
    # Les DATETIME sont stockés en heure locale sans fuseau : "...Z" ou "+03:00" sont ignorés
    return valeur.replace(tzinfo=None)


Vide = BeforeValidator(vide_vers_none)


def Texte(max_length: int, min_length: int = 1):
    """Chaîne obligatoire, espaces retirés."""
    return Annotated[str, Vide, StringConstraints(strip_whitespace=True, min_length=min_length,
                                                  max_length=max_length)]


def TexteOpt(max_length: int | None = None):
    """Chaîne facultative ("" → None), espaces retirés."""
    return Annotated[Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)] | None, Vide]


# Les contraintes portent sur le type interne : appliquées à None, elles lèveraient une TypeError
Id = Annotated[int, Field(gt=0)]
IdOpt = Annotated[Id | None, Vide]
EntierPositif = Annotated[int, Vide, Field(ge=0)]
EntierPositifOpt = Annotated[Annotated[int, Field(ge=0)] | None, Vide]
Montant = Annotated[float, Vide, Field(gt=0)]
MontantOpt = Annotated[Annotated[float, Field(ge=0)] | None, Vide]
DateOpt = Annotated[date | None, Vide]
Date = Annotated[date, Vide]
DateHeure = Annotated[datetime, Vide, AfterValidator(_sans_fuseau)]


class Entree(BaseModel):
    """Corps de requête : champs inconnus ignorés (le frontend envoie parfois des objets complets)."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    def champs_fournis(self) -> dict:
        """Champs présents dans la requête (pour les mises à jour partielles)."""
        return self.model_dump(exclude_unset=True, mode="python")


SCHEMAS_STRICTS = config().api_schemas_stricts


class Sortie(BaseModel):
    """Réponse : voir l'en-tête du module pour le mode strict."""

    model_config = ConfigDict(extra="forbid" if SCHEMAS_STRICTS else "ignore")


class Message(Sortie):
    message: str


class ErreurChamp(Sortie):
    champ: str
    message: str


class Erreur(Sortie):
    """Format de toutes les erreurs de l'API."""

    message: str
    erreurs: list[ErreurChamp] | None = Field(default=None, description="Détail par champ (erreurs de validation)")


T = TypeVar("T")


class Page(Sortie, Generic[T]):
    """Liste paginée (réponse des listes appelées avec ?paginate=true)."""

    data: list[T]
    total: int
    page: int
    pages: int
    limit: int


class Sante(Sortie):
    status: str
    message: str
