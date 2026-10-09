# Accès aux données : indicateurs agrégés du tableau de bord
# Requêtes indépendantes les unes des autres : le service les exécute en parallèle.
from .. import db


async def compteurs_vehicules() -> dict:
    return await db.query_one("""
        SELECT COUNT(*) AS totalVehicules,
               SUM(statut = 'disponible')  AS vehiculesDisponibles,
               SUM(statut = 'en_mission')  AS vehiculesEnMission,
               SUM(statut = 'en_panne')    AS vehiculesEnPanne,
               SUM(statut = 'maintenance') AS vehiculesMaintenance
        FROM vehicules
    """)


async def compteurs_missions() -> dict:
    return await db.query_one("""
        SELECT SUM(statut = 'en_cours')  AS missionsEnCours,
               SUM(statut = 'planifiee') AS missionsPlanifiees,
               SUM(statut = 'planifiee' AND DATE(date_depart) = CURDATE()) AS missionsAujourdhui,
               SUM(statut = 'terminee'
                   AND YEAR(date_retour_reelle) = YEAR(NOW())
                   AND MONTH(date_retour_reelle) = MONTH(NOW())) AS missionsTermineesThisMois,
               IFNULL(SUM(CASE WHEN statut = 'terminee'
                                AND YEAR(date_retour_reelle) = YEAR(NOW())
                                AND MONTH(date_retour_reelle) = MONTH(NOW())
                           THEN cout_carburant ELSE 0 END), 0) AS coutTotalMois
        FROM missions
    """)


async def nombre_alertes_non_lues() -> int:
    ligne = await db.query_one("SELECT COUNT(*) AS nb FROM alertes WHERE est_lue = FALSE")
    return int(ligne["nb"])


async def nombre_documents_a_renouveler(jours: int) -> int:
    ligne = await db.query_one(
        "SELECT COUNT(*) AS nb FROM documents WHERE date_expiration <= DATE_ADD(CURDATE(), INTERVAL %s DAY)", [jours]
    )
    return int(ligne["nb"])


async def missions_par_semaine(semaines: int = 4) -> list[dict]:
    return await db.query("""
        SELECT WEEK(date_depart, 1) AS semaine_num, COUNT(*) AS count, MIN(DATE(date_depart)) AS debut_semaine
        FROM missions
        WHERE date_depart >= DATE_SUB(NOW(), INTERVAL %s WEEK)
        GROUP BY WEEK(date_depart, 1)
        ORDER BY semaine_num ASC
        LIMIT %s
    """, [semaines, semaines])


async def dernieres_alertes(nombre: int = 5) -> list[dict]:
    return await db.query("""
        SELECT a.*, v.immatriculation, v.marque
        FROM alertes a
        JOIN vehicules v ON a.vehicule_id = v.id
        WHERE a.est_lue = FALSE
        ORDER BY a.created_at DESC
        LIMIT %s
    """, [nombre])


async def vehicules_en_mission() -> list[dict]:
    return await db.query("""
        SELECT v.id, v.immatriculation, v.marque, v.modele, m.lieu_destination, m.titre,
               c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM vehicules v
        JOIN missions m ON m.vehicule_id = v.id AND m.statut = 'en_cours'
        JOIN chauffeurs c ON m.chauffeur_id = c.id
    """)
