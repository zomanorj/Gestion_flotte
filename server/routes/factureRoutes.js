/**
 * factureRoutes.js
 * Routes de l'API pour la gestion des factures — TransiFlow.
 */

const express = require('express')
const router = express.Router()
const factureController = require('../controllers/factureController')
const { verifierToken: protect } = require('../middleware/authMiddleware')

// Obtenir toutes les factures (paginé, filtres)
router.get('/', protect, factureController.getFactures)

// Obtenir les stats factures globales
router.get('/stats', protect, factureController.getStatsFactures)

// Créer une nouvelle facture
router.post('/', protect, factureController.createFacture)

// Obtenir une facture spécifique
router.get('/:id', protect, factureController.getFacture)

// Mettre à jour une facture (si brouillon)
router.put('/:id', protect, factureController.updateFacture)

// Marquer une facture comme payée
router.patch('/:id/payer', protect, factureController.marquerPayee)

// Annuler une facture
router.patch('/:id/annuler', protect, factureController.annulerFacture)

// Télécharger le PDF de la facture
router.get('/:id/pdf', protect, factureController.generatePDF)

module.exports = router
