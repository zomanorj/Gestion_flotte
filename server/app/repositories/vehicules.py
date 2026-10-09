# Accès aux données : véhicules et historique de maintenance
from .. import db
from ..db import Executeur
from . import base
from .base import Conditions, Plage, Resultat

TABLE = "vehicules"

# Kilométrage relevé lors de la dernière vidange enregistrée (0 si aucune)
_KM_DERNIERE_VIDANGE = """IFNULL(
    (SELECT m.kilometrage_au_moment FROM maintenances m
     WHERE m.vehicule_id = v.id AND m.type = 'Vidange'
     ORDER BY m.date_maintenance DESC LIMIT 1), 0)"""


async def lister(statut: str | None = None, recherche: str | None = None, plage: Plage | None = None) -> Resultat:
    conditions = Conditions().si("statut = %s", statut)
    if recherche:
        motif = f"%{recherche}%"
        conditions.si("(immatriculation LIKE %s OR marque LIKE %s OR modele LIKE %s)", motif, motif, motif)
    return await base.lister("SELECT * FROM vehicules", conditions, "created_at DESC", plage,
                             "SELECT COUNT(*) AS total FROM vehicules")


async def alertes() -> list[dict]:
    """Contrôle technique sous 30 jours, ou plus de 10 000 km depuis la dernière vidange."""
    return await db.query(f"""
        SELECT v.*,
          DATEDIFF(v.date_prochain_ct, CURDATE()) AS jours_avant_ct,
          (v.kilometrage - {_KM_DERNIERE_VIDANGE}) AS km_depuis_vidange
        FROM vehicules v
        WHERE (v.date_prochain_ct IS NOT NULL AND v.date_prochain_ct <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
           OR (v.kilometrage - {_KM_DERNIERE_VIDANGE}) > 10000
        ORDER BY v.date_prochain_ct ASC
    """)


async def obtenir(id: int, cx: Executeur = db, *, verrou: bool = False) -> dict | None:
    """Le véhicule ; avec verrou=True (dans une transaction), la ligne est verrouillée en écriture."""
    return await cx.query_one("SELECT * FROM vehicules WHERE id = %s" + (" FOR UPDATE" if verrou else ""), [id])


async def id_par_immatriculation(immatriculation: str, sauf_id: int | None = None) -> int | None:
    ligne = await db.query_one("SELECT id FROM vehicules WHERE immatriculation = %s AND id <> %s",
                               [immatriculation, sauf_id or 0])
    return ligne["id"] if ligne else None


async def maintenances_effectuees(vehicule_id: int) -> list[dict]:
    return await db.query("SELECT * FROM maintenances WHERE vehicule_id = %s ORDER BY date_maintenance DESC",
                          [vehicule_id])


async def creer(champs: dict) -> int:
    return await base.inserer(TABLE, champs)


async def modifier(id: int, champs: dict) -> None:
    await base.modifier(TABLE, id, champs)


async def supprimer(id: int) -> None:
    await base.supprimer(TABLE, id)


async def existe(id: int) -> bool:
    return await base.existe(TABLE, id)


async def definir_statut(id: int, statut: str, cx: Executeur = db, *, seulement_si: str | None = None) -> None:
    """Change le statut ; avec seulement_si, uniquement si le statut actuel est celui-là."""
    if seulement_si:
        await cx.execute("UPDATE vehicules SET statut = %s WHERE id = %s AND statut = %s", [statut, id, seulement_si])
    else:
        await cx.execute("UPDATE vehicules SET statut = %s WHERE id = %s", [statut, id])
