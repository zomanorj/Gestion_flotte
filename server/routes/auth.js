// Routes d'authentification
const express = require('express');
const router  = express.Router();
const { login, getMe } = require('../controllers/authController');
const { verifierToken }  = require('../middleware/authMiddleware');

// Connexion — public
router.post('/login', login);

// Profil du compte connecté — nécessite un token valide
router.get('/me', verifierToken, getMe);

module.exports = router;
