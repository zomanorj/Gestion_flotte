/**
 * missionController.js
 * Contrôleur HTTP pour la gestion des missions — TransiFlow.
 *
 * Ce module fait le lien entre les routes HTTP et le modèle de données.
 * Il valide les entrées, appelle le modèle, et formate les réponses JSON.
 *
 * Fonctions exportées :
 *   - getMissions(req, res)      → GET /api/missions (liste paginée avec filtres)
 *   - getMission(req, res)       → GET /api/missions/:id
 *   - getMissionsByDate(req, res)→ GET /api/missions/planning?date=X
 *   - createMission(req, res)    → POST /api/missions
 *   - updateMission(req, res)    → PUT /api/missions/:id
 *   - updateStatutMission(req,res)→ PATCH /api/missions/:id/statut
 *   - deleteMission(req, res)    → DELETE /api/missions/:id (soft delete)
 *   - getMissionStats(req, res)  → GET /api/missions/stats
 */

const missionModel = require('../models/missionModel')

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de validation
// ─────────────────────────────────────────────────────────────────────────────

const STATUTS_AUTORISES = missionModel.STATUTS_AUTORISES

// Villes principales de Madagascar pour les suggestions
const VILLES_PRINCIPALES = [
  'Antananarivo', 'Toamasina', 'Mahajanga', 'Fianarantsoa',
  'Toliary', 'Antsiranana', 'Antsirabe'
]

// ─────────────────────────────────────────────────────────────────────────────
// getMissions
// Récupère la liste paginée des missions avec filtres optionnels.
// Query params : page, limit, search, statut, date, vehicle_id, driver_id
// ─────────────────────────────────────────────────────────────────────────────

