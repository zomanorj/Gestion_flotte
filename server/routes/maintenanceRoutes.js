/**
 * maintenanceRoutes.js
 * Routes HTTP pour la maintenance préventive — TransiFlow.
 */

const express = require('express')
const router  = express.Router()
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')
const ctrl = require('../controllers/maintenanceController')

router.use(verifierToken)

router.get('/',                        ctrl.getMaintenances)
router.get('/urgentes',                ctrl.getMaintenancesUrgentes)
router.get('/:id',                     ctrl.getMaintenance)
router.post('/',                       verifierRole(['admin','gestionnaire']), ctrl.createMaintenance)
router.put('/:id',                     verifierRole(['admin','gestionnaire']), ctrl.updateMaintenance)
router.patch('/:id/terminer',          verifierRole(['admin','gestionnaire']), ctrl.terminerMaintenance)
router.get('/vehicle/:id/historique',  ctrl.getHistorique)

module.exports = router
