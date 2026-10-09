# Accès aux données : missions
from datetime import date, datetime

from .. import db
from ..db import Executeur
from . import base
from .base import Conditions, Plage, Resultat

TABLE = "missions"
COLONNES_RESSOURCE = ("vehicule_id", "chauffeur_id")

_AVEC_RESSOURCES = """
    FROM missions m
    JOIN vehicules  v ON m.vehicule_id  = v.id
    JOIN chauffeurs c ON m.chauffeur_id = c.id
"""


def _verifier_colonne(colonne: str) -> None:
    # Nom de colonne inséré dans le SQL : liste blanche stricte (pas d'assert, désactivable avec -O)
    if colonne not in COLONNES_RESSOURCE:
        raise ValueError(f"Colonne de ressource inconnue : {colonne}")


async def lister(statut: str | None = None, debut: date | None = None, fin: date | None = None,
                 plage: Plage | None = None) -> Resultat:
    conditions = (Conditions()
                  .si("m.statut = %s", statut)
                  .si("m.date_depart >= %s", debut)
                  .si("m.date_depart < DATE_ADD(%s, INTERVAL 1 DAY)", fin))
    return await base.lister(
        """SELECT m.*, v.immatriculation, v.marque, v.modele,
                  c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom, c.telephone AS chauffeur_tel"""
        + _AVEC_RESSOURCES,
        conditions, "m.date_depart DESC", plage, "SELECT COUNT(*) AS total FROM missions m",
    )


async def pour_planning() -> list[dict]:
    return await db.query(
        "SELECT m.*, v.immatriculation, v.marque, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom"
        + _AVEC_RESSOURCES + " ORDER BY m.date_depart ASC"
    )


async def obtenir(id: int, cx: Executeur = db, *, verrou: bool = False) -> dict | None:
    return await cx.query_one("SELECT * FROM missions WHERE id = %s" + (" FOR UPDATE" if verrou else ""), [id])


async def resume(id: int) -> dict | None:
    """Mission avec immatriculation et nom du chauffeur (réponse des écritures)."""
    return await db.query_one(
        "SELECT m.*, v.immatriculation, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom"
        + _AVEC_RESSOURCES + " WHERE m.id = %s",
        [id],
    )


async def pour_bon_livraison(id: int) -> dict | None:
    return await db.query_one("""
        SELECT m.*,
          v.immatriculation, v.marque, v.modele,
          c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom, c.numero_permis,
          cl.nom AS client_nom, cl.contact_nom AS client_contact, cl.telephone AS client_tel
        FROM missions m
        JOIN vehicules  v ON m.vehicule_id  = v.id
        JOIN chauffeurs c ON m.chauffeur_id = c.id
        LEFT JOIN clients cl ON m.client_id = cl.id
        WHERE m.id = %s
    """, [id])


async def recentes_du_vehicule(vehicule_id: int, nombre: int = 5) -> list[dict]:
    return await db.query("""
        SELECT m.*, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM missions m
        JOIN chauffeurs c ON m.chauffeur_id = c.id
        WHERE m.vehicule_id = %s
        ORDER BY m.date_depart DESC
        LIMIT %s
    """, [vehicule_id, nombre])


async def du_chauffeur(chauffeur_id: int) -> list[dict]:
    return await db.query("""
        SELECT m.*, v.immatriculation, v.marque, v.modele
        FROM missions m
        JOIN vehicules v ON m.vehicule_id = v.id
        WHERE m.chauffeur_id = %s
        ORDER BY m.date_depart DESC
    """, [chauffeur_id])


async def du_client(client_id: int) -> list[dict]:
    return await db.query(
        "SELECT m.*, v.immatriculation, v.marque, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom"
        + _AVEC_RESSOURCES + " WHERE m.client_id = %s ORDER BY m.date_depart DESC",
        [client_id],
    )


async def statistiques_chauffeur(chauffeur_id: int) -> dict:
    return await db.query_one("""
        SELECT COUNT(*) AS total_missions,
               SUM(distance_km) AS total_km,
               SUM(CASE WHEN statut = 'terminee' THEN 1 ELSE 0 END) AS missions_terminees
        FROM missions WHERE chauffeur_id = %s
    """, [chauffeur_id])


