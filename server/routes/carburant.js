// Routes gestion du carburant
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/carburantController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

router.get('/stats', verifierToken, ctrl.getStats);
router.get('/',      verifierToken, ctrl.getAll);

// Création et modification — admin ou gestionnaire
router.post('/',    verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.create);
router.put('/:id',  verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.update);

// Suppression — admin uniquement
router.delete('/:id', verifierToken, verifierRole('admin'), ctrl.remove);

module.exports = router;
