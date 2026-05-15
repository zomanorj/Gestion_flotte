/**
 * paiementRoutes.js
 * Routes paiements progressifs — TransiFlow.
 *
 *   GET  /api/factures/:id/paiements  → liste paiements + solde
 *   POST /api/factures/:id/paiements  → enregistrer un paiement
 */

const express = require('express')
const router  = express.Router({ mergeParams: true })  // héritage du param :id
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')
const ctrl = require('../controllers/paiementController')

// Tous les rôles peuvent voir les paiements
router.get('/', verifierToken, ctrl.getPaiements)

// Seuls admin et gestionnaire peuvent enregistrer un paiement
router.post('/', verifierToken, verifierRole(['admin', 'gestionnaire']), ctrl.addPaiement)

module.exports = router
