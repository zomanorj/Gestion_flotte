# Accès aux données : documents, carburant, dépenses, maintenances planifiées, clients
from datetime import date

from .. import db
from ..db import Executeur
from . import base
from .base import Conditions, Plage, Resultat

# ── Documents ──────────────────────────────────────────────────────────────────

_DOCUMENT = """
    SELECT d.*, v.immatriculation, v.marque, v.modele,
           DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
    FROM documents d
    JOIN vehicules v ON d.vehicule_id = v.id
"""


async def lister_documents(vehicule_id: int | None = None, type: str | None = None,
                           plage: Plage | None = None) -> Resultat:
    conditions = Conditions().si("d.vehicule_id = %s", vehicule_id).si("d.type = %s", type)
    return await base.lister(_DOCUMENT, conditions, "d.date_expiration ASC", plage,
                             "SELECT COUNT(*) AS total FROM documents d")


async def documents_a_renouveler() -> list[dict]:
    """Expirés ou expirant dans les 30 prochains jours, les plus urgents en premier."""
    return await db.query(_DOCUMENT + """
        WHERE d.date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ORDER BY d.date_expiration ASC
    """)


async def obtenir_document(id: int) -> dict | None:
    return await db.query_one(_DOCUMENT + " WHERE d.id = %s", [id])


async def creer_document(champs: dict) -> int:
    return await base.inserer("documents", champs)


async def modifier_document(id: int, champs: dict) -> None:
    await base.modifier("documents", id, champs)


async def supprimer_document(id: int) -> None:
    await base.supprimer("documents", id)


# ── Carburant ──────────────────────────────────────────────────────────────────

_PLEIN = """
    SELECT c.*, v.immatriculation, v.marque, v.modele
    FROM carburant c
    JOIN vehicules v ON c.vehicule_id = v.id
"""


async def lister_pleins(vehicule_id: int | None = None, debut: date | None = None, fin: date | None = None,
                        plage: Plage | None = None) -> Resultat:
    conditions = (Conditions()
                  .si("c.vehicule_id = %s", vehicule_id)
                  .si("c.date_plein >= %s", debut)
                  .si("c.date_plein <= %s", fin))
    return await base.lister(_PLEIN, conditions, "c.date_plein DESC", plage,
                             "SELECT COUNT(*) AS total FROM carburant c")


async def obtenir_plein(id: int) -> dict | None:
    return await db.query_one(_PLEIN + " WHERE c.id = %s", [id])


async def creer_plein(champs: dict) -> int:
    return await base.inserer("carburant", champs)


async def modifier_plein(id: int, champs: dict) -> None:
    await base.modifier("carburant", id, champs)


async def supprimer_plein(id: int) -> None:
    await base.supprimer("carburant", id)


async def statistiques_carburant() -> dict:
    totaux = await db.query_one("""
        SELECT IFNULL(SUM(litres), 0)              AS totalLitres,
               IFNULL(SUM(cout_total), 0)          AS coutTotal,
               IFNULL(AVG(consommation_reelle), 0) AS consommationMoyenne
        FROM carburant
    """)
    mois = await db.query_one("""
        SELECT IFNULL(SUM(cout_total), 0) AS coutMois
        FROM carburant
        WHERE YEAR(date_plein) = YEAR(CURDATE()) AND MONTH(date_plein) = MONTH(CURDATE())
    """)
    par_vehicule = await db.query("""
        SELECT v.immatriculation, v.marque, SUM(c.litres) AS litres, SUM(c.cout_total) AS cout
        FROM carburant c
        JOIN vehicules v ON c.vehicule_id = v.id
        GROUP BY c.vehicule_id, v.immatriculation, v.marque
        ORDER BY cout DESC
    """)
    evolution = await db.query("""
        SELECT DATE_FORMAT(date_plein, '%Y-%m')      AS mois,
               MIN(DATE_FORMAT(date_plein, '%b %Y')) AS label,
               SUM(litres)     AS litres,
               SUM(cout_total) AS cout
        FROM carburant
        WHERE date_plein >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(date_plein, '%Y-%m')
        ORDER BY mois ASC
    """)
    return {**totaux, **mois, "parVehicule": par_vehicule, "evolutionMensuelle": evolution}


# ── Dépenses ───────────────────────────────────────────────────────────────────

_DEPENSE = """
    SELECT d.*, v.immatriculation, v.marque, v.modele
    FROM depenses d
    JOIN vehicules v ON d.vehicule_id = v.id
"""


async def lister_depenses(vehicule_id: int | None = None, categorie: str | None = None,
                          debut: date | None = None, fin: date | None = None,
                          plage: Plage | None = None) -> Resultat:
    conditions = (Conditions()
                  .si("d.vehicule_id = %s", vehicule_id)
                  .si("d.categorie = %s", categorie)
                  .si("d.date_depense >= %s", debut)
                  .si("d.date_depense <= %s", fin))
    return await base.lister(_DEPENSE, conditions, "d.date_depense DESC", plage,
                             "SELECT COUNT(*) AS total FROM depenses d")


async def obtenir_depense(id: int) -> dict | None:
    return await db.query_one(_DEPENSE + " WHERE d.id = %s", [id])


async def creer_depense(champs: dict) -> int:
    return await base.inserer("depenses", champs)


async def modifier_depense(id: int, champs: dict) -> None:
    await base.modifier("depenses", id, champs)


async def supprimer_depense(id: int) -> None:
    await base.supprimer("depenses", id)


