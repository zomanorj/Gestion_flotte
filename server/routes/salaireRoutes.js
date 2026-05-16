/**
 * salaireRoutes.js
 * Routes pour la gestion des salaires — TransiFlow.
 *
 * Note : verifierToken est appliqué globalement dans server.js
 *        (app.use('/api/salaires', authMiddleware, salaireRoutes))
 * On ajoute ici verifierRole pour les routes à accès restreint.
 */

const express           = require('express')
const router            = express.Router()
const salaireController = require('../controllers/salaireController')
const { verifierRole }  = require('../middleware/authMiddleware')

// ─── Routes de base ───────────────────────────────────────────────────────────

// Liste paginée (tous rôles authentifiés)
router.get('/',  salaireController.getSalaires)
router.post('/', verifierRole(['admin', 'gestionnaire']), salaireController.createSalaire)

// ─── Routes spécifiques — AVANT /:id pour éviter le conflit de pattern ────────

/**
 * GET /api/salaires/stats?mois=5&annee=2026
 * Statistiques agrégées par chauffeur pour un mois donné.
 * Accès : admin uniquement.
 */
router.get('/stats',
  verifierRole(['admin']),
  salaireController.getStats
)

/**
 * GET /api/salaires/driver/:id?mois=5&annee=2026
 * Tous les salaires d'un chauffeur (filtre mois/année optionnel).
 * Accès : admin et gestionnaire.
 */
router.get('/driver/:id',
  verifierRole(['admin', 'gestionnaire']),
  salaireController.getSalairesDriver
)

// ─── Routes par ID (après les routes nommées) ─────────────────────────────────

router.get('/:id',     salaireController.getSalaire)
router.put('/:id',     verifierRole(['admin', 'gestionnaire']), salaireController.updateSalaire)
router.delete('/:id',  verifierRole(['admin']), salaireController.deleteSalaire)
router.patch('/:id/payer', verifierRole(['admin', 'gestionnaire']), salaireController.marquerPaye)

module.exports = router
