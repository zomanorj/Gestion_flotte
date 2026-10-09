# Socle des repositories
#
# Un repository ne fait que du SQL : pas de règle métier, pas de HTTP, pas de schéma Pydantic.
# Chaque fonction reçoit en dernier argument facultatif `cx` : le module db (par défaut) ou la
# Connexion d'une transaction, ce qui permet aux services de composer plusieurs appels dans une
# même transaction.
#
# Les noms de tables et de colonnes insérés dans le SQL viennent toujours du code (constantes,
# champs de schémas), jamais directement de la requête HTTP.
from dataclasses import dataclass, field

from .. import db
from ..db import Executeur


@dataclass(frozen=True)
class Plage:
    """Fenêtre de résultats pour une liste paginée."""

    limite: int
    decalage: int = 0

    def sql(self) -> tuple[str, list]:
        return " LIMIT %s OFFSET %s", [self.limite, self.decalage]


@dataclass
class Conditions:
    """Construit une clause WHERE à partir de filtres facultatifs (ignorés s'ils sont vides)."""

    clauses: list[str] = field(default_factory=list)
    params: list = field(default_factory=list)

    def si(self, condition: str, *valeurs) -> "Conditions":
        """Ajoute `condition` (avec ses %s) si toutes les valeurs sont renseignées."""
        if all(v is not None and v != "" for v in valeurs):
            self.clauses.append(condition)
            self.params.extend(valeurs)
        return self

    @property
    def where(self) -> str:
        return " WHERE " + " AND ".join(self.clauses) if self.clauses else ""


@dataclass
class Resultat:
    """Lignes d'une liste, et leur nombre total si la liste est paginée."""

    lignes: list[dict]
    total: int | None = None


async def lister(requete: str, conditions: Conditions, ordre: str, plage: Plage | None,
                 requete_total: str, cx: Executeur = db) -> Resultat:
    """
    Liste filtrée, éventuellement paginée. `requete` et `requete_total` ne contiennent ni WHERE
    ni ORDER BY : ils sont ajoutés ici à partir de `conditions` et `ordre`.
    """
    sql, params = requete + conditions.where + " ORDER BY " + ordre, list(conditions.params)
    if plage is None:
        # None et non [] : sans paramètre, PyMySQL laisse les % littéraux du SQL intacts
        return Resultat(await cx.query(sql, params or None))
    limite, params_limite = plage.sql()
    total = await cx.query_one(requete_total + conditions.where, conditions.params or None)
    return Resultat(await cx.query(sql + limite, params + params_limite), int(total["total"]))


async def inserer(table: str, champs: dict, cx: Executeur = db) -> int:
    colonnes = ", ".join(champs)
    marques = ", ".join(["%s"] * len(champs))
    return await cx.execute(f"INSERT INTO {table} ({colonnes}) VALUES ({marques})", list(champs.values()))


async def modifier(table: str, id: int, champs: dict, cx: Executeur = db) -> None:
    """UPDATE partiel : seules les colonnes de `champs` sont écrites (rien si vide)."""
    if not champs:
        return
    colonnes = ", ".join(f"{colonne} = %s" for colonne in champs)
    await cx.execute(f"UPDATE {table} SET {colonnes} WHERE id = %s", [*champs.values(), id])


async def supprimer(table: str, id: int, cx: Executeur = db) -> None:
    await cx.execute(f"DELETE FROM {table} WHERE id = %s", [id])


async def existe(table: str, id: int, cx: Executeur = db) -> bool:
    return await cx.query_one(f"SELECT 1 AS ok FROM {table} WHERE id = %s", [id]) is not None
