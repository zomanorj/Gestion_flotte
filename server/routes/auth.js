// Routes d'authentification
const express = require('express');
const router  = express.Router();
const { login, getMe } = require('../controllers/authController');
const { verifierToken }  = require('../middleware/authMiddleware');

router.post('/login',  login);
router.post('/logout', (_req, res) => res.json({ message: 'Déconnecté' }));

// Profil du compte connecté — nécessite un token valide
router.get('/me', verifierToken, getMe);

module.exports = router;
