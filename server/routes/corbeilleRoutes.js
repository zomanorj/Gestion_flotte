/**
 * corbeilleRoutes.js
 * Routes de l'API pour la gestion de la corbeille — TransiFlow.
 * Accès réservé aux administrateurs.
 */

const express              = require('express')
const router               = express.Router()
const corbeilleController  = require('../controllers/corbeilleController')
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')

// Toutes les routes corbeille requièrent un token valide
router.use(verifierToken)

// Compteurs par type (admin)
router.get('/count', verifierRole(['admin']), corbeilleController.getCount)

// Liste des éléments supprimés par type (admin)
router.get('/:type', verifierRole(['admin']), corbeilleController.getCorbeille)

// Restaurer un élément (admin)
router.patch('/:type/:id/restore', verifierRole(['admin']), corbeilleController.restore)

// Supprimer définitivement un élément (admin)
router.delete('/:type/:id', verifierRole(['admin']), corbeilleController.purge)

module.exports = router
