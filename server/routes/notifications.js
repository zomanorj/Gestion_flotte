// Routes notifications temps réel
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/notificationsController');
const { verifierToken } = require('../middleware/authMiddleware');

router.get('/',                verifierToken, ctrl.getAll);
router.patch('/read-all',      verifierToken, ctrl.marquerToutesLues);
router.patch('/:id/read',      verifierToken, ctrl.marquerLue);
router.delete('/:id',          verifierToken, ctrl.remove);

module.exports = router;
