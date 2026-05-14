/**
 * driverController.js
 * Contrôleur HTTP pour la gestion des chauffeurs — Transport STTA.
 *
 * Ce module fait le lien entre les routes HTTP et le modèle de données.
 * Il valide les entrées, appelle le modèle, et formate les réponses JSON.
 *
 * Fonctions exportées :
 *   - getDrivers(req, res)       → GET /api/drivers (liste paginée avec filtres)
 *   - getDriver(req, res)        → GET /api/drivers/:id
 *   - getAvailable(req, res)     → GET /api/drivers/available
 *   - createDriver(req, res)     → POST /api/drivers
 *   - updateDriver(req, res)     → PUT /api/drivers/:id
 *   - deleteDriver(req, res)     → DELETE /api/drivers/:id (soft delete)
 *   - getPermisAlertes(req, res) → GET /api/drivers/alertes
 */

const driverModel = require('../models/driverModel')

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de validation
// ─────────────────────────────────────────────────────────────────────────────

const STATUTS_AUTORISES = ['actif', 'en_conge', 'inactif']

// ─────────────────────────────────────────────────────────────────────────────
// getDrivers
// Récupère la liste paginée des chauffeurs avec filtres optionnels.
// Query params : page, limit, search, statut
// ─────────────────────────────────────────────────────────────────────────────

