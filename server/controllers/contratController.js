/**
 * contratController.js
 * Contrôleur HTTP pour les contrats clients — TransiFlow.
 *
 * Fonctions exportées :
 *   - getContrats           : liste paginée (tous rôles)
 *   - getContrat            : détail (tous rôles)
 *   - createContrat         : création (admin, gestionnaire)
 *   - updateContrat         : modification (admin, gestionnaire)
 *   - renouvelerContrat     : renouvellement (admin)
 *   - getContratsExpirants  : contrats expirant dans 30 jours (tous rôles)
 */

const contratModel    = require('../models/contratModel')
const { logActivite } = require('../middleware/logMiddleware')

// ─────────────────────────────────────────────────────────────────────────────
// getContrats
// Retourne la liste paginée des contrats avec filtres optionnels.
// ─────────────────────────────────────────────────────────────────────────────

async function getContrats(req, res) {
  try {
    const { client_id, statut, page, limit } = req.query
    const resultats = await contratModel.findAll({
      client_id: client_id ? parseInt(client_id, 10) : undefined,
      statut,
      page:      parseInt(page)  || 1,
      limit:     parseInt(limit) || 10,
    })

    res.json({
      succes: true,
      donnees: resultats.contrats,
      pagination: {
        total: resultats.total,
        page:  resultats.page,
        limit: resultats.limit,
        pages: Math.ceil(resultats.total / resultats.limit),
      },
    })
  } catch (erreur) {
    console.error('❌ contratController.getContrats :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des contrats' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getContrat
// Retourne le détail d'un contrat par son identifiant.
// ─────────────────────────────────────────────────────────────────────────────

async function getContrat(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const contrat = await contratModel.findById(id)
    if (!contrat) return res.status(404).json({ succes: false, message: 'Contrat introuvable' })

    res.json({ succes: true, donnees: contrat })
  } catch (erreur) {
    console.error('❌ contratController.getContrat :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération du contrat' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createContrat
// Crée un nouveau contrat (admin, gestionnaire).
// ─────────────────────────────────────────────────────────────────────────────

async function createContrat(req, res) {
  try {
    const { client_id, titre, date_debut } = req.body

    // Validation des champs obligatoires
    const erreurs = []
    if (!client_id)   erreurs.push('Le client est obligatoire')
    if (!titre?.trim()) erreurs.push('Le titre du contrat est obligatoire')
    if (!date_debut)  erreurs.push('La date de début est obligatoire')

    if (erreurs.length > 0) {
      return res.status(400).json({ succes: false, message: 'Erreurs de validation', erreurs })
    }

    const nouveauContrat = await contratModel.create({
      ...req.body,
      created_by: req.user.id,
    })

    logActivite({
      userId:      req.user.id,
      action:      'creation',
      entite:      'contrats',
      entiteId:    nouveauContrat.id,
      description: `Création du contrat ${nouveauContrat.numero} — ${nouveauContrat.titre}`,
      req,
    })

    res.status(201).json({ succes: true, message: 'Contrat créé avec succès', donnees: nouveauContrat })
  } catch (erreur) {
    console.error('❌ contratController.createContrat :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la création du contrat' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateContrat
// Modifie un contrat existant (admin, gestionnaire).
// ─────────────────────────────────────────────────────────────────────────────

async function updateContrat(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const contratMaj = await contratModel.update(id, req.body)
    if (!contratMaj) return res.status(404).json({ succes: false, message: 'Contrat introuvable ou aucune modification' })

    logActivite({
      userId:      req.user.id,
      action:      'modification',
      entite:      'contrats',
      entiteId:    id,
      description: `Modification du contrat ID ${id}`,
      req,
    })

    res.json({ succes: true, message: 'Contrat mis à jour avec succès', donnees: contratMaj })
  } catch (erreur) {
    console.error('❌ contratController.updateContrat :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la mise à jour du contrat' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// renouvelerContrat
// Crée un nouveau contrat à partir de l'existant (admin uniquement).
// ─────────────────────────────────────────────────────────────────────────────

async function renouvelerContrat(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const nouveauContrat = await contratModel.renouveler(id)

    logActivite({
      userId:      req.user.id,
      action:      'renouvellement',
      entite:      'contrats',
      entiteId:    id,
      description: `Renouvellement du contrat ID ${id} → nouveau contrat ${nouveauContrat.numero}`,
      req,
    })

    res.status(201).json({ succes: true, message: 'Contrat renouvelé avec succès', donnees: nouveauContrat })
  } catch (erreur) {
    console.error('❌ contratController.renouvelerContrat :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors du renouvellement du contrat' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getContratsExpirants
// Retourne les contrats expirant dans les 30 prochains jours.
// ─────────────────────────────────────────────────────────────────────────────

async function getContratsExpirants(req, res) {
  try {
    const contrats = await contratModel.getContratsExpirantBientot()
    res.json({ succes: true, donnees: contrats })
  } catch (erreur) {
    console.error('❌ contratController.getContratsExpirants :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des contrats expirants' })
  }
}

module.exports = {
  getContrats,
  getContrat,
  createContrat,
  updateContrat,
  renouvelerContrat,
  getContratsExpirants,
}
