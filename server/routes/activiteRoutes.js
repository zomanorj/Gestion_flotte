/**
 * activiteRoutes.js
 * Routes de l'API pour le journal d'activité — TransiFlow.
 */

const express            = require('express')
const router             = express.Router()
const activiteController = require('../controllers/activiteController')
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')

// Toutes les routes requièrent un token valide
router.use(verifierToken)

// Lister le journal complet paginé (admin uniquement)
router.get('/', verifierRole(['admin']), activiteController.getActivite)

// Dernières activités (admin, gestionnaire)
router.get('/recente', verifierRole(['admin', 'gestionnaire']), activiteController.getActiviteRecente)

// Historique d'un élément spécifique (admin uniquement)
router.get('/entite/:type/:id', verifierRole(['admin']), activiteController.getActiviteEntite)

module.exports = router
