// Routes gestion du carburant
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/carburantController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

// Lecture libre
router.get('/stats', ctrl.getStats);
router.get('/',      ctrl.getAll);

// Création et modification — admin ou gestionnaire
router.post('/',    verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.create);
router.put('/:id',  verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.update);

// Suppression — admin uniquement
router.delete('/:id', verifierToken, verifierRole('admin'), ctrl.remove);

module.exports = router;
