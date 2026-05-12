// Routes dashboard
const express = require('express');
const router  = express.Router();
const { getStats } = require('../controllers/dashboardController');
const { verifierToken } = require('../middleware/authMiddleware');

// Statistiques globales — réservé aux utilisateurs authentifiés
router.get('/stats', verifierToken, getStats);

module.exports = router;
