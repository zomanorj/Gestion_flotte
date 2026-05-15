/**
 * trackingRoutes.js
 * Routes HTTP pour le suivi GPS des missions — TransiFlow.
 *
 * Endpoints :
 *   GET    /api/tracking/active           → Liste des véhicules en mission avec positions
 *   GET    /api/tracking/mission/:id      → Historique des positions d'une mission
 *   POST   /api/tracking/position         → Mettre à jour une position GPS (chauffeur)
 *
 * Toutes les routes nécessitent une authentification.
 */

const express = require('express')
const router = express.Router()

const { verifierToken } = require('../middleware/authMiddleware')
const trackingController = require('../controllers/trackingController')

// ─────────────────────────────────────────────────────────────────────────────
// Middleware d'authentification pour toutes les routes
// ─────────────────────────────────────────────────────────────────────────────

router.use(verifierToken)

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/tracking/active
 * @desc    Récupère toutes les missions en cours avec leur dernière position
 * @access  Privé (tous rôles authentifiés)
 */
router.get('/active', trackingController.getActiveVehicles)

/**
 * @route   GET /api/tracking/mission/:id
 * @desc    Récupère l'historique des positions d'une mission spécifique
 * @access  Privé (tous rôles authentifiés)
 */
router.get('/mission/:id', trackingController.getMissionTracking)

/**
 * @route   POST /api/tracking/position
 * @desc    Met à jour la position GPS d'un véhicule (réservé au chauffeur de la mission)
 * @body    { mission_id, latitude, longitude, vitesse?, horodatage? }
 * @access  Privé (chauffeur de la mission uniquement)
 */
router.post('/position', trackingController.updatePosition)

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = router