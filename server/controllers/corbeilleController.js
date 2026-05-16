/**
 * corbeilleController.js
 * Contrôleur HTTP pour la gestion de la corbeille — TransiFlow.
 *
 * Fonctions exportées :
 *   - getCorbeille : liste des éléments supprimés par type (admin)
 *   - getCount     : compteurs par type + total (admin)
 *   - restore      : restaurer un élément (admin)
 *   - purge        : suppression définitive (admin)
 */

const corbeilleModel  = require('../models/corbeilleModel')
const { logActivite } = require('../middleware/logMiddleware')

const TYPES_VALIDES = ['vehicles', 'drivers', 'missions', 'clients']

// ─────────────────────────────────────────────────────────────────────────────
// getCorbeille
// Retourne la liste des éléments supprimés pour un type donné.
// ─────────────────────────────────────────────────────────────────────────────

async function getCorbeille(req, res) {
  try {
    const { type } = req.params

    if (!TYPES_VALIDES.includes(type)) {
      return res.status(400).json({
        succes:  false,
        message: `Type invalide. Valeurs acceptées : ${TYPES_VALIDES.join(', ')}`,
      })
    }

    const elements = await corbeilleModel.findAll(type)
    res.json({ succes: true, donnees: elements })
  } catch (erreur) {
    console.error('❌ corbeilleController.getCorbeille :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération de la corbeille' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getCount
// Retourne le nombre d'éléments supprimés par catégorie + total.
// ─────────────────────────────────────────────────────────────────────────────

async function getCount(req, res) {
  try {
    const counts = await corbeilleModel.countAll()
    res.json({ succes: true, donnees: counts })
  } catch (erreur) {
    console.error('❌ corbeilleController.getCount :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors du comptage de la corbeille' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// restore
// Restaure un élément de la corbeille (supprime le soft-delete).
// ─────────────────────────────────────────────────────────────────────────────

async function restore(req, res) {
  try {
    const { type, id } = req.params
    const elementId    = parseInt(id, 10)

    if (!TYPES_VALIDES.includes(type)) {
      return res.status(400).json({ succes: false, message: 'Type invalide' })
    }
    if (isNaN(elementId)) {
      return res.status(400).json({ succes: false, message: 'ID invalide' })
    }

    const elementRestaure = await corbeilleModel.restore(type, elementId)
    if (!elementRestaure) {
      return res.status(404).json({ succes: false, message: 'Élément introuvable dans la corbeille' })
    }

    logActivite({
      userId:      req.user.id,
      action:      'restauration',
      entite:      type,
      entiteId:    elementId,
      description: `Restauration de l'élément ${type} ID ${elementId}`,
      req,
    })

    res.json({ succes: true, message: 'Élément restauré avec succès', donnees: elementRestaure })
  } catch (erreur) {
    console.error('❌ corbeilleController.restore :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la restauration' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// purge
// Suppression définitive (DELETE physique) d'un élément de la corbeille.
// ─────────────────────────────────────────────────────────────────────────────

async function purge(req, res) {
  try {
    const { type, id } = req.params
    const elementId    = parseInt(id, 10)

    if (!TYPES_VALIDES.includes(type)) {
      return res.status(400).json({ succes: false, message: 'Type invalide' })
    }
    if (isNaN(elementId)) {
      return res.status(400).json({ succes: false, message: 'ID invalide' })
    }

    const elementSupprime = await corbeilleModel.purge(type, elementId)
    if (!elementSupprime) {
      return res.status(404).json({ succes: false, message: 'Élément introuvable dans la corbeille' })
    }

    logActivite({
      userId:      req.user.id,
      action:      'suppression_definitive',
      entite:      type,
      entiteId:    elementId,
      description: `Suppression définitive de l'élément ${type} ID ${elementId}`,
      req,
    })

    res.json({ succes: true, message: 'Élément supprimé définitivement', donnees: elementSupprime })
  } catch (erreur) {
    console.error('❌ corbeilleController.purge :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la suppression définitive' })
  }
}

module.exports = {
  getCorbeille,
  getCount,
  restore,
  purge,
}
