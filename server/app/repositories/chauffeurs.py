# Accès aux données : chauffeurs
from .. import db
from ..db import Executeur
from . import base
from .base import Conditions, Plage, Resultat

TABLE = "chauffeurs"


async def lister(statut: str | None = None, recherche: str | None = None, plage: Plage | None = None) -> Resultat:
    conditions = Conditions().si("statut = %s", statut)
    if recherche:
        motif = f"%{recherche}%"
        conditions.si("(nom LIKE %s OR prenom LIKE %s OR numero_permis LIKE %s)", motif, motif, motif)
    return await base.lister("SELECT * FROM chauffeurs", conditions, "nom ASC, prenom ASC", plage,
                             "SELECT COUNT(*) AS total FROM chauffeurs")


async def obtenir(id: int, cx: Executeur = db, *, verrou: bool = False) -> dict | None:
    return await cx.query_one("SELECT * FROM chauffeurs WHERE id = %s" + (" FOR UPDATE" if verrou else ""), [id])


async def id_par_permis(numero_permis: str, sauf_id: int | None = None) -> int | None:
    ligne = await db.query_one("SELECT id FROM chauffeurs WHERE numero_permis = %s AND id <> %s",
                               [numero_permis, sauf_id or 0])
    return ligne["id"] if ligne else None


async def proprietaire(id: int) -> int | None:
    """Compte utilisateur lié à la fiche chauffeur (None si aucun ou fiche inexistante)."""
    ligne = await db.query_one("SELECT user_id FROM chauffeurs WHERE id = %s", [id])
    return ligne["user_id"] if ligne else None


async def tous_pour_paie() -> list[dict]:
    """Rémunération de référence de chaque chauffeur, par ordre alphabétique."""
    return await db.query("SELECT id, nom, prenom, salaire_base, prime_mission FROM chauffeurs ORDER BY nom ASC")


async def salaire(id: int) -> dict | None:
    return await db.query_one("SELECT id, nom, prenom, salaire_base, prime_mission FROM chauffeurs WHERE id = %s",
                              [id])


async def creer(champs: dict) -> int:
    return await base.inserer(TABLE, champs)


async def modifier(id: int, champs: dict) -> None:
    await base.modifier(TABLE, id, champs)


async def supprimer(id: int) -> None:
    await base.supprimer(TABLE, id)


async def definir_statut(id: int, statut: str, cx: Executeur = db, *, seulement_si: str | None = None) -> None:
    """Change le statut ; avec seulement_si, uniquement si le statut actuel est celui-là."""
    if seulement_si:
        await cx.execute("UPDATE chauffeurs SET statut = %s WHERE id = %s AND statut = %s", [statut, id, seulement_si])
    else:
        await cx.execute("UPDATE chauffeurs SET statut = %s WHERE id = %s", [statut, id])
