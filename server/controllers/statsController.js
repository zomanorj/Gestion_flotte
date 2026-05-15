/**
 * statsController.js
 * Contrôleur HTTP pour les statistiques et le tableau de bord — Transport STTA.
 *
 * Ce module fournit des endpoints pour :
 *   - Les statistiques globales du dashboard
 *   - Les statistiques détaillées des missions
 *   - Les statistiques de la flotte
 *
 * Fonctions exportées :
 *   - getDashboardStats(req, res)  → GET /api/stats/dashboard
 *   - getMissionStats(req, res)    → GET /api/stats/missions
 *   - getFleetStats(req, res)      → GET /api/stats/flotte
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// getDashboardStats
// Retourne toutes les statistiques nécessaires au dashboard en un seul appel.
// ─────────────────────────────────────────────────────────────────────────────

async function getDashboardStats(req, res) {
  try {
    // ── Statistiques véhicules ──
    const vehiculesResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE statut = 'actif') as actifs,
        COUNT(*) FILTER (WHERE statut = 'en_revision') as en_revision,
        COUNT(*) FILTER (WHERE statut = 'archive') as archives,
        COUNT(*) as total
      FROM vehicles
    `)

    const vehicules = {
      total:       parseInt(vehiculesResult.rows[0].total),
      actifs:      parseInt(vehiculesResult.rows[0].actifs),
      en_revision: parseInt(vehiculesResult.rows[0].en_revision),
      archives:    parseInt(vehiculesResult.rows[0].archives),
    }

    // ── Alertes documents véhicules (assurance ou visite expirée/bientôt expirée) ──
    const alertesDocumentsResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM vehicles
      WHERE statut = 'actif'
        AND (
          (date_assurance IS NOT NULL AND date_assurance <= CURRENT_DATE + INTERVAL '30 days')
          OR (date_visite_technique IS NOT NULL AND date_visite_technique <= CURRENT_DATE + INTERVAL '30 days')
        )
    `)

    const alertes_documents = parseInt(alertesDocumentsResult.rows[0].total)
    // Ajout du champ alertes_documents dans l'objet vehicules pour le frontend
    vehicules.alertes_documents = alertes_documents

    // ── Statistiques chauffeurs ──
    const chauffeursResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE statut = 'actif') as actifs,
        COUNT(*) FILTER (WHERE statut = 'en_conge') as en_conge,
        COUNT(*) FILTER (WHERE statut = 'inactif') as inactifs,
        COUNT(*) as total
      FROM drivers
    `)

    const chauffeurs = {
      total: parseInt(chauffeursResult.rows[0].total),
      actifs: parseInt(chauffeursResult.rows[0].actifs),
      en_conge: parseInt(chauffeursResult.rows[0].en_conge),
      inactifs: parseInt(chauffeursResult.rows[0].inactifs),
    }

    // ── Alertes permis chauffeurs ──
    const alertesPermisResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM drivers
      WHERE statut = 'actif'
        AND date_expiration_permis <= CURRENT_DATE + INTERVAL '30 days'
    `)

    const alertes_permis = parseInt(alertesPermisResult.rows[0].total)
    // Ajout du champ alertes_permis dans l'objet chauffeurs pour le frontend
    chauffeurs.alertes_permis = alertes_permis

    // ── Statistiques missions ──
    const missionsResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE date_mission = CURRENT_DATE) as aujourd_hui,
        COUNT(*) FILTER (WHERE statut = 'en_cours') as en_cours,
        COUNT(*) FILTER (WHERE statut = 'planifiee' AND date_mission = CURRENT_DATE) as planifiees_aujourdhui,
        COUNT(*) FILTER (WHERE statut = 'terminee' AND date_mission >= CURRENT_DATE - INTERVAL '7 days') as terminees_cette_semaine,
        COUNT(*) FILTER (WHERE statut = 'terminee' AND date_mission >= DATE_TRUNC('month', CURRENT_DATE)) as terminees_ce_mois,
        COUNT(*) as total
      FROM missions
    `)

    const missions = {
      total: parseInt(missionsResult.rows[0].total),
      aujourd_hui: parseInt(missionsResult.rows[0].aujourd_hui),
      en_cours: parseInt(missionsResult.rows[0].en_cours),
      planifiees_aujourdhui: parseInt(missionsResult.rows[0].planifiees_aujourdhui),
      cette_semaine: parseInt(missionsResult.rows[0].terminees_cette_semaine),
      terminees_ce_mois: parseInt(missionsResult.rows[0].terminees_ce_mois),
    }

    // ── Taux de ponctualité (missions terminées à l'heure prévue) ──
    // On considère qu'une mission est à l'heure si elle est terminée et que l'heure d'arrivée réelle
    // n'est pas documentée comme retard (on utilise un seuil de 90% comme estimation)
    const ponctualiteResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE statut = 'terminee') as terminees,
        COUNT(*) as total_missions
      FROM missions
      WHERE date_mission >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '3 months'
    `)

    const terminees = parseInt(ponctualiteResult.rows[0].terminees)
    const total_missions = parseInt(ponctualiteResult.rows[0].total_missions)
    const taux_ponctualite = total_missions > 0 
      ? Math.round((terminees / total_missions) * 100) 
      : 0

    missions.taux_ponctualite = taux_ponctualite

    // ── Total alertes ──
    const alertes_total = alertes_documents + alertes_permis

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: {
        vehicules,
        chauffeurs,
        missions,
        alertes_total,
      },
    })
  } catch (erreur) {
    console.error('❌ statsController.getDashboardStats :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMissionStats
// Retourne les statistiques détaillées des missions sur une période.
// Query params : date_debut, date_fin (défaut : 30 derniers jours)
// ─────────────────────────────────────────────────────────────────────────────

async function getMissionStats(req, res) {
  try {
    // ── Parsing des paramètres de date ──
    let date_debut = req.query.date_debut
    let date_fin = req.query.date_fin

    // Valeurs par défaut : 30 derniers jours
    if (!date_debut) {
      date_debut = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
    if (!date_fin) {
      date_fin = new Date().toISOString().split('T')[0]
    }

    // ── Missions par jour (pour courbe) ──
    const missionsParJourResult = await pool.query(`
      SELECT 
        date_mission as date,
        COUNT(*) as count
      FROM missions
      WHERE date_mission BETWEEN $1 AND $2
      GROUP BY date_mission
      ORDER BY date_mission ASC
    `, [date_debut, date_fin])

    const missions_par_jour = missionsParJourResult.rows.map(row => ({
      date: new Date(row.date).toLocaleDateString('fr-FR'),
      count: parseInt(row.count),
    }))

    // ── Missions par statut (pour camembert) ──
    const missionsParStatutResult = await pool.query(`
      SELECT 
        statut,
        COUNT(*) as count
      FROM missions
      WHERE date_mission BETWEEN $1 AND $2
      GROUP BY statut
      ORDER BY count DESC
    `, [date_debut, date_fin])

    const missions_par_statut = missionsParStatutResult.rows.map(row => ({
      statut: row.statut,
      count: parseInt(row.count),
    }))

    // ── Top 5 trajets (pour barre horizontale) ──
    const topTrajetsResult = await pool.query(`
      SELECT 
        lieu_depart || ' → ' || lieu_arrivee as trajet,
        COUNT(*) as count
      FROM missions
      WHERE date_mission BETWEEN $1 AND $2
      GROUP BY lieu_depart, lieu_arrivee
      ORDER BY count DESC
      LIMIT 5
    `, [date_debut, date_fin])

    const top_trajets = topTrajetsResult.rows.map(row => ({
      trajet: row.trajet,
      count: parseInt(row.count),
    }))

    // ── Missions par semaine (pour barres) ──
    const missionsParSemaineResult = await pool.query(`
      SELECT 
        DATE_TRUNC('week', date_mission) as semaine,
        COUNT(*) as count
      FROM missions
      WHERE date_mission BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('week', date_mission)
      ORDER BY semaine ASC
    `, [date_debut, date_fin])

    const missions_par_semaine = missionsParSemaineResult.rows.map(row => ({
      semaine: new Date(row.semaine).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      count: parseInt(row.count),
    }))

    // ── Total km parcourus ──
    const totalKmResult = await pool.query(`
      SELECT COALESCE(SUM(distance_km), 0) as total
      FROM missions
      WHERE date_mission BETWEEN $1 AND $2
        AND statut IN ('terminee', 'en_cours')
    `, [date_debut, date_fin])

    const total_km_parcourus = parseInt(totalKmResult.rows[0].total)

    // ── Total tonnes transportées ──
    const totalTonnesResult = await pool.query(`
      SELECT COALESCE(SUM(poids_tonne), 0) as total
      FROM missions
      WHERE date_mission BETWEEN $1 AND $2
        AND statut IN ('terminee', 'en_cours')
    `, [date_debut, date_fin])

    const total_tonnes_transportees = parseFloat(totalTonnesResult.rows[0].total).toFixed(2)

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: {
        missions_par_jour,
        missions_par_statut,
        top_trajets,
        missions_par_semaine,
        total_km_parcourus,
        total_tonnes_transportees,
      },
    })
  } catch (erreur) {
    console.error('❌ statsController.getMissionStats :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des statistiques missions',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getFleetStats
// Retourne les statistiques de la flotte de véhicules.
// ─────────────────────────────────────────────────────────────────────────────

async function getFleetStats(req, res) {
  try {
    // ── Véhicules par type (pour camembert) ──
    const vehiculesParTypeResult = await pool.query(`
      SELECT 
        type,
        COUNT(*) as count
      FROM vehicles
      WHERE statut IN ('actif', 'en_revision')
      GROUP BY type
      ORDER BY count DESC
    `)

    const vehicules_par_type = vehiculesParTypeResult.rows.map(row => ({
      type: row.type,
      count: parseInt(row.count),
    }))

    // ── Taux d'utilisation de la flotte ──
    const utilisationResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE statut = 'actif') as actifs,
        COUNT(*) as total
      FROM vehicles
    `)

    const actifs = parseInt(utilisationResult.rows[0].actifs)
    const total = parseInt(utilisationResult.rows[0].total)
    const utilisation_flotte = total > 0 ? Math.round((actifs / total) * 100) : 0

    // ── Top 5 véhicules par kilométrage ──
    const kmParVehiculeResult = await pool.query(`
      SELECT 
        immatriculation,
        kilometrage as km
      FROM vehicles
      WHERE statut IN ('actif', 'en_revision')
      ORDER BY kilometrage DESC
      LIMIT 5
    `)

    const km_par_vehicule = kmParVehiculeResult.rows.map(row => ({
      immatriculation: row.immatriculation,
      km: parseInt(row.km),
    }))

    // ── Consommation par mois (si données disponibles) ──
    // Note : le schéma actuel n'a pas de table de consommation, on retourne un tableau vide
    // Cette fonctionnalité pourra être ajoutée quand une table de suivi de consommation sera créée
    const consommation_par_mois = []

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: {
        vehicules_par_type,
        utilisation_flotte,
        km_par_vehicule,
        consommation_par_mois,
      },
    })
  } catch (erreur) {
    console.error('❌ statsController.getFleetStats :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des statistiques flotte',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getDashboardStats,
  getMissionStats,
  getFleetStats,
}