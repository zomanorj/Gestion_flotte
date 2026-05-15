/**
 * exportRoutes.js
 * Routes HTTP pour l'export de données en Excel — TransiFlow.
 *
 * Ce module définit les endpoints pour :
 *   - GET /api/export/missions    → Export Excel des missions
 *   - GET /api/export/vehicules   → Export Excel des véhicules
 *   - GET /api/export/chauffeurs  → Export Excel des chauffeurs
 *
 * Routes protégées : accessibles uniquement aux admins et gestionnaires (dispatchers).
 * Les chauffeurs n'ont pas accès à l'export.
 */

const express = require('express')
const { verifierToken, verifierRole } = require('../middleware/authMiddleware')
const exportController = require('../controllers/exportController')

const routeur = express.Router()

// ─────────────────────────────────────────────────────────────────────────────
// Middleware commun : vérifie que l'utilisateur est admin ou gestionnaire
// ─────────────────────────────────────────────────────────────────────────────

const verifierAdminOuGestionnaire = verifierRole(['admin', 'gestionnaire'])

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/export/missions
 * Exporte la liste des missions au format Excel (.xlsx).
 * Query params : date_debut, date_fin, statut (optionnel)
 *
 * Le fichier généré contient :
 *   - Feuille 1 : Liste détaillée des missions avec style
 *   - Feuille 2 : Résumé avec stats et top trajets
 */
routeur.get(
  '/missions',
  verifierToken,
  verifierAdminOuGestionnaire,
  exportController.exportMissionsExcel
)

/**
 * GET /api/export/vehicules
 * Exporte la liste complète des véhicules au format Excel (.xlsx).
 *
 * Le fichier généré contient :
 *   - Toutes les informations des véhicules
 *   - Dates expirées surlignées en rouge
 */
routeur.get(
  '/vehicules',
  verifierToken,
  verifierAdminOuGestionnaire,
  exportController.exportVehiculesExcel
)

/**
 * GET /api/export/chauffeurs
 * Exporte la liste complète des chauffeurs au format Excel (.xlsx).
 *
 * Le fichier généré contient :
 *   - Toutes les informations des chauffeurs
 *   - Permis expirés surlignés en rouge
 */
routeur.get(
  '/chauffeurs',
  verifierToken,
  verifierAdminOuGestionnaire,
  exportController.exportChauffeursExcel
)

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = routeur