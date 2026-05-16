/**
 * contratRoutes.js
 * Routes de l'API pour les contrats clients — TransiFlow.
 */

const express           = require('express')
const router            = express.Router()
const contratController = require('../controllers/contratController')
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')

// Toutes les routes contrats requièrent un token valide
router.use(verifierToken)

// Contrats expirant bientôt (avant /:id pour éviter le conflit de route)
router.get('/expirants', contratController.getContratsExpirants)

// Lister tous les contrats (tous rôles connectés)
router.get('/', contratController.getContrats)

// Obtenir un contrat par son ID
router.get('/:id', contratController.getContrat)

// Créer un contrat (admin, gestionnaire)
router.post('/', verifierRole(['admin', 'gestionnaire']), contratController.createContrat)

// Modifier un contrat (admin, gestionnaire)
router.put('/:id', verifierRole(['admin', 'gestionnaire']), contratController.updateContrat)

// Renouveler un contrat (admin uniquement)
router.post('/:id/renouveler', verifierRole(['admin']), contratController.renouvelerContrat)

module.exports = router
