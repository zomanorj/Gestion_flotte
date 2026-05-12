// Routes missions
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/missionsController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

router.get('/', ctrl.getAll);

router.post('/',
  verifierToken, verifierRole('admin', 'gestionnaire'),
  ctrl.create
);

router.put('/:id/statut',
  verifierToken, verifierRole('admin', 'gestionnaire'),
  ctrl.updateStatut
);

router.delete('/:id',
  verifierToken, verifierRole('admin'),
  ctrl.remove
);

module.exports = router;
