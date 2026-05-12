// Routes de simulation de mission en temps réel
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');
const { getRoute, VILLES_MADAGASCAR }  = require('../services/routeService');
const { demarrerSimulation, arreterSimulation } = require('../services/simulationService');

/**
 * GET /api/simulation/villes
 * Retourne la liste des villes disponibles pour les selects du formulaire.
 */
router.get('/villes', verifierToken, (_req, res) => {
  res.json({ villes: Object.keys(VILLES_MADAGASCAR) });
});

/**
 * POST /api/simulation/route
 * Calcule la distance et la durée réelles entre deux villes avant de créer la mission.
 * Body : { villeDepart, villeArrivee }
 */
router.post('/route', verifierToken, async (req, res) => {
  try {
    const { villeDepart, villeArrivee } = req.body;
    const route = await getRoute(villeDepart, villeArrivee);
    res.json({
      distanceKm:  Math.round(route.distanceKm),
      dureeMin:    Math.round(route.dureeMin),
      totalPoints: route.points.length
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * POST /api/simulation/demarrer/:missionId
 * Démarre la simulation d'une mission planifiée.
 * Met la mission en statut "en_cours" en base, puis lance la boucle de simulation.
 */
router.post(
  '/demarrer/:missionId',
  verifierToken,
  verifierRole('admin', 'gestionnaire'),
  async (req, res) => {
    try {
      const { missionId } = req.params;

      // Récupère les infos de la mission avec ses relations
      const [missions] = await db.query(
        `SELECT m.*, c.nom AS chauffeur_nom,
                v.immatriculation, v.statut AS vehicule_statut
         FROM missions m
         JOIN chauffeurs c ON m.chauffeur_id = c.id
         JOIN vehicules  v ON m.vehicule_id  = v.id
         WHERE m.id = ?`,
        [missionId]
      );

      if (!missions.length) {
        return res.status(404).json({ message: 'Mission introuvable' });
      }

      const mission = missions[0];

      if (!['planifiee'].includes(mission.statut)) {
        return res.status(409).json({
          message: `Impossible de simuler une mission au statut "${mission.statut}"`
        });
      }

      // Passage en statut "en_cours" en base
      await db.query("UPDATE missions  SET statut = 'en_cours'  WHERE id = ?",     [missionId]);
      await db.query("UPDATE vehicules SET statut = 'en_mission' WHERE id = ?",     [mission.vehicule_id]);
      await db.query("UPDATE chauffeurs SET statut = 'en_mission' WHERE id = ?",    [mission.chauffeur_id]);

      // Récupère l'instance io depuis l'app Express
      const io = req.app.get('io');
      await demarrerSimulation(missionId, mission, io);

      res.json({
        message: 'Simulation démarrée',
        mission: {
          id:          mission.id,
          titre:       mission.titre,
          camion:      mission.immatriculation,
          chauffeur:   mission.chauffeur_nom,
          depart:      mission.lieu_depart,
          destination: mission.lieu_destination
        }
      });

    } catch (error) {
      console.error('Erreur démarrage simulation :', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/simulation/arreter/:missionId
 * Stoppe proprement une simulation en cours sans modifier le statut en base.
 */
router.post(
  '/arreter/:missionId',
  verifierToken,
  verifierRole('admin', 'gestionnaire'),
  (req, res) => {
    arreterSimulation(req.params.missionId);
    res.json({ message: 'Simulation arrêtée' });
  }
);

module.exports = router;
