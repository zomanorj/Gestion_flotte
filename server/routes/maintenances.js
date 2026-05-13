// Routes maintenances planifiées
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/maintenancesController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

// Lecture libre
router.get('/alertes', ctrl.getAlertes);
router.get('/',        ctrl.getAll);

// Création et modification — admin ou gestionnaire
router.post('/',           verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.create);
router.put('/:id',         verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.update);
router.put('/:id/terminer',verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.terminer);

// Suppression — admin uniquement
router.delete('/:id', verifierToken, verifierRole('admin'), ctrl.remove);

module.exports = router;
