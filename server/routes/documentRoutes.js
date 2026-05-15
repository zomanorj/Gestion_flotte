/**
 * documentRoutes.js
 * Routes HTTP pour la génération de documents PDF — TransiFlow.
 *
 * Endpoints :
 *   GET /api/documents/bon-livraison/:missionId  → PDF bon de livraison
 *   GET /api/documents/rapport-missions           → PDF rapport de missions
 *
 * Toutes les routes nécessitent une authentification.
 */

const express = require('express')
const router = express.Router()

const { verifierToken } = require('../middleware/authMiddleware')
const documentController = require('../controllers/documentController')

// ─────────────────────────────────────────────────────────────────────────────
// Middleware d'authentification pour toutes les routes
// ─────────────────────────────────────────────────────────────────────────────

router.use(verifierToken)

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/bon-livraison/:missionId
 * @desc    Génère et télécharge le bon de livraison d'une mission
 * @access  Privé (tous rôles authentifiés)
 */
router.get('/bon-livraison/:missionId', documentController.generateBonLivraison)

/**
 * @route   GET /api/documents/rapport-missions
 * @desc    Génère et télécharge un rapport PDF des missions
 * @query   date_debut (requis), date_fin (requis), statut (optionnel)
 * @access  Privé (admin et gestionnaire uniquement)
 */
router.get('/rapport-missions', documentController.generateRapportMissions)

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = router