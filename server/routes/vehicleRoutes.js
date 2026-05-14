/**
 * vehicleRoutes.js
 * Définition des routes HTTP pour la gestion des véhicules — Transport STTA.
 *
 * Routes exposées :
 *   GET    /api/vehicles          → liste paginée des véhicules (tous rôles)
 *   GET    /api/vehicles/alertes  → véhicules avec documents expirant (tous rôles)
 *   GET    /api/vehicles/:id      → détail d'un véhicule (tous rôles)
 *   POST   /api/vehicles          → créer un véhicule (admin ou gestionnaire)
 *   PUT    /api/vehicles/:id      → modifier un véhicule (admin ou gestionnaire)
 *   DELETE /api/vehicles/:id      → archiver un véhicule (admin uniquement)
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
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getAlertes,
  countVehicles,
} = require('../controllers/vehicleController')

// ─────────────────────────────────────────────────────────────────────────────
// Middleware commun : toutes les routes véhicules nécessitent un token valide
// ─────────────────────────────────────────────────────────────────────────────

routeur.use(verifierToken)

// ─────────────────────────────────────────────────────────────────────────────
// Routes publiques (tous rôles authentifiés)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/vehicles — Liste paginée avec filtres optionnels
// Accessible par tous les utilisateurs authentifiés
routeur.get('/', getVehicles)

// GET /api/vehicles/alertes — Véhicules avec documents expirant
// Accessible par tous les utilisateurs authentifiés
routeur.get('/alertes', getAlertes)

// GET /api/vehicles/count — Compteur de véhicules (pour les KPI)
// Accessible par tous les utilisateurs authentifiés
routeur.get('/count', countVehicles)

// GET /api/vehicles/:id — Détail d'un véhicule
// Accessible par tous les utilisateurs authentifiés
routeur.get('/:id', getVehicle)

// ─────────────────────────────────────────────────────────────────────────────
// Routes protégées (admin ou gestionnaire/dispatcher uniquement)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/vehicles — Créer un nouveau véhicule
// Réservé aux admins et gestionnaires (dispatchers)
routeur.post(
  '/',
  verifierRole(['admin', 'gestionnaire']),
  createVehicle
)

// PUT /api/vehicles/:id — Modifier un véhicule existant
// Réservé aux admins et gestionnaires (dispatchers)
routeur.put(
  '/:id',
  verifierRole(['admin', 'gestionnaire']),
  updateVehicle
)

// ─────────────────────────────────────────────────────────────────────────────
// Routes protégées (admin uniquement)
// ─────────────────────────────────────────────────────────────────────────────

// DELETE /api/vehicles/:id — Archiver un véhicule (soft delete)
// Réservé aux admins uniquement
routeur.delete(
  '/:id',
  verifierRole(['admin']),
  deleteVehicle
)

module.exports = routeur