async def statistiques_depenses() -> dict:
    totaux = await db.query_one("""
        SELECT IFNULL(SUM(CASE WHEN YEAR(date_depense) = YEAR(CURDATE())
                                AND MONTH(date_depense) = MONTH(CURDATE())
                           THEN montant ELSE 0 END), 0) AS totalMois,
               IFNULL(SUM(CASE WHEN YEAR(date_depense) = YEAR(CURDATE())
                           THEN montant ELSE 0 END), 0) AS totalAnnee,
               COUNT(*) AS nbDepenses
        FROM depenses
    """)
    par_categorie = await db.query("""
        SELECT categorie, SUM(montant) AS total, COUNT(*) AS nb
        FROM depenses
        WHERE YEAR(date_depense) = YEAR(CURDATE())
        GROUP BY categorie
        ORDER BY total DESC
    """)
    par_vehicule = await db.query("""
        SELECT v.immatriculation, v.marque, SUM(d.montant) AS total
        FROM depenses d
        JOIN vehicules v ON d.vehicule_id = v.id
        WHERE YEAR(d.date_depense) = YEAR(CURDATE())
        GROUP BY d.vehicule_id, v.immatriculation, v.marque
        ORDER BY total DESC
    """)
    evolution = await db.query("""
        SELECT DATE_FORMAT(date_depense, '%Y-%m')      AS mois,
               MIN(DATE_FORMAT(date_depense, '%b %Y')) AS label,
               SUM(montant) AS total
        FROM depenses
        WHERE date_depense >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(date_depense, '%Y-%m')
        ORDER BY mois ASC
    """)
    return {**totaux, "parCategorie": par_categorie, "parVehicule": par_vehicule, "evolutionMensuelle": evolution}


# ── Maintenances planifiées ────────────────────────────────────────────────────

_MAINTENANCE = """
    SELECT mp.*, v.immatriculation, v.marque, v.modele, v.kilometrage,
           (mp.date_prevue < CURDATE() AND mp.statut NOT IN ('terminee', 'annulee')) AS depassee
    FROM maintenances_planifiees mp
    JOIN vehicules v ON mp.vehicule_id = v.id
"""


async def lister_maintenances(statut: str | None = None, priorite: str | None = None,
                              vehicule_id: int | None = None, plage: Plage | None = None) -> Resultat:
    conditions = (Conditions()
                  .si("mp.statut = %s", statut)
                  .si("mp.priorite = %s", priorite)
                  .si("mp.vehicule_id = %s", vehicule_id))
    return await base.lister(_MAINTENANCE, conditions, "mp.date_prevue ASC", plage,
                             "SELECT COUNT(*) AS total FROM maintenances_planifiees mp")


async def maintenances_urgentes() -> list[dict]:
    """Prévue sous 7 jours ou dépassée, priorité urgente, ou kilométrage déclencheur atteint."""
    return await db.query(_MAINTENANCE + """
        WHERE mp.statut NOT IN ('terminee', 'annulee')
          AND (mp.date_prevue <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
               OR mp.priorite = 'urgente'
               OR (mp.kilometrage_declencheur IS NOT NULL AND v.kilometrage >= mp.kilometrage_declencheur))
        ORDER BY mp.priorite DESC, mp.date_prevue ASC
    """)


async def obtenir_maintenance(id: int) -> dict | None:
    """Maintenance avec son véhicule (sans le calcul « dépassée », réservé aux listes)."""
    return await db.query_one("""
        SELECT mp.*, v.immatriculation, v.marque
        FROM maintenances_planifiees mp JOIN vehicules v ON mp.vehicule_id = v.id
        WHERE mp.id = %s
    """, [id])


async def creer_maintenance(champs: dict) -> int:
    return await base.inserer("maintenances_planifiees", champs)


async def modifier_maintenance(id: int, champs: dict) -> None:
    await base.modifier("maintenances_planifiees", id, champs)


async def supprimer_maintenance(id: int) -> None:
    await base.supprimer("maintenances_planifiees", id)


# ── Clients ────────────────────────────────────────────────────────────────────

async def lister_clients(plage: Plage | None = None) -> Resultat:
    """Avec le nombre de missions et le montant associé de chaque client (GROUP BY : requête dédiée)."""
    sql = """SELECT c.*, COUNT(m.id) AS nb_missions, IFNULL(SUM(m.cout_carburant), 0) AS chiffre_affaires
             FROM clients c
             LEFT JOIN missions m ON m.client_id = c.id
             GROUP BY c.id
             ORDER BY c.nom ASC"""
    if plage is None:
        return Resultat(await db.query(sql))
    limite, params = plage.sql()
    total = await db.query_one("SELECT COUNT(*) AS total FROM clients")
    return Resultat(await db.query(sql + limite, params), int(total["total"]))


async def obtenir_client(id: int, cx: Executeur = db, *, verrou: bool = False) -> dict | None:
    return await cx.query_one("SELECT * FROM clients WHERE id = %s" + (" FOR UPDATE" if verrou else ""), [id])


async def creer_client(champs: dict) -> int:
    return await base.inserer("clients", champs)


async def modifier_client(id: int, champs: dict) -> None:
    await base.modifier("clients", id, champs)


async def supprimer_client(id: int, cx: Executeur = db) -> None:
    await base.supprimer("clients", id, cx)


async def vehicule_existe(id: int) -> bool:
    return await base.existe("vehicules", id)
