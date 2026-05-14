/**
 * authRoutes.js
 * Définition des routes HTTP pour l'authentification.
 *
 * Routes exposées :
 *   POST /api/auth/register  → créer un nouveau compte
 *   POST /api/auth/login     → se connecter, obtenir un token JWT
 *   GET  /api/auth/me        → récupérer son profil (token requis)
 *
 * Ce fichier ne contient PAS de logique métier — elle est dans authController.js.
 */

const express    = require('express')
const routeur    = express.Router()

const { register, login, getMe } = require('../controllers/authController')
const { verifierToken }          = require('../middleware/authMiddleware')

// Route publique : inscription d'un nouvel utilisateur
routeur.post('/register', register)

// Route publique : connexion avec email + mot de passe
routeur.post('/login', login)

// Route protégée : profil de l'utilisateur connecté
// verifierToken est appliqué avant getMe — il injecte req.user
routeur.get('/me', verifierToken, getMe)

module.exports = routeur
