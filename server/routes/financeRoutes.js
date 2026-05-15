/**
 * financeRoutes.js
 * Routes HTTP pour la gestion financière — TransiFlow.
 */

const express = require('express')
const router  = express.Router()
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')
const ctrl = require('../controllers/financeController')

router.use(verifierToken)

router.get('/depenses',                ctrl.getDepenses)
router.get('/depenses/:id',            ctrl.getDepense)
router.post('/depenses',               verifierRole(['admin','gestionnaire']), ctrl.createDepense)
router.put('/depenses/:id',            verifierRole(['admin','gestionnaire']), ctrl.updateDepense)
router.delete('/depenses/:id',         verifierRole(['admin']),                ctrl.deleteDepense)
router.get('/mission/:id/cout',        ctrl.getCoutMission)
router.get('/stats',                   ctrl.getStatsFinancieres)
router.get('/budgets',                 ctrl.getBudgets)
router.post('/budgets',                verifierRole(['admin']),                ctrl.setBudget)
router.get('/budgets/comparer',        ctrl.comparerBudget)

module.exports = router