async def nombre_par_ressource(colonne: str, ressource_id: int) -> dict:
    """{nb, actives} : missions de la ressource (colonne = vehicule_id ou chauffeur_id), dont actives."""
    _verifier_colonne(colonne)
    ligne = await db.query_one(
        f"SELECT COUNT(*) AS nb, SUM(statut IN ('planifiee', 'en_cours')) AS actives FROM missions WHERE {colonne} = %s",
        [ressource_id],
    )
    return {"nb": int(ligne["nb"]), "actives": int(ligne["actives"] or 0)}


async def premiere_en_conflit(cx: Executeur, colonne: str, ressource_id: int, debut: datetime, fin: datetime,
                              exclure_id: int | None = None) -> dict | None:
    """
    Première mission active (planifiée ou en cours) de la ressource dont la période chevauche
    [debut, fin[. Une mission en cours qui dépasse son retour prévu occupe la ressource jusqu'à
    maintenant.
    """
    _verifier_colonne(colonne)
    return await cx.query_one(
        f"""SELECT id, titre, date_depart, date_retour_prevue
            FROM missions
            WHERE {colonne} = %s
              AND statut IN ('planifiee', 'en_cours')
              AND id <> %s
              AND date_depart < %s
              AND (CASE WHEN statut = 'en_cours' THEN GREATEST(date_retour_prevue, NOW())
                        ELSE date_retour_prevue END) > %s
            ORDER BY date_depart
            LIMIT 1""",
        [ressource_id, exclure_id or 0, fin, debut],
    )


async def terminees_du_mois(chauffeur_id: int, annee: int, mois: int) -> list[dict]:
    """Missions terminées (retour réel) dans le mois, avec la saisie de paie éventuelle."""
    return await db.query("""
        SELECT m.id, m.titre, m.lieu_depart, m.lieu_destination,
               m.distance_km, m.cout_carburant, m.poids_charge,
               m.date_depart, m.date_retour_reelle,
               v.immatriculation, v.marque,
               ms.prime_mission AS prime_saisie, ms.bonus, ms.statut AS statut_paiement
        FROM missions m
        JOIN vehicules v ON m.vehicule_id = v.id
        LEFT JOIN mission_salaires ms ON ms.mission_id = m.id AND ms.chauffeur_id = %s
        WHERE m.chauffeur_id = %s
          AND m.statut = 'terminee'
          AND YEAR(m.date_retour_reelle)  = %s
          AND MONTH(m.date_retour_reelle) = %s
        ORDER BY m.date_depart ASC
    """, [chauffeur_id, chauffeur_id, annee, mois])


async def distances_terminees_du_mois(annee: int, mois: int) -> dict[int, list[float]]:
    """Distances des missions terminées dans le mois, par chauffeur (une seule requête)."""
    lignes = await db.query("""
        SELECT chauffeur_id, distance_km
        FROM missions
        WHERE statut = 'terminee'
          AND YEAR(date_retour_reelle)  = %s
          AND MONTH(date_retour_reelle) = %s
    """, [annee, mois])
    par_chauffeur: dict[int, list[float]] = {}
    for ligne in lignes:
        par_chauffeur.setdefault(ligne["chauffeur_id"], []).append(ligne["distance_km"] or 0)
    return par_chauffeur


async def creer(champs: dict, cx: Executeur = db) -> int:
    return await base.inserer(TABLE, champs, cx)


async def modifier(id: int, champs: dict, cx: Executeur = db) -> None:
    await base.modifier(TABLE, id, champs, cx)


async def cloturer(id: int, cout_carburant: float, cx: Executeur) -> None:
    """Passage à terminée : retour réel à l'heure du serveur MySQL (fuseau de l'application)."""
    await cx.execute(
        "UPDATE missions SET statut = 'terminee', date_retour_reelle = NOW(), cout_carburant = %s WHERE id = %s",
        [cout_carburant, id],
    )


async def supprimer(id: int, cx: Executeur = db) -> None:
    await base.supprimer(TABLE, id, cx)


async def detacher_client(client_id: int, cx: Executeur) -> None:
    await cx.execute("UPDATE missions SET client_id = NULL WHERE client_id = %s", [client_id])
