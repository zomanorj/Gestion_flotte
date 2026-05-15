/**
 * incidentController.js
 * Contrôleur HTTP pour les incidents — TransiFlow.
 *
 * Règle métier :
 *   Incident critique/grave → véhicule passe en 'en_revision'
 *                            + maintenance corrective créée auto.
 */

const incidentModel    = require('../models/incidentModel')
const maintenanceModel = require('../models/maintenanceModel')
const pool             = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// getIncidents
// ─────────────────────────────────────────────────────────────────────────────

async function getIncidents(req, res) {
  try {
    const { statut, gravite, type, vehicle_id, driver_id,
            date_debut, date_fin, page = 1, limit = 20 } = req.query
    const { rows, total } = await incidentModel.findAll({
      statut, gravite, type,
      vehicle_id: vehicle_id ? parseInt(vehicle_id) : undefined,
      driver_id:  driver_id  ? parseInt(driver_id)  : undefined,
      date_debut, date_fin,
      page: parseInt(page), limit: parseInt(limit),
    })

    const totalPages = Math.ceil(total / parseInt(limit))
    res.json({
      succes: true,
      donnees: rows,
      pagination: {
        page: parseInt(page), limit: parseInt(limit), total, totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    })
  } catch (err) {
    console.error('❌ incidentController.getIncidents :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getIncident
// ─────────────────────────────────────────────────────────────────────────────

async function getIncident(req, res) {
  try {
    const incident = await incidentModel.findById(parseInt(req.params.id))
    if (!incident) return res.status(404).json({ succes: false, message: 'Incident introuvable' })
    res.json({ succes: true, donnees: incident })
  } catch (err) {
    console.error('❌ incidentController.getIncident :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getIncidentsOuverts
// ─────────────────────────────────────────────────────────────────────────────

async function getIncidentsOuverts(req, res) {
  try {
    const incidents = await incidentModel.getIncidentsOuverts()
    res.json({ succes: true, donnees: incidents })
  } catch (err) {
    console.error('❌ incidentController.getIncidentsOuverts :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createIncident
// ─────────────────────────────────────────────────────────────────────────────

async function createIncident(req, res) {
  try {
    const { vehicle_id, type_incident, gravite, titre } = req.body

    if (!vehicle_id) {
      return res.status(400).json({ succes: false, message: 'Le véhicule est obligatoire' })
    }
    if (!titre?.trim()) {
      return res.status(400).json({ succes: false, message: 'Le titre est obligatoire' })
    }
    if (!type_incident) {
      return res.status(400).json({ succes: false, message: 'Le type d\'incident est obligatoire' })
    }

    const incident = await incidentModel.create({
      ...req.body,
      declared_by: req.user.id,
    })

    // Règle métier : incident critique ou grave → véhicule en révision
    if (gravite === 'critique' || gravite === 'grave') {
      await pool.query(
        `UPDATE vehicles SET statut = 'en_revision' WHERE id = $1`,
        [parseInt(vehicle_id)]
      )
      // Créer une maintenance corrective automatique
      await maintenanceModel.create({
        vehicle_id: parseInt(vehicle_id),
        type_maintenance: 'autre',
        description: `Maintenance corrective suite à incident #${incident.id} : ${titre}`,
        created_by: req.user.id,
      })
    }

    res.status(201).json({
      succes: true, donnees: incident,
      message: gravite === 'critique'
        ? 'Incident déclaré. Le véhicule a été mis en révision automatiquement.'
        : 'Incident déclaré avec succès',
    })
  } catch (err) {
    console.error('❌ incidentController.createIncident :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateIncident
// ─────────────────────────────────────────────────────────────────────────────

async function updateIncident(req, res) {
  try {
    const incident = await incidentModel.update(parseInt(req.params.id), req.body)
    if (!incident) return res.status(404).json({ succes: false, message: 'Incident introuvable' })
    res.json({ succes: true, donnees: incident, message: 'Incident modifié' })
  } catch (err) {
    console.error('❌ incidentController.updateIncident :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// resoudreIncident
// ─────────────────────────────────────────────────────────────────────────────

async function resoudreIncident(req, res) {
  try {
    const { actions_prises, cout_reparation, date_resolution, remettre_en_service } = req.body

    if (!actions_prises?.trim()) {
      return res.status(400).json({ succes: false, message: 'Les actions prises sont obligatoires' })
    }

    const incident = await incidentModel.resoudre(parseInt(req.params.id), {
      actions_prises, cout_reparation, date_resolution,
      resolved_by: req.user.id,
    })
    if (!incident) return res.status(404).json({ succes: false, message: 'Incident introuvable' })

    // Remettre le véhicule en service si demandé
    if (remettre_en_service && incident.vehicle_id) {
      await pool.query(
        `UPDATE vehicles SET statut = 'actif' WHERE id = $1 AND statut = 'en_revision'`,
        [incident.vehicle_id]
      )
    }

    res.json({ succes: true, donnees: incident, message: 'Incident résolu avec succès' })
  } catch (err) {
    console.error('❌ incidentController.resoudreIncident :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// cloreIncident
// ─────────────────────────────────────────────────────────────────────────────

async function cloreIncident(req, res) {
  try {
    const incident = await incidentModel.clore(parseInt(req.params.id))
    if (!incident) return res.status(404).json({ succes: false, message: 'Incident introuvable' })
    res.json({ succes: true, donnees: incident, message: 'Incident clos définitivement' })
  } catch (err) {
    console.error('❌ incidentController.cloreIncident :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getStats
// ─────────────────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    const { date_debut, date_fin } = req.query
    const stats = await incidentModel.getStats(date_debut, date_fin)
    res.json({ succes: true, donnees: stats })
  } catch (err) {
    console.error('❌ incidentController.getStats :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

module.exports = {
  getIncidents, getIncident, getIncidentsOuverts,
  createIncident, updateIncident, resoudreIncident, cloreIncident, getStats,
}
