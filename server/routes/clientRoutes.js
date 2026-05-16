/**
 * clientRoutes.js
 * Routes de l'API pour la gestion des clients — TransiFlow.
 */

const express = require('express')
const router = express.Router()
const clientController = require('../controllers/clientController')

// Import du middleware d'authentification (à ajuster selon la structure existante)
const { verifierToken: protect } = require('../middleware/authMiddleware')

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// Obtenir tous les clients (paginé)
router.get('/', protect, clientController.getClients)

// Créer un nouveau client
router.post('/', protect, clientController.createClient)

// Obtenir un client spécifique
router.get('/:id', protect, clientController.getClient)

// Mettre à jour un client
router.put('/:id', protect, clientController.updateClient)

// Supprimer un client (soft delete)
router.delete('/:id', protect, clientController.deleteClient)

// Obtenir les missions d'un client
router.get('/:id/missions', protect, clientController.getClientMissions)

// Obtenir les statistiques d'un client
router.get('/:id/stats', protect, clientController.getClientStats)

// Gérer le compte crédit
router.post('/:id/transactions', protect, clientController.addCreditTransaction)
router.get('/:id/transactions', protect, clientController.getClientTransactions)

module.exports = router
