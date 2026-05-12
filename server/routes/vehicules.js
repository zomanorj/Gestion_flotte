// Routes véhicules
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/vehiculesController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

// Lecture publique (ou authentifiée selon les besoins de l'entreprise)
router.get('/',         ctrl.getAll);
router.get('/alertes',  ctrl.getAlertes);
router.get('/:id',      ctrl.getById);

// Création et modification — admin ou gestionnaire
router.post('/',   verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.create);
router.put('/:id', verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.update);

// Suppression — admin uniquement
router.delete('/:id', verifierToken, verifierRole('admin'), ctrl.remove);

module.exports = router;
