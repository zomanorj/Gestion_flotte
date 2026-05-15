/**
 * maintenanceController.js
 * Contrôleur HTTP pour la maintenance préventive — TransiFlow.
 * Règle métier : terminer une maintenance crée automatiquement la prochaine.
 */

const maintenanceModel = require('../models/maintenanceModel')
const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// getMaintenances
// ─────────────────────────────────────────────────────────────────────────────

async function getMaintenances(req, res) {
  try {
    const { vehicle_id, statut, type, page = 1, limit = 20 } = req.query
    const { rows, total } = await maintenanceModel.findAll({
      vehicle_id: vehicle_id ? parseInt(vehicle_id) : undefined,
      statut, type,
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
    console.error('❌ maintenanceController.getMaintenances :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMaintenance
// ─────────────────────────────────────────────────────────────────────────────

async function getMaintenance(req, res) {
  try {
    const m = await maintenanceModel.findById(parseInt(req.params.id))
    if (!m) return res.status(404).json({ succes: false, message: 'Maintenance introuvable' })
    res.json({ succes: true, donnees: m })
  } catch (err) {
    console.error('❌ maintenanceController.getMaintenance :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMaintenancesUrgentes
// ─────────────────────────────────────────────────────────────────────────────

async function getMaintenancesUrgentes(req, res) {
  try {
    const urgentes = await maintenanceModel.getMaintenancesUrgentes()
    res.json({ succes: true, donnees: urgentes })
  } catch (err) {
    console.error('❌ maintenanceController.getMaintenancesUrgentes :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createMaintenance
// ─────────────────────────────────────────────────────────────────────────────

async function createMaintenance(req, res) {
  try {
    const { vehicle_id, type_maintenance, date_planifiee,
            kilometrage_planifie, garage, description } = req.body

    const typesAutorises = ['revision','vidange','pneus','freins','courroie','filtres','autre']
    if (!vehicle_id) {
      return res.status(400).json({ succes: false, message: 'Le véhicule est obligatoire' })
    }
    if (!type_maintenance || !typesAutorises.includes(type_maintenance)) {
      return res.status(400).json({ succes: false, message: 'Type de maintenance invalide' })
    }

    const m = await maintenanceModel.create({
      vehicle_id: parseInt(vehicle_id),
      type_maintenance, date_planifiee,
      kilometrage_planifie: kilometrage_planifie ? parseInt(kilometrage_planifie) : undefined,
      garage, description, created_by: req.user.id,
    })

    res.status(201).json({ succes: true, donnees: m, message: 'Maintenance planifiée' })
  } catch (err) {
    console.error('❌ maintenanceController.createMaintenance :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateMaintenance
// ─────────────────────────────────────────────────────────────────────────────

async function updateMaintenance(req, res) {
  try {
    const m = await maintenanceModel.update(parseInt(req.params.id), req.body)
    if (!m) return res.status(404).json({ succes: false, message: 'Maintenance introuvable' })
    res.json({ succes: true, donnees: m, message: 'Maintenance modifiée' })
  } catch (err) {
    console.error('❌ maintenanceController.updateMaintenance :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// terminerMaintenance
// Marque terminée + crée automatiquement la prochaine planification.
// ─────────────────────────────────────────────────────────────────────────────

async function terminerMaintenance(req, res) {
  try {
    const { date_realisee, cout, kilometrage_realise, pieces_changees,
            garage, prochaine_maintenance_km, prochaine_maintenance_date,
            planifier_prochaine = true } = req.body

    const m = await maintenanceModel.terminer(parseInt(req.params.id), {
      date_realisee, cout, kilometrage_realise,
      pieces_changees: pieces_changees || [],
      garage, prochaine_maintenance_km, prochaine_maintenance_date,
      planifier_prochaine,
    })

    if (!m) return res.status(404).json({ succes: false, message: 'Maintenance introuvable' })

    // Remettre le véhicule en 'actif' si nécessaire
    if (m.vehicle_id) {
      await pool.query(
        `UPDATE vehicles SET statut = 'actif' WHERE id = $1 AND statut = 'en_revision'`,
        [m.vehicle_id]
      )
    }

    res.json({ succes: true, donnees: m, message: 'Maintenance terminée avec succès' })
  } catch (err) {
    console.error('❌ maintenanceController.terminerMaintenance :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getHistorique
// ─────────────────────────────────────────────────────────────────────────────

async function getHistorique(req, res) {
  try {
    const historique = await maintenanceModel.getHistorique(parseInt(req.params.id))
    res.json({ succes: true, donnees: historique })
  } catch (err) {
    console.error('❌ maintenanceController.getHistorique :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

module.exports = {
  getMaintenances, getMaintenance, getMaintenancesUrgentes,
  createMaintenance, updateMaintenance, terminerMaintenance, getHistorique,
}
