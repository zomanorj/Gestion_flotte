# Schémas des paramètres métier
from datetime import datetime
from typing import Literal

from pydantic import Field

from .commun import Entree, Sortie


class Parametre(Sortie):
    cle: str
    libelle: str
    description: str
    categorie: str = Field(description="Regroupement à l'affichage : Missions, Paie, Alertes")
    unite: str
    type: Literal["entier", "decimal"]
    valeur: float = Field(description="Valeur en vigueur")
    defaut: float
    minimum: float
    maximum: float
    personnalise: bool = Field(description="Vrai si la valeur a été modifiée par un administrateur")
    modifie_le: datetime | None = None
    modifie_par_nom: str | None = None


class ModificationParametres(Entree):
    valeurs: dict[str, float] = Field(min_length=1, description="{cle: nouvelle valeur} ; tout ou rien",
                                      examples=[{"prix_litre_gasoil": 5400, "taux_cnaps": 1}])


class ModificationTracee(Sortie):
    id: int
    cle: str
    libelle: str
    ancienne_valeur: str | None = Field(default=None, description="null : la valeur par défaut était en vigueur")
    nouvelle_valeur: str | None = Field(default=None, description="null : retour à la valeur par défaut")
    modifie_le: datetime
    modifie_par_nom: str | None = None
