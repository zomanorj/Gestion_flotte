/**
 * utilisateurRoutes.js
 * Routes de l'API pour la gestion des utilisateurs et du profil — TransiFlow.
 *
 * Routes utilisateurs (admin) : /api/utilisateurs
 * Routes profil (tous rôles)  : /api/profil
 */

const express              = require('express')
const utilisateurController = require('../controllers/utilisateurController')
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')

// ─────────────────────────────────────────────────────────────────────────────
// Router principal : /api/utilisateurs (admin uniquement)
// ─────────────────────────────────────────────────────────────────────────────

const router = express.Router()

// Toutes les routes utilisateurs requièrent un token valide + rôle admin
router.use(verifierToken)

// Lister tous les utilisateurs (admin)
router.get('/', verifierRole(['admin']), utilisateurController.getUtilisateurs)

// Obtenir un utilisateur par son ID (admin)
router.get('/:id', verifierRole(['admin']), utilisateurController.getUtilisateur)

// Créer un utilisateur (admin)
router.post('/', verifierRole(['admin']), utilisateurController.createUtilisateur)

// Modifier un utilisateur (admin)
router.put('/:id', verifierRole(['admin']), utilisateurController.updateUtilisateur)

// Réinitialiser le mot de passe d'un utilisateur (admin)
router.patch('/:id/reinitialiser-mdp', verifierRole(['admin']), utilisateurController.reinitialiserMdp)

// Désactiver un compte utilisateur (admin)
router.patch('/:id/desactiver', verifierRole(['admin']), utilisateurController.desactiverCompte)

// ─────────────────────────────────────────────────────────────────────────────
// Router profil : /api/profil (tous rôles connectés)
// ─────────────────────────────────────────────────────────────────────────────

const profilRouter = express.Router()

// Toutes les routes profil requièrent un token valide
profilRouter.use(verifierToken)

// Obtenir son propre profil
profilRouter.get('/', utilisateurController.getMonProfil)

// Mettre à jour son propre profil (nom, email, téléphone)
profilRouter.put('/', utilisateurController.updateMonProfil)

// Changer son propre mot de passe
profilRouter.patch('/mot-de-passe', utilisateurController.changerMonMdp)

module.exports = router
module.exports.profilRouter = profilRouter
