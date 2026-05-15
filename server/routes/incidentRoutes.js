/**
 * incidentRoutes.js
 * Routes HTTP pour les incidents — TransiFlow.
 * Note : tous les rôles peuvent déclarer un incident.
 */

const express = require('express')
const router  = express.Router()
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')
const ctrl = require('../controllers/incidentController')

router.use(verifierToken)

router.get('/',                  ctrl.getIncidents)
router.get('/ouverts',           ctrl.getIncidentsOuverts)
router.get('/stats',             ctrl.getStats)
router.get('/:id',               ctrl.getIncident)
router.post('/',                 ctrl.createIncident)  // tous rôles
router.put('/:id',               verifierRole(['admin','gestionnaire']), ctrl.updateIncident)
router.patch('/:id/resoudre',    verifierRole(['admin','gestionnaire']), ctrl.resoudreIncident)
router.patch('/:id/clore',       verifierRole(['admin']),                ctrl.cloreIncident)
router.get('/vehicle/:id',       ctrl.getIncidents)    // filtre vehicle_id géré par query

module.exports = router
