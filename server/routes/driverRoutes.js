/**
 * driverRoutes.js
 * Définition des routes HTTP pour la gestion des chauffeurs — Transport STTA.
 *
 * Routes exposées :
 *   GET    /api/drivers           → liste paginée des chauffeurs (tous rôles)
 *   GET    /api/drivers/alertes   → chauffeurs avec permis expirant (tous rôles)
 *   GET    /api/drivers/available → chauffeurs disponibles pour une date (tous rôles)
 *   GET    /api/drivers/count     → compteur de chauffeurs (tous rôles)
 *   GET    /api/drivers/:id       → détail d'un chauffeur (tous rôles)
 *   POST   /api/drivers           → créer un chauffeur (admin ou gestionnaire)
 *   PUT    /api/drivers/:id       → modifier un chauffeur (admin ou gestionnaire)
 *   DELETE /api/drivers/:id       → désactiver un chauffeur (admin uniquement)
 *
 * Toutes les routes sont protégées par le middleware verifierToken.
 * La vérification des rôles est faite dans chaque route si nécessaire.
 */

const express    = require('express')
const routeur    = express.Router()

const {
  verifierToken,
  verifierRole,
} = require('../middleware/authMiddleware')

const {
  getDrivers,
  getDriver,
  getAvailable,
  createDriver,
  updateDriver,
  deleteDriver,
  getPermisAlertes,
  countDrivers,
} = require('../controllers/driverController')

// ─────────────────────────────────────────────────────────────────────────────
// Middleware commun : toutes les routes chauffeurs nécessitent un token valide
// ─────────────────────────────────────────────────────────────────────────────

routeur.use(verifierToken)

// ─────────────────────────────────────────────────────────────────────────────
// Routes publiques (tous rôles authentifiés)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/drivers — Liste paginée avec filtres optionnels
// Accessible par tous les utilisateurs authentifiés
routeur.get('/', getDrivers)

// GET /api/drivers/alertes — Chauffeurs avec permis expirant
// Accessible par tous les utilisateurs authentifiés
routeur.get('/alertes', getPermisAlertes)

// GET /api/drivers/available — Chauffeurs disponibles pour une date
// Accessible par tous les utilisateurs authentifiés
routeur.get('/available', getAvailable)

// GET /api/drivers/count — Compteur de chauffeurs (pour les KPI)
// Accessible par tous les utilisateurs authentifiés
routeur.get('/count', countDrivers)

// GET /api/drivers/:id — Détail d'un chauffeur
// Accessible par tous les utilisateurs authentifiés
routeur.get('/:id', getDriver)

// ─────────────────────────────────────────────────────────────────────────────
// Routes protégées (admin ou gestionnaire/dispatcher uniquement)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/drivers — Créer un nouveau chauffeur
// Réservé aux admins et gestionnaires (dispatchers)
routeur.post(
  '/',
  verifierRole(['admin', 'gestionnaire']),
  createDriver
)

// PUT /api/drivers/:id — Modifier un chauffeur existant
// Réservé aux admins et gestionnaires (dispatchers)
routeur.put(
  '/:id',
  verifierRole(['admin', 'gestionnaire']),
  updateDriver
)

// ─────────────────────────────────────────────────────────────────────────────
// Routes protégées (admin uniquement)
// ─────────────────────────────────────────────────────────────────────────────

// DELETE /api/drivers/:id — Désactiver un chauffeur (soft delete)
// Réservé aux admins uniquement
routeur.delete(
  '/:id',
  verifierRole(['admin']),
  deleteDriver
)

module.exports = routeur