async function getMissions(req, res) {
  try {
    // ── Parsing et validation des paramètres de requête ──
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const search = (req.query.search || '').trim()
    const statut = (req.query.statut || '').trim()
    const date = (req.query.date || '').trim()
    const vehicle_id = req.query.vehicle_id ? parseInt(req.query.vehicle_id, 10) : null
    const driver_id = req.query.driver_id ? parseInt(req.query.driver_id, 10) : null

    // ── Appel au modèle ──
    const resultat = await missionModel.findAll({
      page,
      limit,
      search,
      statut,
      date,
      vehicle_id,
      driver_id,
    })

    // ── Calcul des métadonnées de pagination ──
    const totalPages = Math.ceil(resultat.total / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    // ── Réponse JSON structurée ──
    res.json({
      succes: true,
      donnees: resultat.missions,
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
    console.error('❌ missionController.getMissions :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des missions',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMission
// Récupère les détails d'une mission par son identifiant.
// ─────────────────────────────────────────────────────────────────────────────

async function getMission(req, res) {
  try {
    const { id } = req.params

    // Validation de l'ID
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID de la mission invalide',
      })
    }

    // ── Recherche de la mission ──
    const mission = await missionModel.findById(parseInt(id, 10))

    if (!mission) {
      return res.status(404).json({
        succes: false,
        message: 'Mission introuvable',
      })
    }

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: mission,
    })
  } catch (erreur) {
    console.error('❌ missionController.getMission :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération de la mission',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMissionsByDate
// Récupère toutes les missions d'une date donnée (pour le planning).
// Query param : date (format YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────────────────────

async function getMissionsByDate(req, res) {
  try {
    const { date } = req.query

    // Validation de la date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        succes: false,
        message: 'Date invalide. Format attendu : YYYY-MM-DD',
      })
    }

    // ── Récupération des missions du jour ──
    const missions = await missionModel.findByDate(date)

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: missions,
    })
  } catch (erreur) {
    console.error('❌ missionController.getMissionsByDate :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des missions du jour',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createMission
// Crée une nouvelle mission avec validation complète des données.
// Rôles requis : admin ou gestionnaire (dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

async function createMission(req, res) {
  try {
    const {
      vehicle_id,
      driver_id,
      lieu_depart,
      lieu_arrivee,
      date_mission,
      heure_depart,
      heure_arrivee_prevue,
      chargement,
      poids_tonne,
      distance_km,
      depart_lat,
      depart_lng,
      arrivee_lat,
      arrivee_lng,
      trajet_points,
      statut,
      notes,
    } = req.body

    // ── Validation des champs obligatoires ──
    const erreurs = []

    if (!lieu_depart || !lieu_depart.trim()) {
      erreurs.push('Le lieu de départ est obligatoire')
    }

    if (!lieu_arrivee || !lieu_arrivee.trim()) {
      erreurs.push('Le lieu d\'arrivée est obligatoire')
    }

    // Vérifier que départ et arrivée sont différents
    if (lieu_depart && lieu_arrivee && lieu_depart.trim().toLowerCase() === lieu_arrivee.trim().toLowerCase()) {
      erreurs.push('Le lieu de départ et le lieu d\'arrivée doivent être différents')
    }

    if (!date_mission) {
      erreurs.push('La date de mission est obligatoire')
    } else {
      // Vérifier que la date n'est pas dans le passé
      const aujourdHui = new Date()
      aujourdHui.setHours(0, 0, 0, 0)
      const dateMission = new Date(date_mission)
      if (dateMission < aujourdHui) {
        erreurs.push('La date de mission ne peut pas être dans le passé')
      }
    }

    // Pour le statut 'planifiee', vehicle_id et driver_id sont obligatoires
    if (statut === 'planifiee') {
      if (!vehicle_id) {
        erreurs.push('Le véhicule est obligatoire pour une mission planifiée')
      }
      if (!driver_id) {
        erreurs.push('Le chauffeur est obligatoire pour une mission planifiée')
      }
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

    // ── Vérification des conflits (si vehicle_id ou driver_id fourni) ──
    if (vehicle_id || driver_id) {
      const conflits = await missionModel.checkConflict(vehicle_id, driver_id, date_mission)

      if (conflits.vehicle || conflits.driver) {
        const messagesConflit = []
        if (conflits.vehicle) {
          messagesConflit.push(`Le véhicule est déjà assigné à la mission #${conflits.vehicle.id} (${conflits.vehicle.lieu_depart} → ${conflits.vehicle.lieu_arrivee})`)
        }
        if (conflits.driver) {
          messagesConflit.push(`Le chauffeur est déjà assigné à la mission #${conflits.driver.id} (${conflits.driver.lieu_depart} → ${conflits.driver.lieu_arrivee})`)
        }

        return res.status(409).json({
          succes: false,
          message: 'Conflit détecté',
          conflits: {
            vehicle: conflits.vehicle ? {
              mission_id: conflits.vehicle.id,
              trajet: `${conflits.vehicle.lieu_depart} → ${conflits.vehicle.lieu_arrivee}`,
            } : null,
            driver: conflits.driver ? {
              mission_id: conflits.driver.id,
              trajet: `${conflits.driver.lieu_depart} → ${conflits.driver.lieu_arrivee}`,
            } : null,
          },
          messages: messagesConflit,
        })
      }
    }

    // ── Création de la mission ──
    const nouvelleMission = await missionModel.create({
      vehicle_id: vehicle_id || null,
      driver_id: driver_id || null,
      lieu_depart: lieu_depart.trim(),
      lieu_arrivee: lieu_arrivee.trim(),
      date_mission,
      heure_depart: heure_depart || null,
      heure_arrivee_prevue: heure_arrivee_prevue || null,
      chargement: chargement || null,
      poids_tonne: poids_tonne || null,
      distance_km: distance_km || null,
      depart_lat: depart_lat || null,
      depart_lng: depart_lng || null,
      arrivee_lat: arrivee_lat || null,
      arrivee_lng: arrivee_lng || null,
      trajet_points: trajet_points || null,
      statut: statut || 'brouillon',
      notes: notes || null,
      created_by: req.utilisateur?.id || null,
    })

    // ── Réponse ──
    res.status(201).json({
      succes: true,
      message: 'Mission créée avec succès',
      donnees: nouvelleMission,
    })
  } catch (erreur) {
    console.error('❌ missionController.createMission :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la création de la mission',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateMission
// Met à jour une mission existante (mise à jour partielle).
// Rôles requis : admin ou gestionnaire (dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

async function updateMission(req, res) {
  try {
    const { id } = req.params
    const {
      vehicle_id,
      driver_id,
      lieu_depart,
      lieu_arrivee,
      date_mission,
      heure_depart,
      heure_arrivee_prevue,
      chargement,
      poids_tonne,
      distance_km,
      depart_lat,
      depart_lng,
      arrivee_lat,
      arrivee_lng,
      trajet_points,
      notes,
    } = req.body

    // ── Validation de l'ID ──
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID de la mission invalide',
      })
    }

    // ── Vérification que la mission existe ──
    const missionExistant = await missionModel.findById(parseInt(id, 10))
    if (!missionExistant) {
      return res.status(404).json({
        succes: false,
        message: 'Mission introuvable',
      })
    }

    // ── Validation des champs fournis ──
    const erreurs = []

    if (lieu_depart !== undefined && !lieu_depart.trim()) {
      erreurs.push('Le lieu de départ ne peut pas être vide')
    }

    if (lieu_arrivee !== undefined && !lieu_arrivee.trim()) {
      erreurs.push('Le lieu d\'arrivée ne peut pas être vide')
    }

    // Vérifier que départ et arrivée sont différents (si les deux sont fournis)
    if (lieu_depart !== undefined && lieu_arrivee !== undefined &&
        lieu_depart.trim().toLowerCase() === lieu_arrivee.trim().toLowerCase()) {
      erreurs.push('Le lieu de départ et le lieu d\'arrivée doivent être différents')
    }

    if (erreurs.length > 0) {
      return res.status(400).json({
        succes: false,
        message: 'Erreurs de validation',
        erreurs,
      })
    }

    // ── Vérification des conflits si date, vehicle ou driver change ──
    const dateAModification = date_mission !== undefined && date_mission !== missionExistant.date_mission
    const vehicleAModification = vehicle_id !== undefined && vehicle_id !== missionExistant.vehicle_id
    const driverAModification = driver_id !== undefined && driver_id !== missionExistant.driver_id

    // On vérifie les conflits seulement si un des éléments critiques change
    if (dateAModification || vehicleAModification || driverAModification) {
      const nouvelleDate = dateAModification ? date_mission : missionExistant.date_mission
      const nouveauVehicle = vehicle_id !== undefined ? vehicle_id : missionExistant.vehicle_id
      const nouveauDriver = driver_id !== undefined ? driver_id : missionExistant.driver_id

      if (nouveauVehicle || nouveauDriver) {
        const conflits = await missionModel.checkConflict(nouveauVehicle, nouveauDriver, nouvelleDate, parseInt(id, 10))

        if (conflits.vehicle || conflits.driver) {
          const messagesConflit = []
          if (conflits.vehicle) {
            messagesConflit.push(`Le véhicule est déjà assigné à la mission #${conflits.vehicle.id}`)
          }
          if (conflits.driver) {
            messagesConflit.push(`Le chauffeur est déjà assigné à la mission #${conflits.driver.id}`)
          }

          return res.status(409).json({
            succes: false,
            message: 'Conflit détecté',
            conflits: {
              vehicle: conflits.vehicle,
              driver: conflits.driver,
            },
            messages: messagesConflit,
          })
        }
      }
    }

    // ── Mise à jour ──
    const missionMiseAJour = await missionModel.update(parseInt(id, 10), {
      vehicle_id,
      driver_id,
      lieu_depart: lieu_depart ? lieu_depart.trim() : undefined,
      lieu_arrivee: lieu_arrivee ? lieu_arrivee.trim() : undefined,
      date_mission,
      heure_depart,
      heure_arrivee_prevue,
      chargement,
      poids_tonne,
      distance_km,
      depart_lat,
      depart_lng,
      arrivee_lat,
      arrivee_lng,
      trajet_points,
      notes,
    })

    // ── Réponse ──
    res.json({
      succes: true,
      message: 'Mission mise à jour avec succès',
      donnees: missionMiseAJour,
    })
  } catch (erreur) {
    console.error('❌ missionController.updateMission :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la mise à jour de la mission',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateStatutMission
// Change le statut d'une mission selon le workflow défini.
// Workflow : brouillon → planifiee → en_cours → terminee
//                    ↘ annulee (depuis brouillon ou planifiee)
// ─────────────────────────────────────────────────────────────────────────────

async function updateStatutMission(req, res) {
  try {
    const { id } = req.params
    const { statut } = req.body

    // ── Validation de l'ID ──
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID de la mission invalide',
      })
    }

    // ── Validation du statut ──
    if (!statut || !STATUTS_AUTORISES.includes(statut)) {
      return res.status(400).json({
        succes: false,
        message: `Statut invalide. Statuts autorisés : ${STATUTS_AUTORISES.join(', ')}`,
      })
    }

    // ── Mise à jour du statut ──
    const resultat = await missionModel.updateStatut(parseInt(id, 10), statut)

    if (!resultat) {
      return res.status(404).json({
        succes: false,
        message: 'Mission introuvable',
      })
    }

    if (resultat.error === 'transition_interdite') {
      return res.status(400).json({
        succes: false,
        message: resultat.message,
        statutActuel: resultat.statutActuel,
        transitionsAutorisees: resultat.transitionsAutorisees,
      })
    }

    // ── Réponse ──
    res.json({
      succes: true,
      message: 'Statut de la mission mis à jour avec succès',
      donnees: resultat,
    })
  } catch (erreur) {
    console.error('❌ missionController.updateStatutMission :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la mise à jour du statut',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteMission
// Archive une mission (soft delete) — change le statut en 'annulee'.
// Rôles requis : admin uniquement
// ─────────────────────────────────────────────────────────────────────────────

async function deleteMission(req, res) {
  try {
    const { id } = req.params

    // ── Validation de l'ID ──
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID de la mission invalide',
      })
    }

    // ── Vérification que la mission existe ──
    const mission = await missionModel.findById(parseInt(id, 10))
    if (!mission) {
      return res.status(404).json({
        succes: false,
        message: 'Mission introuvable',
      })
    }

    // ── Soft delete (archivage) ──
    const missionAnnulee = await missionModel.remove(parseInt(id, 10))

    // ── Réponse ──
    res.json({
      succes: true,
      message: 'Mission annulée avec succès',
      donnees: missionAnnulee,
    })
  } catch (erreur) {
    console.error('❌ missionController.deleteMission :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de l\'annulation de la mission',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMissionStats
// Récupère les statistiques globales des missions.
// ─────────────────────────────────────────────────────────────────────────────

async function getMissionStats(req, res) {
  try {
    // ── Récupération des statistiques ──
    const stats = await missionModel.getStats()

    // ── Réponse ──
    res.json({
      succes: true,
      donnees: stats,
    })
  } catch (erreur) {
    console.error('❌ missionController.getMissionStats :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// countMissions
// Retourne le nombre total de missions (optionnellement par statut).
// ─────────────────────────────────────────────────────────────────────────────

async function countMissions(req, res) {
  try {
    const { statut } = req.query

    const total = await missionModel.count(statut || null)

    res.json({
      succes: true,
      donnees: { total },
    })
  } catch (erreur) {
    console.error('❌ missionController.countMissions :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors du comptage des missions',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getMissions,
  getMission,
  getMissionsByDate,
  createMission,
  updateMission,
  updateStatutMission,
  deleteMission,
  getMissionStats,
  countMissions,
  VILLES_PRINCIPALES,
}