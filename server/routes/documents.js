// Routes documents administratifs
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/documentsController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

// Alertes et liste (lecture libre)
router.get('/alertes', ctrl.getAlertes);
router.get('/',        ctrl.getAll);

// Création et modification — admin ou gestionnaire
router.post('/',    verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.create);
router.put('/:id',  verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.update);

// Suppression — admin uniquement
router.delete('/:id', verifierToken, verifierRole('admin'), ctrl.remove);

module.exports = router;
