/**
 * rapportRoutes.js
 * Routes de l'API pour les rapports avancés — TransiFlow.
 * Accès réservé aux administrateurs et gestionnaires.
 */

const express            = require('express')
const router             = express.Router()
const rapportController  = require('../controllers/rapportController')
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')

// Toutes les routes rapports requièrent un token valide
router.use(verifierToken)

// Rapport de rentabilité par mission (admin, gestionnaire)
router.get('/rentabilite', verifierRole(['admin', 'gestionnaire']), rapportController.getRentabiliteMissions)

// Rapport de performance des chauffeurs (admin, gestionnaire)
router.get('/chauffeurs', verifierRole(['admin', 'gestionnaire']), rapportController.getPerformanceChauffeurs)

// Rapport d'utilisation de la flotte (admin, gestionnaire)
router.get('/flotte', verifierRole(['admin', 'gestionnaire']), rapportController.getUtilisationFlotte)

module.exports = router
