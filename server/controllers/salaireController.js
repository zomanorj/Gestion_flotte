/**
 * salaireController.js
 * Contrôleur HTTP pour les salaires — TransiFlow.
 */

const salaireModel = require('../models/salaireModel');

async function getSalaires(req, res) {
  try {
    const { driver_id, statut, mois_concerne, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const resultats = await salaireModel.findAll({
      driver_id: driver_id ? parseInt(driver_id) : null,
      statut,
      mois_concerne,
      limit: parseInt(limit),
      offset
    });

    res.json({
      succes: true,
      donnees: resultats.salaires,
      pagination: {
        total: resultats.total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(resultats.total / parseInt(limit))
      }
    });
  } catch (erreur) {
    console.error('❌ salaireController.getSalaires :', erreur.message);
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des salaires' });
  }
}

async function getSalaire(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' });

    const salaire = await salaireModel.findById(id);
    if (!salaire) return res.status(404).json({ succes: false, message: 'Salaire introuvable' });

    res.json({ succes: true, donnees: salaire });
  } catch (erreur) {
    console.error('❌ salaireController.getSalaire :', erreur.message);
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
}

async function createSalaire(req, res) {
  try {
    const { driver_id, montant } = req.body;
    if (!driver_id || montant === undefined) {
      return res.status(400).json({ succes: false, message: 'Le chauffeur et le montant sont obligatoires' });
    }

    const nouveauSalaire = await salaireModel.create(req.body);
    res.status(201).json({ succes: true, message: 'Salaire créé avec succès', donnees: nouveauSalaire });
  } catch (erreur) {
    console.error('❌ salaireController.createSalaire :', erreur.message);
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la création du salaire' });
  }
}

async function updateSalaire(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' });

    const salaireMaj = await salaireModel.update(id, req.body);
    if (!salaireMaj) return res.status(404).json({ succes: false, message: 'Salaire introuvable ou aucune modification' });

    res.json({ succes: true, message: 'Salaire mis à jour', donnees: salaireMaj });
  } catch (erreur) {
    console.error('❌ salaireController.updateSalaire :', erreur.message);
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la mise à jour' });
  }
}

async function marquerPaye(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' });

    const { date_paiement } = req.body;
    const salaireMaj = await salaireModel.update(id, { 
      statut: 'paye', 
      date_paiement: date_paiement || new Date() 
    });

    if (!salaireMaj) return res.status(404).json({ succes: false, message: 'Salaire introuvable' });

    res.json({ succes: true, message: 'Salaire marqué comme payé', donnees: salaireMaj });
  } catch (erreur) {
    console.error('❌ salaireController.marquerPaye :', erreur.message);
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
}

async function deleteSalaire(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' });

    const deleted = await salaireModel.delete(id);
    if (!deleted) return res.status(404).json({ succes: false, message: 'Salaire introuvable' });

    res.json({ succes: true, message: 'Salaire supprimé' });
  } catch (erreur) {
    console.error('❌ salaireController.deleteSalaire :', erreur.message);
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getStats
// Retourne les statistiques agrégées pour un mois et une année donnés.
// Query params : mois (1-12), annee (ex: 2026)
// Accès : admin uniquement (vérifié dans la route)
// ─────────────────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    // Valeurs par défaut : mois et année courants
    const moisNum  = parseInt(req.query.mois)  || new Date().getMonth() + 1
    const anneeNum = parseInt(req.query.annee) || new Date().getFullYear()

    if (moisNum < 1 || moisNum > 12) {
      return res.status(400).json({ succes: false, message: 'Mois invalide (1-12)' })
    }

    const stats = await salaireModel.getStats(moisNum, anneeNum)
    res.json({ succes: true, donnees: stats })
  } catch (erreur) {
    console.error('❌ salaireController.getStats :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors du calcul des statistiques' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getSalairesDriver
// Retourne tous les salaires d'un chauffeur identifié par :id.
// Query params optionnels : mois, annee (pour filtrer par période)
// Accès : admin et gestionnaire (vérifié dans la route)
// ─────────────────────────────────────────────────────────────────────────────

async function getSalairesDriver(req, res) {
  try {
    const driverId = parseInt(req.params.id, 10)
    if (isNaN(driverId)) {
      return res.status(400).json({ succes: false, message: 'ID chauffeur invalide' })
    }

    const mois  = req.query.mois  ? parseInt(req.query.mois)  : undefined
    const annee = req.query.annee ? parseInt(req.query.annee) : undefined

    const salaires = await salaireModel.findByDriver(driverId, { mois, annee })
    res.json({ succes: true, donnees: salaires })
  } catch (erreur) {
    console.error('❌ salaireController.getSalairesDriver :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des salaires du chauffeur' })
  }
}

module.exports = {
  getSalaires,
  getSalaire,
  createSalaire,
  updateSalaire,
  marquerPaye,
  deleteSalaire,
  getStats,
  getSalairesDriver,
};
