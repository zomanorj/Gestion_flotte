/**
 * activiteController.js
 * Contrôleur HTTP pour le journal d'activité — TransiFlow.
 *
 * Fonctions exportées :
 *   - getActivite         : liste paginée avec filtres (admin)
 *   - getActiviteRecente  : 20 dernières entrées (admin, gestionnaire)
 *   - getActiviteEntite   : historique d'un élément spécifique (admin)
 */

const activiteModel = require('../models/activiteModel')

// ─────────────────────────────────────────────────────────────────────────────
// getActivite
// Retourne le journal d'activité paginé avec filtres (admin uniquement).
// ─────────────────────────────────────────────────────────────────────────────

async function getActivite(req, res) {
  try {
    const { user_id, action, entite, date_debut, date_fin, page, limit } = req.query

    const resultats = await activiteModel.findAll({
      user_id:    user_id    ? parseInt(user_id, 10) : undefined,
      action,
      entite,
      date_debut,
      date_fin,
      page:       parseInt(page)  || 1,
      limit:      parseInt(limit) || 20,
    })

    res.json({
      succes: true,
      donnees: resultats.activite,
      pagination: {
        total: resultats.total,
        page:  resultats.page,
        limit: resultats.limit,
        pages: Math.ceil(resultats.total / resultats.limit),
      },
    })
  } catch (erreur) {
    console.error('❌ activiteController.getActivite :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération du journal d\'activité' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getActiviteRecente
// Retourne les 20 dernières entrées du journal (admin, gestionnaire).
// ─────────────────────────────────────────────────────────────────────────────

async function getActiviteRecente(req, res) {
  try {
    const limit  = parseInt(req.query.limit) || 20
    const entree = await activiteModel.getActiviteRecente(limit)

    res.json({ succes: true, donnees: entree })
  } catch (erreur) {
    console.error('❌ activiteController.getActiviteRecente :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération de l\'activité récente' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getActiviteEntite
// Retourne l'historique d'un élément spécifique (admin uniquement).
// ─────────────────────────────────────────────────────────────────────────────

async function getActiviteEntite(req, res) {
  try {
    const { type, id } = req.params
    const entiteId     = parseInt(id, 10)

    if (isNaN(entiteId)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const entrees = await activiteModel.findByEntite(type, entiteId)
    res.json({ succes: true, donnees: entrees })
  } catch (erreur) {
    console.error('❌ activiteController.getActiviteEntite :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération de l\'historique' })
  }
}

module.exports = {
  getActivite,
  getActiviteRecente,
  getActiviteEntite,
}
