// Routes missions
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/missionsController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');
const { genererBonLivraison } = require('../services/bonLivraisonService');
const db = require('../config/db');

router.get('/planning', ctrl.getPlanning);
router.get('/', ctrl.getAll);

/**
 * GET /api/missions/:id/bon-livraison
 * Génère et télécharge le bon de livraison PDF de la mission.
 * Récupère la mission avec camion, chauffeur et client.
 */
router.get('/:id/bon-livraison', verifierToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.*,
        v.immatriculation, v.marque, v.modele,
        ch.nom AS chauffeur_nom, ch.prenom AS chauffeur_prenom, ch.numero_permis,
        cl.nom AS client_nom, cl.contact_nom AS client_contact, cl.telephone AS client_tel
      FROM missions m
      JOIN vehicules  v  ON m.vehicule_id  = v.id
      JOIN chauffeurs ch ON m.chauffeur_id = ch.id
      LEFT JOIN clients cl ON m.client_id  = cl.id
      WHERE m.id = ?
    `, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Mission introuvable' });
    }

    await genererBonLivraison(rows[0], res);
  } catch (err) {
    console.error('Erreur génération bon de livraison :', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur lors de la génération du PDF' });
    }
  }
});

router.post('/',
  verifierToken, verifierRole('admin', 'gestionnaire'),
  ctrl.create
);

router.put('/:id/statut',
  verifierToken, verifierRole('admin', 'gestionnaire'),
  ctrl.updateStatut
);

router.delete('/:id',
  verifierToken, verifierRole('admin'),
  ctrl.remove
);

module.exports = router;
