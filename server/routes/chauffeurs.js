// Routes chauffeurs
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/chauffeursController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

router.get('/',                ctrl.getAll);
router.get('/:id',             ctrl.getById);
router.get('/:id/missions',    ctrl.getMissions);

router.post('/',   verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.create);
router.put('/:id', verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.update);

router.delete('/:id', verifierToken, verifierRole('admin'), ctrl.remove);

module.exports = router;
