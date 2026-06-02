// Routes gestion des utilisateurs — admin uniquement
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/usersController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

const adminOnly = [verifierToken, verifierRole('admin')];

router.get('/',                    ...adminOnly, ctrl.getAll);
router.post('/',                   ...adminOnly, ctrl.create);
router.put('/:id',                 ...adminOnly, ctrl.update);
router.patch('/:id/password',      verifierToken, ctrl.changePassword); // admin ou soi-même
router.delete('/:id',              ...adminOnly, ctrl.remove);

module.exports = router;
