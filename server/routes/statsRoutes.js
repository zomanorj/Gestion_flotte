/**
 * statsRoutes.js
 * Routes HTTP pour les statistiques — TransiFlow.
 *
 * Ce module définit les endpoints pour :
 *   - GET /api/stats/dashboard   → Statistiques globales du dashboard
 *   - GET /api/stats/missions    → Statistiques détaillées des missions
 *   - GET /api/stats/flotte      → Statistiques de la flotte
 *
 * Toutes les routes sont protégées par authentification (tous rôles).
 */

const express = require('express')
const { verifierToken } = require('../middleware/authMiddleware')
const statsController = require('../controllers/statsController')

const routeur = express.Router()

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/dashboard
 * Retourne toutes les statistiques nécessaires au dashboard en un seul appel.
 * Accessible à tous les utilisateurs authentifiés.
 */
routeur.get('/dashboard', verifierToken, statsController.getDashboardStats)

/**
 * GET /api/stats/missions
 * Retourne les statistiques détaillées des missions sur une période.
 * Query params : date_debut, date_fin (optionnel, défaut: 30 jours)
 * Accessible à tous les utilisateurs authentifiés.
 */
routeur.get('/missions', verifierToken, statsController.getMissionStats)

/**
 * GET /api/stats/flotte
 * Retourne les statistiques de la flotte de véhicules.
 * Accessible à tous les utilisateurs authentifiés.
 */
routeur.get('/flotte', verifierToken, statsController.getFleetStats)

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = routeur