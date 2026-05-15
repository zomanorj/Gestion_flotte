/**
 * clientController.js
 * Contrôleur HTTP pour les clients — TransiFlow.
 */

const clientModel = require('../models/clientModel')

async function getClients(req, res) {
  try {
    const { search, statut, type_client, page, limit } = req.query
    const resultats = await clientModel.findAll({
      search,
      statut,
      type_client,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    })

    res.json({
      succes: true,
      donnees: resultats.clients,
      pagination: {
        total: resultats.total,
        page: resultats.page,
        limit: resultats.limit,
        pages: Math.ceil(resultats.total / resultats.limit)
      }
    })
  } catch (erreur) {
    console.error('❌ clientController.getClients :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des clients' })
  }
}

async function getClient(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const client = await clientModel.findWithStats(id)
    if (!client) return res.status(404).json({ succes: false, message: 'Client introuvable' })

    res.json({ succes: true, donnees: client })
  } catch (erreur) {
    console.error('❌ clientController.getClient :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération du client' })
  }
}

async function createClient(req, res) {
  try {
    const { type_client, nom, telephone, email } = req.body

    const erreurs = []
    if (!nom || !nom.trim()) erreurs.push('Le nom du client est obligatoire')
    if (!telephone || !telephone.trim()) erreurs.push('Le numéro de téléphone est obligatoire')
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      erreurs.push("Le format de l'email est invalide")
    }

    if (type_client && !['entreprise', 'particulier', 'administration'].includes(type_client)) {
      erreurs.push('Type de client invalide')
    }

    if (erreurs.length > 0) {
      return res.status(400).json({ succes: false, message: 'Erreurs de validation', erreurs })
    }

    const nouveauClient = await clientModel.create(req.body)
    res.status(201).json({ succes: true, message: 'Client créé avec succès', donnees: nouveauClient })
  } catch (erreur) {
    console.error('❌ clientController.createClient :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la création du client' })
  }
}

async function updateClient(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const { email, type_client } = req.body
    const erreurs = []
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      erreurs.push("Le format de l'email est invalide")
    }

    if (type_client && !['entreprise', 'particulier', 'administration'].includes(type_client)) {
      erreurs.push('Type de client invalide')
    }

    if (erreurs.length > 0) {
      return res.status(400).json({ succes: false, message: 'Erreurs de validation', erreurs })
    }

    const clientMaj = await clientModel.update(id, req.body)
    if (!clientMaj) return res.status(404).json({ succes: false, message: 'Client introuvable ou aucune modification' })

    res.json({ succes: true, message: 'Client mis à jour avec succès', donnees: clientMaj })
  } catch (erreur) {
    console.error('❌ clientController.updateClient :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la mise à jour du client' })
  }
}

async function deleteClient(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const clientSupprime = await clientModel.remove(id)
    if (!clientSupprime) return res.status(404).json({ succes: false, message: 'Client introuvable' })

    res.json({ succes: true, message: 'Client désactivé avec succès', donnees: clientSupprime })
  } catch (erreur) {
    console.error('❌ clientController.deleteClient :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la suppression du client' })
  }
}

async function getClientMissions(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const { statut, page, limit } = req.query
    const resultats = await clientModel.getMissions(id, {
      statut,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    })

    res.json({
      succes: true,
      donnees: resultats.missions,
      pagination: {
        total: resultats.total,
        page: resultats.page,
        limit: resultats.limit,
        pages: Math.ceil(resultats.total / resultats.limit)
      }
    })
  } catch (erreur) {
    console.error('❌ clientController.getClientMissions :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des missions du client' })
  }
}

async function getClientStats(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const stats = await clientModel.getStats(id)
    res.json({ succes: true, donnees: stats })
  } catch (erreur) {
    console.error('❌ clientController.getClientStats :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des statistiques du client' })
  }
}

module.exports = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientMissions,
  getClientStats
}
