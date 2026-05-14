/**
 * missionRoutes.js
 * Définition des routes HTTP pour la gestion des missions — Transport STTA.
 *
 * Routes exposées :
 *   GET    /api/missions                   → liste paginée (tous rôles)
 *   GET    /api/missions/stats             → statistiques (tous rôles)
 *   GET    /api/missions/planning?date=X   → missions d'un jour (tous rôles)
 *   GET    /api/missions/:id               → détail (tous rôles)
 *   POST   /api/missions                   → créer (admin ou dispatcher)
 *   PUT    /api/missions/:id               → modifier (admin ou dispatcher)
 *   PATCH  /api/missions/:id/statut        → changer statut (admin, dispatcher, chauffeur concerné)
 *   DELETE /api/missions/:id               → annuler (admin uniquement)
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
  getMissions,
  getMission,
  getMissionsByDate,
  createMission,
  updateMission,
  updateStatutMission,
  deleteMission,
  getMissionStats,
  countMissions,
} = require('../controllers/missionController')

// ─────────────────────────────────────────────────────────────────────────────
// Middleware commun : toutes les routes missions nécessitent un token valide
// ─────────────────────────────────────────────────────────────────────────────

routeur.use(verifierToken)

// ─────────────────────────────────────────────────────────────────────────────
// Routes publiques (tous rôles authentifiés)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/missions — Liste paginée avec filtres optionnels
// Accessible par tous les utilisateurs authentifiés
routeur.get('/', getMissions)

// GET /api/missions/stats — Statistiques des missions
// Accessible par tous les utilisateurs authentifiés
routeur.get('/stats', getMissionStats)

// GET /api/missions/planning — Missions d'une date donnée (pour le planning)
// Accessible par tous les utilisateurs authentifiés
routeur.get('/planning', getMissionsByDate)

// GET /api/missions/count — Compteur de missions (pour les KPI)
// Accessible par tous les utilisateurs authentifiés
routeur.get('/count', countMissions)

// GET /api/missions/:id — Détail d'une mission
// Accessible par tous les utilisateurs authentifiés
routeur.get('/:id', getMission)

// ─────────────────────────────────────────────────────────────────────────────
// Routes protégées (admin ou gestionnaire/dispatcher uniquement)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/missions — Créer une nouvelle mission
// Réservé aux admins et gestionnaires (dispatchers)
routeur.post(
  '/',
  verifierRole(['admin', 'gestionnaire']),
  createMission
)

// PUT /api/missions/:id — Modifier une mission existante
// Réservé aux admins et gestionnaires (dispatchers)
routeur.put(
  '/:id',
  verifierRole(['admin', 'gestionnaire']),
  updateMission
)

// ─────────────────────────────────────────────────────────────────────────────
// Route semi-protégée (admin, dispatcher, ou chauffeur concerné)
// ─────────────────────────────────────────────────────────────────────────────

// PATCH /api/missions/:id/statut — Changer le statut d'une mission
// Réservé aux admins, gestionnaires (dispatchers), ou au chauffeur concerné
routeur.patch(
  '/:id/statut',
  verifierRole(['admin', 'gestionnaire', 'chauffeur']),
  updateStatutMission
)

// ─────────────────────────────────────────────────────────────────────────────
// Routes protégées (admin uniquement)
// ─────────────────────────────────────────────────────────────────────────────

// DELETE /api/missions/:id — Annuler une mission (soft delete)
// Réservé aux admins uniquement
routeur.delete(
  '/:id',
  verifierRole(['admin']),
  deleteMission
)

module.exports = routeur