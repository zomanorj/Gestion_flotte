/**
 * vehicleController.js
 * Contrôleur HTTP pour la gestion des véhicules — Transport STTA.
 *
 * Ce module fait le lien entre les routes HTTP et le modèle de données.
 * Il valide les entrées, appelle le modèle, et formate les réponses JSON.
 *
 * Fonctions exportées :
 *   - getVehicles(req, res)   → GET /api/vehicles (liste paginée avec filtres)
 *   - getVehicle(req, res)    → GET /api/vehicles/:id
 *   - createVehicle(req, res) → POST /api/vehicles
 *   - updateVehicle(req, res) → PUT /api/vehicles/:id
 *   - deleteVehicle(req, res) → DELETE /api/vehicles/:id (soft delete)
 *   - getAlertes(req, res)    → GET /api/vehicles/alertes
 */

const vehicleModel = require('../models/vehicleModel')

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de validation
// ─────────────────────────────────────────────────────────────────────────────

const STATUTS_AUTORISES = ['actif', 'en_revision', 'archive']

// ─────────────────────────────────────────────────────────────────────────────
// getVehicles
// Récupère la liste paginée des véhicules avec filtres optionnels.
// Query params : page, limit, search, statut
// ─────────────────────────────────────────────────────────────────────────────

async function getVehicles(req, res) {
  try {
    // ── Parsing et validation des paramètres de requête ──
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const search = (req.query.search || '').trim()
    const statut = (req.query.statut || '').trim()

    // ── Appel au modèle ──
    const resultat = await vehicleModel.findAll({
      page,
      limit,
      search,
      statut,
    })

    // ── Calcul des métadonnées de pagination ──
    const totalPages = Math.ceil(resultat.total / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    // ── Réponse JSON structurée ──
    res.json({
      succes: true,
      donnees: resultat.vehicules,
      pagination: {
        page:        page,
        limit:       limit,
        total:       resultat.total,
        totalPages:  totalPages,
        hasNextPage,
        hasPrevPage,
      },
    })
  } catch (erreur) {
    console.error('❌ vehicleController.getVehicles :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des véhicules',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getVehicle
// Récupère les détails d'un véhicule par son identifiant.
// ─────────────────────────────────────────────────────────────────────────────

async function getVehicle(req, res) {
  try {
    const { id } = req.params

    // Validation de l'ID
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID du véhicule invalide',
      })
    }

    // ── Recherche du véhicule ──
    const vehicule = await vehicleModel.findById(parseInt(id, 10))

    if (!vehicule) {
      return res.status(404).json({
        succes: false,
        message: 'Véhicule introuvable',
      })
    }

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: vehicule,
    })
  } catch (erreur) {
    console.error('❌ vehicleController.getVehicle :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération du véhicule',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createVehicle
// Crée un nouveau véhicule avec validation complète des données.
// Rôles requis : admin ou gestionnaire (dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

async function createVehicle(req, res) {
  try {
    const {
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
    } = req.body

    // ── Validation des champs obligatoires ──
    const erreurs = []

    if (!immatriculation || !immatriculation.trim()) {
      erreurs.push("L'immatriculation est obligatoire")
    }

    if (!type || !vehicleModel.TYPES_VEHICULE_AUTORISES.includes(type)) {
      erreurs.push(`Le type doit être parmi : ${vehicleModel.TYPES_VEHICULE_AUTORISES.join(', ')}`)
    }

    if (capacite === undefined || capacite === null) {
      erreurs.push('La capacité est obligatoire')
    } else if (typeof capacite !== 'number' || capacite <= 0) {
      erreurs.push('La capacité doit être un nombre supérieur à 0')
    }

    if (statut && !STATUTS_AUTORISES.includes(statut)) {
      erreurs.push(`Le statut doit être parmi : ${STATUTS_AUTORISES.join(', ')}`)
    }

    if (erreurs.length > 0) {
      return res.status(400).json({
        succes: false,
        message: 'Erreurs de validation',
        erreurs,
      })
    }

    // ── Vérification de l'unicité de l'immatriculation ──
    const vehiculeExistant = await vehicleModel.findByImmatriculation(immatriculation.trim())
    if (vehiculeExistant) {
      return res.status(400).json({
        succes: false,
        message: "Cette immatriculation est déjà utilisée par un autre véhicule",
      })
    }

    // ── Validation des dates (si fournies) ──
    if (date_assurance && isNaN(Date.parse(date_assurance))) {
      return res.status(400).json({
        succes: false,
        message: "Le format de la date d'assurance est invalide (attendu : YYYY-MM-DD)",
      })
    }

    if (date_visite_technique && isNaN(Date.parse(date_visite_technique))) {
      return res.status(400).json({
        succes: false,
        message: "Le format de la date de visite technique est invalide (attendu : YYYY-MM-DD)",
      })
    }

    // ── Création du véhicule ──
    const nouveauVehicule = await vehicleModel.create({
      immatriculation: immatriculation.trim().toUpperCase(),
      type,
      capacite,
      statut: statut || 'actif',
      date_assurance,
      date_visite_technique,
      kilometrage: kilometrage || 0,
      notes,
    })

    // ── Réponse ──
    res.status(201).json({
      succes: true,
      message: 'Véhicule créé avec succès',
      donnees: nouveauVehicule,
    })
  } catch (erreur) {
    console.error('❌ vehicleController.createVehicle :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la création du véhicule',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateVehicle
// Met à jour un véhicule (mise à jour partielle).
// Seuls les champs fournis dans le corps de la requête seront modifiés.
// Rôles requis : admin ou gestionnaire (dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

async function updateVehicle(req, res) {
  try {
    const { id } = req.params
    const {
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
    } = req.body

    // ── Validation de l'ID ──
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID du véhicule invalide',
      })
    }

    // ── Vérification que le véhicule existe ──
    const vehiculeExistant = await vehicleModel.findById(parseInt(id, 10))
    if (!vehiculeExistant) {
      return res.status(404).json({
        succes: false,
        message: 'Véhicule introuvable',
      })
    }

    // ── Validation des champs fournis ──
    const erreurs = []

    if (type !== undefined && !vehicleModel.TYPES_VEHICULE_AUTORISES.includes(type)) {
      erreurs.push(`Le type doit être parmi : ${vehicleModel.TYPES_VEHICULE_AUTORISES.join(', ')}`)
    }

    if (capacite !== undefined && (typeof capacite !== 'number' || capacite <= 0)) {
      erreurs.push('La capacité doit être un nombre supérieur à 0')
    }

    if (statut !== undefined && !STATUTS_AUTORISES.includes(statut)) {
      erreurs.push(`Le statut doit être parmi : ${STATUTS_AUTORISES.join(', ')}`)
    }

    if (kilometrage !== undefined && (typeof kilometrage !== 'number' || kilometrage < 0)) {
      erreurs.push('Le kilométrage doit être un nombre positif ou nul')
    }

    if (date_assurance && isNaN(Date.parse(date_assurance))) {
      erreurs.push("Le format de la date d'assurance est invalide (attendu : YYYY-MM-DD)")
    }

    if (date_visite_technique && isNaN(Date.parse(date_visite_technique))) {
      erreurs.push("Le format de la date de visite technique est invalide (attendu : YYYY-MM-DD)")
    }

    if (erreurs.length > 0) {
      return res.status(400).json({
        succes: false,
        message: 'Erreurs de validation',
        erreurs,
      })
    }

    // ── Vérification de l'unicité de l'immatriculation (si modifiée) ──
    if (immatriculation && immatriculation.trim() !== vehiculeExistant.immatriculation) {
      const vehiculeAvecMemeImmat = await vehicleModel.findByImmatriculation(immatriculation.trim())
      if (vehiculeAvecMemeImmat && vehiculeAvecMemeImmat.id !== parseInt(id, 10)) {
        return res.status(400).json({
          succes: false,
          message: "Cette immatriculation est déjà utilisée par un autre véhicule",
        })
      }
    }

    // ── Mise à jour ──
    const vehiculeMisAJour = await vehicleModel.update(parseInt(id, 10), {
      immatriculation: immatriculation ? immatriculation.trim().toUpperCase() : undefined,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
    })

    // ── Réponse ──
    res.json({
      succes: true,
      message: 'Véhicule mis à jour avec succès',
      donnees: vehiculeMisAJour,
    })
  } catch (erreur) {
    console.error('❌ vehicleController.updateVehicle :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la mise à jour du véhicule',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteVehicle
// Archive un véhicule (soft delete) — ne supprime pas réellement la ligne.
// Rôles requis : admin uniquement
// ─────────────────────────────────────────────────────────────────────────────

async function deleteVehicle(req, res) {
  try {
    const { id } = req.params

    // ── Validation de l'ID ──
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID du véhicule invalide',
      })
    }

    // ── Vérification que le véhicule existe ──
    const vehicule = await vehicleModel.findById(parseInt(id, 10))
    if (!vehicule) {
      return res.status(404).json({
        succes: false,
        message: 'Véhicule introuvable',
      })
    }

    // ── Soft delete (archivage) ──
    const vehiculeArchive = await vehicleModel.remove(parseInt(id, 10))

    // ── Réponse ──
    res.json({
      succes: true,
      message: 'Véhicule archivé avec succès',
      donnees: vehiculeArchive,
    })
  } catch (erreur) {
    console.error('❌ vehicleController.deleteVehicle :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de l\'archivage du véhicule',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getAlertes
// Récupère les véhicules avec des documents expirant bientôt ou expirés.
// ─────────────────────────────────────────────────────────────────────────────

async function getAlertes(req, res) {
  try {
    // ── Récupération des véhicules en alerte ──
    const vehiculesAlertes = await vehicleModel.findAlertes()

    // ── Comptage par type d'alerte ──
    const alertesExpirees = vehiculesAlertes.filter(
      v => v.etat_assurance === 'expiree' || v.etat_visite === 'expiree'
    ).length

    const alertesBientotExpirees = vehiculesAlertes.filter(
      v => (v.etat_assurance === 'bientot_expiree' && v.etat_assurance !== 'expiree') ||
           (v.etat_visite === 'bientot_expiree' && v.etat_visite !== 'expiree')
    ).length

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: vehiculesAlertes,
      resume: {
        total: vehiculesAlertes.length,
        expirees: alertesExpirees,
        bientotExpirees: alertesBientotExpirees,
      },
    })
  } catch (erreur) {
    console.error('❌ vehicleController.getAlertes :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des alertes',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// countVehicles
// Retourne le nombre total de véhicules (optionnellement par statut).
// Utile pour les KPI du dashboard.
// ─────────────────────────────────────────────────────────────────────────────

async function countVehicles(req, res) {
  try {
    const { statut } = req.query

    const total = await vehicleModel.count(statut || null)

    res.json({
      succes: true,
      donnees: { total },
    })
  } catch (erreur) {
    console.error('❌ vehicleController.countVehicles :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors du comptage des véhicules',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getAlertes,
  countVehicles,
}