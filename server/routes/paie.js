// Routes paie chauffeurs
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/paieController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

const gestion = [verifierToken, verifierRole('admin', 'gestionnaire')];

// Résumé mensuel de toute la masse salariale
router.get('/:annee/:mois', ...gestion, ctrl.getMensuelle);

// Fiche individuelle d'un chauffeur
router.get('/chauffeur/:id/:annee/:mois',      ...gestion, ctrl.getChauffeurMensuel);

// Bulletin PDF d'un chauffeur
router.get('/chauffeur/:id/:annee/:mois/pdf',  verifierToken, ctrl.getBulletinPDF);

// Mise à jour du salaire d'un chauffeur
router.patch('/chauffeur/:id/salaire', ...gestion, ctrl.updateSalaire);

module.exports = router;