async function getDrivers(req, res) {
  try {
    // ── Parsing et validation des paramètres de requête ──
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const search = (req.query.search || '').trim()
    const statut = (req.query.statut || '').trim()

    // ── Appel au modèle ──
    const resultat = await driverModel.findAll({
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
      donnees: resultat.drivers,
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
    console.error('❌ driverController.getDrivers :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des chauffeurs',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getDriver
// Récupère les détails d'un chauffeur par son identifiant.
// ─────────────────────────────────────────────────────────────────────────────

async function getDriver(req, res) {
  try {
    const { id } = req.params

    // Validation de l'ID
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID du chauffeur invalide',
      })
    }

    // ── Recherche du chauffeur ──
    const chauffeur = await driverModel.findById(parseInt(id, 10))

    if (!chauffeur) {
      return res.status(404).json({
        succes: false,
        message: 'Chauffeur introuvable',
      })
    }

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: chauffeur,
    })
  } catch (erreur) {
    console.error('❌ driverController.getDriver :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération du chauffeur',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getAvailable
// Récupère les chauffeurs disponibles pour une date donnée.
// Query params : date (obligatoire, format YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────────────────────

async function getAvailable(req, res) {
  try {
    const { date } = req.query

    // Validation de la date
    if (!date) {
      return res.status(400).json({
        succes: false,
        message: 'Le paramètre date est obligatoire (format: YYYY-MM-DD)',
      })
    }

    // Vérification du format de date
    if (isNaN(Date.parse(date))) {
      return res.status(400).json({
        succes: false,
        message: 'Format de date invalide (attendu : YYYY-MM-DD)',
      })
    }

    // ── Récupération des chauffeurs disponibles ──
    const chauffeurs = await driverModel.findAvailable(date)

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: chauffeurs,
    })
  } catch (erreur) {
    console.error('❌ driverController.getAvailable :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des chauffeurs disponibles',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createDriver
// Crée un nouveau chauffeur avec validation complète des données.
// Rôles requis : admin ou gestionnaire (dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

async function createDriver(req, res) {
  try {
    const {
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
    } = req.body

    // ── Validation des champs obligatoires ──
    const erreurs = []

    if (!nom || !nom.trim()) {
      erreurs.push('Le nom est obligatoire')
    }

    if (!prenom || !prenom.trim()) {
      erreurs.push('Le prénom est obligatoire')
    }

    if (!numero_permis || !numero_permis.trim()) {
      erreurs.push('Le numéro de permis est obligatoire')
    }

    if (!date_expiration_permis) {
      erreurs.push('La date d\'expiration du permis est obligatoire')
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

    // ── Vérification de l'unicité du numéro de permis ──
    const permisExistant = await driverModel.findByNumeroPermis(numero_permis.trim())
    if (permisExistant) {
      return res.status(400).json({
        succes: false,
        message: 'Ce numéro de permis est déjà utilisé par un autre chauffeur',
      })
    }

    // ── Validation de la date d'expiration du permis (doit être dans le futur) ──
    if (date_expiration_permis && new Date(date_expiration_permis) <= new Date()) {
      return res.status(400).json({
        succes: false,
        message: 'La date d\'expiration du permis doit être dans le futur',
      })
    }

    // ── Validation du téléphone (si fourni) ──
    if (telephone && telephone.trim() === '') {
      return res.status(400).json({
        succes: false,
        message: 'Le téléphone ne peut pas être vide',
      })
    }

    // ── Création du chauffeur ──
    const nouveauChauffeur = await driverModel.create({
      nom: nom.trim(),
      prenom: prenom.trim(),
      telephone: telephone?.trim(),
      numero_permis: numero_permis.trim(),
      date_expiration_permis,
      statut: statut || 'actif',
      photo_url,
      date_embauche,
      notes,
    })

    // ── Réponse ──
    res.status(201).json({
      succes: true,
      message: 'Chauffeur créé avec succès',
      donnees: nouveauChauffeur,
    })
  } catch (erreur) {
    console.error('❌ driverController.createDriver :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la création du chauffeur',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateDriver
// Met à jour un chauffeur (mise à jour partielle).
// Seuls les champs fournis dans le corps de la requête seront modifiés.
// Rôles requis : admin ou gestionnaire (dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

async function updateDriver(req, res) {
  try {
    const { id } = req.params
    const {
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
    } = req.body

    // ── Validation de l'ID ──
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID du chauffeur invalide',
      })
    }

    // ── Vérification que le chauffeur existe ──
    const chauffeurExistant = await driverModel.findById(parseInt(id, 10))
    if (!chauffeurExistant) {
      return res.status(404).json({
        succes: false,
        message: 'Chauffeur introuvable',
      })
    }

    // ── Validation des champs fournis ──
    const erreurs = []

    if (statut !== undefined && !STATUTS_AUTORISES.includes(statut)) {
      erreurs.push(`Le statut doit être parmi : ${STATUTS_AUTORISES.join(', ')}`)
    }

    if (date_expiration_permis && new Date(date_expiration_permis) <= new Date()) {
      erreurs.push('La date d\'expiration du permis doit être dans le futur')
    }

    if (erreurs.length > 0) {
      return res.status(400).json({
        succes: false,
        message: 'Erreurs de validation',
        erreurs,
      })
    }

    // ── Vérification de l'unicité du numéro de permis (si modifié) ──
    if (numero_permis && numero_permis.trim() !== chauffeurExistant.numero_permis) {
      const permisExistant = await driverModel.findByNumeroPermis(numero_permis.trim())
      if (permisExistant && permisExistant.id !== parseInt(id, 10)) {
        return res.status(400).json({
          succes: false,
          message: 'Ce numéro de permis est déjà utilisé par un autre chauffeur',
        })
      }
    }

    // ── Mise à jour ──
    const chauffeurMisAJour = await driverModel.update(parseInt(id, 10), {
      nom: nom !== undefined ? nom.trim() : undefined,
      prenom: prenom !== undefined ? prenom.trim() : undefined,
      telephone: telephone !== undefined ? telephone.trim() : undefined,
      numero_permis: numero_permis !== undefined ? numero_permis.trim() : undefined,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
    })

    // ── Réponse ──
    res.json({
      succes: true,
      message: 'Chauffeur mis à jour avec succès',
      donnees: chauffeurMisAJour,
    })
  } catch (erreur) {
    console.error('❌ driverController.updateDriver :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la mise à jour du chauffeur',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteDriver
// Désactive un chauffeur (soft delete) — change le statut en 'inactif'.
// Rôles requis : admin uniquement
// ─────────────────────────────────────────────────────────────────────────────

async function deleteDriver(req, res) {
  try {
    const { id } = req.params

    // ── Validation de l'ID ──
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID du chauffeur invalide',
      })
    }

    // ── Vérification que le chauffeur existe ──
    const chauffeur = await driverModel.findById(parseInt(id, 10))
    if (!chauffeur) {
      return res.status(404).json({
        succes: false,
        message: 'Chauffeur introuvable',
      })
    }

    // ── Soft delete (désactivation) ──
    const chauffeurDesactive = await driverModel.remove(parseInt(id, 10))

    // ── Réponse ──
    res.json({
      succes: true,
      message: 'Chauffeur désactivé avec succès',
      donnees: chauffeurDesactive,
    })
  } catch (erreur) {
    console.error('❌ driverController.deleteDriver :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la désactivation du chauffeur',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPermisAlertes
// Récupère les chauffeurs avec un permis expirant bientôt ou expiré.
// ─────────────────────────────────────────────────────────────────────────────

async function getPermisAlertes(req, res) {
  try {
    // ── Récupération des chauffeurs en alerte ──
    const chauffeursAlertes = await driverModel.getPermisAlertes()

    // ── Comptage par type d'alerte ──
    const permisExpires = chauffeursAlertes.filter(
      c => c.etat_permis === 'expire'
    ).length

    const permisBientotExpires = chauffeursAlertes.filter(
      c => c.etat_permis === 'bientot_expire'
    ).length

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: chauffeursAlertes,
      resume: {
        total: chauffeursAlertes.length,
        expires: permisExpires,
        bientotExpires: permisBientotExpires,
      },
    })
  } catch (erreur) {
    console.error('❌ driverController.getPermisAlertes :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des alertes permis',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// countDrivers
// Retourne le nombre total de chauffeurs (optionnellement par statut).
// Utile pour les KPI du dashboard.
// ─────────────────────────────────────────────────────────────────────────────

async function countDrivers(req, res) {
  try {
    const { statut } = req.query

    const total = await driverModel.count(statut || null)

    res.json({
      succes: true,
      donnees: { total },
    })
  } catch (erreur) {
    console.error('❌ driverController.countDrivers :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors du comptage des chauffeurs',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getDrivers,
  getDriver,
  getAvailable,
  createDriver,
  updateDriver,
  deleteDriver,
  getPermisAlertes,
  countDrivers,
}