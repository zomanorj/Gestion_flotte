/**
 * financeController.js
 * Contrôleur HTTP pour la gestion financière — TransiFlow.
 * Gère les dépenses par mission/véhicule et les budgets mensuels.
 */

const financeModel = require('../models/financeModel')

const CATEGORIES_AUTORISEES = ['carburant','peage','salaire','maintenance','autre']

// ─────────────────────────────────────────────────────────────────────────────
// getDepenses
// ─────────────────────────────────────────────────────────────────────────────

async function getDepenses(req, res) {
  try {
    const { mission_id, vehicle_id, categorie,
            date_debut, date_fin, page = 1, limit = 20 } = req.query
    const { rows, total } = await financeModel.getDepenses({
      mission_id: mission_id ? parseInt(mission_id) : undefined,
      vehicle_id: vehicle_id ? parseInt(vehicle_id) : undefined,
      categorie, date_debut, date_fin,
      page: parseInt(page), limit: parseInt(limit),
    })

    const totalPages = Math.ceil(total / parseInt(limit))
    res.json({
      succes: true,
      donnees: rows,
      pagination: {
        page: parseInt(page), limit: parseInt(limit),
        total, totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    })
  } catch (err) {
    console.error('❌ financeController.getDepenses :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getDepense
// ─────────────────────────────────────────────────────────────────────────────

async function getDepense(req, res) {
  try {
    const depense = await financeModel.getDepenseById(parseInt(req.params.id))
    if (!depense) return res.status(404).json({ succes: false, message: 'Dépense introuvable' })
    res.json({ succes: true, donnees: depense })
  } catch (err) {
    console.error('❌ financeController.getDepense :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createDepense
// ─────────────────────────────────────────────────────────────────────────────

async function createDepense(req, res) {
  try {
    const { mission_id, vehicle_id, categorie, montant, devise,
            description, date_depense, justificatif_url } = req.body

    if (!categorie || !CATEGORIES_AUTORISEES.includes(categorie)) {
      return res.status(400).json({ succes: false, message: 'Catégorie invalide' })
    }
    if (!montant || parseFloat(montant) <= 0) {
      return res.status(400).json({ succes: false, message: 'Le montant doit être positif' })
    }
    if (!date_depense) {
      return res.status(400).json({ succes: false, message: 'La date est obligatoire' })
    }
    if (new Date(date_depense) > new Date()) {
      return res.status(400).json({ succes: false, message: 'La date ne peut pas être dans le futur' })
    }

    const depense = await financeModel.createDepense({
      mission_id, vehicle_id, categorie,
      montant: parseFloat(montant), devise: devise || 'MGA',
      description, date_depense, justificatif_url,
      created_by: req.user.id,
    })

    res.status(201).json({ succes: true, donnees: depense, message: 'Dépense enregistrée' })
  } catch (err) {
    console.error('❌ financeController.createDepense :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateDepense
// ─────────────────────────────────────────────────────────────────────────────

async function updateDepense(req, res) {
  try {
    const { montant, date_depense } = req.body
    if (montant && parseFloat(montant) <= 0) {
      return res.status(400).json({ succes: false, message: 'Le montant doit être positif' })
    }
    if (date_depense && new Date(date_depense) > new Date()) {
      return res.status(400).json({ succes: false, message: 'Date dans le futur non autorisée' })
    }

    const depense = await financeModel.updateDepense(parseInt(req.params.id), req.body)
    if (!depense) return res.status(404).json({ succes: false, message: 'Dépense introuvable' })
    res.json({ succes: true, donnees: depense, message: 'Dépense modifiée' })
  } catch (err) {
    console.error('❌ financeController.updateDepense :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteDepense
// ─────────────────────────────────────────────────────────────────────────────

async function deleteDepense(req, res) {
  try {
    const deleted = await financeModel.deleteDepense(parseInt(req.params.id))
    if (!deleted) return res.status(404).json({ succes: false, message: 'Dépense introuvable' })
    res.json({ succes: true, message: 'Dépense supprimée' })
  } catch (err) {
    console.error('❌ financeController.deleteDepense :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getCoutMission
// ─────────────────────────────────────────────────────────────────────────────

async function getCoutMission(req, res) {
  try {
    const couts = await financeModel.getCoutMission(parseInt(req.params.id))
    res.json({ succes: true, donnees: couts })
  } catch (err) {
    console.error('❌ financeController.getCoutMission :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getStatsFinancieres
// ─────────────────────────────────────────────────────────────────────────────

async function getStatsFinancieres(req, res) {
  try {
    const { date_debut, date_fin } = req.query
    const stats = await financeModel.getStatsFinancieres(date_debut, date_fin)
    res.json({ succes: true, donnees: stats })
  } catch (err) {
    console.error('❌ financeController.getStatsFinancieres :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getBudgets
// ─────────────────────────────────────────────────────────────────────────────

async function getBudgets(req, res) {
  try {
    const { vehicle_id, annee = new Date().getFullYear() } = req.query
    const budgets = await financeModel.getBudgets(
      vehicle_id ? parseInt(vehicle_id) : undefined,
      parseInt(annee)
    )
    res.json({ succes: true, donnees: budgets })
  } catch (err) {
    console.error('❌ financeController.getBudgets :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// setBudget
// ─────────────────────────────────────────────────────────────────────────────

async function setBudget(req, res) {
  try {
    const { vehicle_id, mois, annee,
            budget_carburant, budget_maintenance, budget_total } = req.body
    if (!vehicle_id || !mois || !annee) {
      return res.status(400).json({ succes: false, message: 'vehicle_id, mois et annee obligatoires' })
    }
    const budget = await financeModel.setBudget(
      parseInt(vehicle_id), parseInt(mois), parseInt(annee),
      { budget_carburant, budget_maintenance, budget_total }
    )
    res.json({ succes: true, donnees: budget, message: 'Budget enregistré' })
  } catch (err) {
    console.error('❌ financeController.setBudget :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// comparerBudget
// ─────────────────────────────────────────────────────────────────────────────

async function comparerBudget(req, res) {
  try {
    const { vehicle_id, mois, annee } = req.query
    if (!vehicle_id || !mois || !annee) {
      return res.status(400).json({ succes: false, message: 'Paramètres manquants' })
    }
    const comparaison = await financeModel.comparerBudgetReel(
      parseInt(vehicle_id), parseInt(mois), parseInt(annee)
    )
    res.json({ succes: true, donnees: comparaison })
  } catch (err) {
    console.error('❌ financeController.comparerBudget :', err.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
}

module.exports = {
  getDepenses, getDepense, createDepense, updateDepense,
  deleteDepense, getCoutMission, getStatsFinancieres,
  getBudgets, setBudget, comparerBudget,
}
