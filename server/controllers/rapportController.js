/**
 * rapportController.js
 * Contrôleur HTTP pour les rapports avancés — TransiFlow.
 *
 * Fonctions exportées :
 *   - getRentabiliteMissions    : rentabilité par mission (admin, gestionnaire)
 *   - getPerformanceChauffeurs  : performance des chauffeurs (admin, gestionnaire)
 *   - getUtilisationFlotte      : taux d'utilisation des véhicules (admin, gestionnaire)
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// getRentabiliteMissions
// Calcule la rentabilité de chaque mission terminée sur une période.
// Revenu = total factures payées ou envoyées
// Coûts  = dépenses + salaires
// Marge  = revenu - coûts_total
// ─────────────────────────────────────────────────────────────────────────────

async function getRentabiliteMissions(req, res) {
  try {
    const { date_debut, date_fin } = req.query

    if (!date_debut || !date_fin) {
      return res.status(400).json({ succes: false, message: 'Les paramètres date_debut et date_fin sont requis' })
    }

    const query = `
      SELECT
        m.id,
        m.lieu_depart,
        m.lieu_arrivee,
        m.date_mission,
        m.distance_km,
        COALESCE(
          (SELECT SUM(f.montant_ttc) FROM factures f
           WHERE f.mission_id = m.id AND f.statut IN ('payee', 'envoyee')), 0
        ) AS revenu,
        COALESCE(
          (SELECT SUM(d.montant) FROM depenses d
           WHERE d.mission_id = m.id), 0
        ) AS couts_depenses,
        COALESCE(
          (SELECT SUM(s.montant) FROM salaires s
           WHERE s.mission_id = m.id), 0
        ) AS cout_salaire
      FROM missions m
      WHERE m.statut = 'terminee'
        AND m.deleted_at IS NULL
        AND m.date_mission BETWEEN $1 AND $2
      ORDER BY m.date_mission DESC
    `

    const result = await pool.query(query, [date_debut, date_fin])

    // Calculer les indicateurs de rentabilité pour chaque mission
    const missions = result.rows.map(row => {
      const revenu       = parseFloat(row.revenu)       || 0
      const coutsTotal   = (parseFloat(row.couts_depenses) || 0) + (parseFloat(row.cout_salaire) || 0)
      const marge        = revenu - coutsTotal
      const margePct     = revenu > 0 ? (marge / revenu * 100) : 0

      return {
        id:              row.id,
        lieu_depart:     row.lieu_depart,
        lieu_arrivee:    row.lieu_arrivee,
        date_mission:    row.date_mission,
        distance_km:     row.distance_km,
        revenu,
        couts_depenses:  parseFloat(row.couts_depenses) || 0,
        cout_salaire:    parseFloat(row.cout_salaire)   || 0,
        couts_total:     coutsTotal,
        marge,
        marge_pct:       Math.round(margePct * 100) / 100,
      }
    })

    // Totaux globaux
    const totaux = missions.reduce((acc, m) => ({
      revenu_total:  acc.revenu_total  + m.revenu,
      couts_total:   acc.couts_total   + m.couts_total,
      marge_totale:  acc.marge_totale  + m.marge,
    }), { revenu_total: 0, couts_total: 0, marge_totale: 0 })

    totaux.marge_moyenne_pct = totaux.revenu_total > 0
      ? Math.round((totaux.marge_totale / totaux.revenu_total) * 100 * 100) / 100
      : 0

    res.json({ succes: true, donnees: { missions, totaux } })
  } catch (erreur) {
    console.error('❌ rapportController.getRentabiliteMissions :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors du calcul de la rentabilité' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPerformanceChauffeurs
// Calcule un score de performance pour chaque chauffeur sur une période.
// Note = (missions*30 + taux_ponctualite*40 + absence_incidents*30) / 10
// ─────────────────────────────────────────────────────────────────────────────

async function getPerformanceChauffeurs(req, res) {
  try {
    const { date_debut, date_fin } = req.query

    if (!date_debut || !date_fin) {
      return res.status(400).json({ succes: false, message: 'Les paramètres date_debut et date_fin sont requis' })
    }

    const query = `
      SELECT
        d.id            AS driver_id,
        d.nom           AS driver_nom,
        d.prenom        AS driver_prenom,
        d.photo_url,
        COUNT(m.id)     AS total_missions,
        COUNT(CASE WHEN m.statut = 'terminee' THEN 1 END) AS missions_terminees,
        COALESCE(SUM(m.distance_km), 0)                   AS distance_totale,
        (SELECT COUNT(*) FROM incidents i
         WHERE i.driver_id = d.id
           AND i.date_incident BETWEEN $1 AND $2) AS nb_incidents
      FROM drivers d
      LEFT JOIN missions m ON m.driver_id = d.id
        AND m.date_mission BETWEEN $1 AND $2
        AND m.deleted_at IS NULL
      WHERE d.deleted_at IS NULL
      GROUP BY d.id, d.nom, d.prenom, d.photo_url
      HAVING COUNT(m.id) > 0
      ORDER BY missions_terminees DESC
    `

    const result = await pool.query(query, [date_debut, date_fin])

    // Calculer le score de performance
    const chauffeurs = result.rows.map(row => {
      const totalMissions      = parseInt(row.total_missions,     10) || 0
      const missionsTerminees  = parseInt(row.missions_terminees, 10) || 0
      const nbIncidents        = parseInt(row.nb_incidents,       10) || 0
      const distanceTotale     = parseFloat(row.distance_totale)  || 0

      // Taux de ponctualité = missions terminées / total missions * 100
      const tauxPonctualite = totalMissions > 0
        ? Math.round((missionsTerminees / totalMissions) * 100)
        : 0

      // Taux d'absence d'incidents (100 si aucun incident, 0 si >5 incidents)
      const absenceIncidents = Math.max(0, 100 - (nbIncidents * 20))

      // Note globale /10
      const note = Math.round(
        (Math.min(totalMissions, 10) * 3   // missions : max 30 pts
        + tauxPonctualite * 0.4             // ponctualité : 40 pts
        + absenceIncidents * 0.3)           // incidents : 30 pts
      ) / 10

      return {
        driver_id:         row.driver_id,
        driver_nom:        row.driver_nom,
        driver_prenom:     row.driver_prenom,
        photo_url:         row.photo_url,
        total_missions:    totalMissions,
        missions_terminees: missionsTerminees,
        distance_totale:   Math.round(distanceTotale),
        nb_incidents:      nbIncidents,
        taux_ponctualite:  tauxPonctualite,
        note:              Math.min(10, Math.max(0, note)),
      }
    })

    res.json({ succes: true, donnees: chauffeurs })
  } catch (erreur) {
    console.error('❌ rapportController.getPerformanceChauffeurs :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors du calcul de la performance des chauffeurs' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getUtilisationFlotte
// Calcule le taux d'utilisation de chaque véhicule sur une période.
// Taux = jours_actifs / total_jours_periode * 100
// ─────────────────────────────────────────────────────────────────────────────

async function getUtilisationFlotte(req, res) {
  try {
    const { date_debut, date_fin } = req.query

    if (!date_debut || !date_fin) {
      return res.status(400).json({ succes: false, message: 'Les paramètres date_debut et date_fin sont requis' })
    }

    // Calculer le nombre de jours total de la période
    const debut      = new Date(date_debut)
    const fin        = new Date(date_fin)
    const joursTotal = Math.ceil((fin - debut) / (1000 * 60 * 60 * 24)) + 1

    const query = `
      SELECT
        v.id             AS vehicle_id,
        v.immatriculation,
        v.type,
        v.statut         AS vehicle_statut,
        COUNT(DISTINCT m.date_mission::date) AS jours_actifs,
        COUNT(m.id)                           AS total_missions,
        COALESCE(SUM(m.distance_km), 0)       AS distance_totale
      FROM vehicles v
      LEFT JOIN missions m ON m.vehicle_id = v.id
        AND m.date_mission BETWEEN $1 AND $2
        AND m.statut IN ('terminee', 'en_cours')
        AND m.deleted_at IS NULL
      WHERE v.deleted_at IS NULL
      GROUP BY v.id, v.immatriculation, v.type, v.statut
      ORDER BY jours_actifs DESC
    `

    const result = await pool.query(query, [date_debut, date_fin])

    const vehicules = result.rows.map(row => {
      const joursActifs    = parseInt(row.jours_actifs, 10)    || 0
      const totalMissions  = parseInt(row.total_missions, 10)  || 0
      const distanceTotale = parseFloat(row.distance_totale)   || 0
      const taux           = joursTotal > 0 ? Math.round((joursActifs / joursTotal) * 100) : 0

      return {
        vehicle_id:        row.vehicle_id,
        immatriculation:   row.immatriculation,
        type:              row.type,
        vehicle_statut:    row.vehicle_statut,
        jours_actifs:      joursActifs,
        jours_total:       joursTotal,
        total_missions:    totalMissions,
        distance_totale:   Math.round(distanceTotale),
        taux_utilisation:  taux,
      }
    })

    // Taux moyen de la flotte
    const tauxMoyen = vehicules.length > 0
      ? Math.round(vehicules.reduce((acc, v) => acc + v.taux_utilisation, 0) / vehicules.length)
      : 0

    res.json({
      succes: true,
      donnees: {
        vehicules,
        taux_moyen_flotte: tauxMoyen,
        jours_total:       joursTotal,
      },
    })
  } catch (erreur) {
    console.error('❌ rapportController.getUtilisationFlotte :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors du calcul de l\'utilisation de la flotte' })
  }
}

module.exports = {
  getRentabiliteMissions,
  getPerformanceChauffeurs,
  getUtilisationFlotte,
}
