// Contrôleur dashboard — agrège les statistiques globales de la flotte
const db = require('../config/db');

/**
 * GET /api/dashboard/stats
 * Retourne en une seule passe toutes les métriques affichées sur le tableau de bord.
 */
const getStats = async (req, res) => {
  try {
    // Compteurs véhicules par statut
    const [vehiculesStats] = await db.query(`
      SELECT
        COUNT(*) AS totalVehicules,
        SUM(statut = 'disponible') AS vehiculesDisponibles,
        SUM(statut = 'en_mission') AS vehiculesEnMission,
        SUM(statut = 'en_panne')   AS vehiculesEnPanne,
        SUM(statut = 'maintenance') AS vehiculesMaintenance
      FROM vehicules
    `);

    // Compteurs missions
    const [missionsStats] = await db.query(`
      SELECT
        SUM(statut = 'en_cours') AS missionsEnCours,
        SUM(statut = 'planifiee') AS missionsPlanifiees,
        SUM(
          statut = 'planifiee'
          AND DATE(date_depart) = CURDATE()
        ) AS missionsAujourdhui,
        SUM(
          statut = 'terminee'
          AND YEAR(date_retour_reelle)  = YEAR(NOW())
          AND MONTH(date_retour_reelle) = MONTH(NOW())
        ) AS missionsTermineesThisMois,
        SUM(
          statut = 'terminee'
          AND YEAR(date_retour_reelle)  = YEAR(NOW())
          AND MONTH(date_retour_reelle) = MONTH(NOW())
          AND cout_carburant IS NOT NULL
        ) AS nbAvecCout,
        IFNULL(SUM(
          CASE
            WHEN statut = 'terminee'
              AND YEAR(date_retour_reelle)  = YEAR(NOW())
              AND MONTH(date_retour_reelle) = MONTH(NOW())
            THEN cout_carburant ELSE 0
          END
        ), 0) AS coutTotalMois
      FROM missions
    `);

    // Alertes non lues
    const [alertesStats] = await db.query(`
      SELECT COUNT(*) AS alertesMaintenance FROM alertes WHERE est_lue = FALSE
    `);

    // Documents expirés ou expirant dans les 30 prochains jours
    const [documentsStats] = await db.query(`
      SELECT COUNT(*) AS documentsExpires
      FROM documents
      WHERE date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `);

    // Missions par semaine sur les 4 dernières semaines
    const [missionsParSemaine] = await db.query(`
      SELECT
        WEEK(date_depart, 1) AS semaine_num,
        COUNT(*) AS count,
        MIN(DATE(date_depart)) AS debut_semaine
      FROM missions
      WHERE date_depart >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
      GROUP BY WEEK(date_depart, 1)
      ORDER BY semaine_num ASC
      LIMIT 4
    `);

    // Formatage des semaines pour le graphique
    const semaines = missionsParSemaine.map((row, index) => ({
      semaine: `Sem ${index + 1}`,
      count: row.count
    }));

    // 5 dernières alertes non lues
    const [dernieresAlertes] = await db.query(`
      SELECT a.*, v.immatriculation, v.marque
      FROM alertes a
      JOIN vehicules v ON a.vehicule_id = v.id
      WHERE a.est_lue = FALSE
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

    // Véhicules en mission pour la carte
    const [vehiculesEnMission] = await db.query(`
      SELECT
        v.id, v.immatriculation, v.marque, v.modele,
        m.lieu_destination, m.titre,
        c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
      FROM vehicules v
      JOIN missions m ON m.vehicule_id = v.id AND m.statut = 'en_cours'
      JOIN chauffeurs c ON m.chauffeur_id = c.id
    `);

    return res.json({
      totalVehicules:           vehiculesStats[0].totalVehicules       || 0,
      vehiculesDisponibles:     vehiculesStats[0].vehiculesDisponibles || 0,
      vehiculesEnMission:       vehiculesStats[0].vehiculesEnMission   || 0,
      vehiculesEnPanne:         vehiculesStats[0].vehiculesEnPanne     || 0,
      vehiculesMaintenance:     vehiculesStats[0].vehiculesMaintenance || 0,
      missionsEnCours:          missionsStats[0].missionsEnCours       || 0,
      missionsPlanifiees:       missionsStats[0].missionsPlanifiees    || 0,
      missionsAujourdhui:       missionsStats[0].missionsAujourdhui    || 0,
      missionsTermineesThisMois:missionsStats[0].missionsTermineesThisMois || 0,
      coutTotalMois:            parseFloat(missionsStats[0].coutTotalMois) || 0,
      alertesMaintenance:       alertesStats[0].alertesMaintenance     || 0,
      documentsExpires:         documentsStats[0].documentsExpires     || 0,
      missionsParSemaine:       semaines,
      dernieresAlertes,
      vehiculesEnMissionCarte:  vehiculesEnMission
    });

  } catch (err) {
    console.error('Erreur getStats dashboard :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getStats };
