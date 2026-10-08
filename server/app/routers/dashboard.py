# Routes dashboard — agrège les statistiques globales de la flotte
from fastapi import APIRouter

from .. import db
from ..auth import Connecte

router = APIRouter()


@router.get("/stats", dependencies=[Connecte])
async def get_stats():
    """Toutes les métriques affichées sur le tableau de bord, en une seule passe."""
    vehicules = await db.query_one("""
        SELECT
          COUNT(*) AS totalVehicules,
          SUM(statut = 'disponible')  AS vehiculesDisponibles,
          SUM(statut = 'en_mission')  AS vehiculesEnMission,
          SUM(statut = 'en_panne')    AS vehiculesEnPanne,
          SUM(statut = 'maintenance') AS vehiculesMaintenance
        FROM vehicules
    """)

    missions = await db.query_one("""
        SELECT
          SUM(statut = 'en_cours')  AS missionsEnCours,
          SUM(statut = 'planifiee') AS missionsPlanifiees,
          SUM(statut = 'planifiee' AND DATE(date_depart) = CURDATE()) AS missionsAujourdhui,
          SUM(
            statut = 'terminee'
            AND YEAR(date_retour_reelle)  = YEAR(NOW())
            AND MONTH(date_retour_reelle) = MONTH(NOW())
          ) AS missionsTermineesThisMois,
          IFNULL(SUM(
            CASE
              WHEN statut = 'terminee'
                AND YEAR(date_retour_reelle)  = YEAR(NOW())
                AND MONTH(date_retour_reelle) = MONTH(NOW())
              THEN cout_carburant ELSE 0
            END
          ), 0) AS coutTotalMois
        FROM missions
    """)

    # Alertes non lues
    alertes = await db.query_one("SELECT COUNT(*) AS alertesMaintenance FROM alertes WHERE est_lue = FALSE")

    # Documents expirés ou expirant dans les 30 prochains jours
    documents = await db.query_one("""
        SELECT COUNT(*) AS documentsExpires
        FROM documents
        WHERE date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    """)

    # Missions par semaine sur les 4 dernières semaines
    par_semaine = await db.query("""
        SELECT
          WEEK(date_depart, 1) AS semaine_num,
          COUNT(*) AS count,
          MIN(DATE(date_depart)) AS debut_semaine
        FROM missions
        WHERE date_depart >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
        GROUP BY WEEK(date_depart, 1)
        ORDER BY semaine_num ASC
        LIMIT 4
    """)

    # 5 dernières alertes non lues
    dernieres_alertes = await db.query("""
        SELECT a.*, v.immatriculation, v.marque
        FROM alertes a
        JOIN vehicules v ON a.vehicule_id = v.id
        WHERE a.est_lue = FALSE
        ORDER BY a.created_at DESC
        LIMIT 5
    """)

    # Véhicules en mission pour la carte
    en_mission = await db.query("""
        SELECT
          v.id, v.immatriculation, v.marque, v.modele,
          m.lieu_destination, m.titre,
          c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM vehicules v
        JOIN missions m ON m.vehicule_id = v.id AND m.statut = 'en_cours'
        JOIN chauffeurs c ON m.chauffeur_id = c.id
    """)

    return {
        "totalVehicules":            vehicules["totalVehicules"] or 0,
        "vehiculesDisponibles":      vehicules["vehiculesDisponibles"] or 0,
        "vehiculesEnMission":        vehicules["vehiculesEnMission"] or 0,
        "vehiculesEnPanne":          vehicules["vehiculesEnPanne"] or 0,
        "vehiculesMaintenance":      vehicules["vehiculesMaintenance"] or 0,
        "missionsEnCours":           missions["missionsEnCours"] or 0,
        "missionsPlanifiees":        missions["missionsPlanifiees"] or 0,
        "missionsAujourdhui":        missions["missionsAujourdhui"] or 0,
        "missionsTermineesThisMois": missions["missionsTermineesThisMois"] or 0,
        "coutTotalMois":             missions["coutTotalMois"] or 0,
        "alertesMaintenance":        alertes["alertesMaintenance"] or 0,
        "documentsExpires":          documents["documentsExpires"] or 0,
        "missionsParSemaine":        [
            {"semaine": f"Sem {i + 1}", "count": row["count"]} for i, row in enumerate(par_semaine)
        ],
        "dernieresAlertes":          dernieres_alertes,
        "vehiculesEnMissionCarte":   en_mission,
    }
