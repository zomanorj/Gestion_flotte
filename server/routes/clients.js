// Routes gestion des clients
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/clientsController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

// Lecture libre
router.get('/',              ctrl.getAll);
router.get('/:id/missions',  ctrl.getMissions);

// Création et modification — admin ou gestionnaire
router.post('/',    verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.create);
router.put('/:id',  verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.update);

// Suppression — admin uniquement
router.delete('/:id', verifierToken, verifierRole('admin'), ctrl.remove);

module.exports = router;
