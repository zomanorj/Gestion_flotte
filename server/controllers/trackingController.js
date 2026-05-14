/**
 * trackingController.js
 * Contrôleur HTTP pour le suivi GPS des missions — Transport STTA.
 *
 * Ce module fait le lien entre les routes HTTP et le modèle de données.
 * Il valide les entrées, appelle le modèle, et formate les réponses JSON.
 *
 * Fonctions exportées :
 *   - getActiveVehicles(req, res)    → GET /api/tracking/active
 *   - getMissionTracking(req, res)   → GET /api/tracking/mission/:id
 *   - updatePosition(req, res)       → POST /api/tracking/position
 */

const trackingModel = require('../models/trackingModel')
const missionModel = require('../models/missionModel')

// ─────────────────────────────────────────────────────────────────────────────
// getActiveVehicles
// Récupère toutes les missions en cours avec leur dernière position connue.
// Accessible à tous les rôles authentifiés.
// ─────────────────────────────────────────────────────────────────────────────

async function getActiveVehicles(req, res) {
  try {
    const missions = await trackingModel.findAllActive()

    // Si pas de position GPS réelle, on utilise les coordonnées du lieu de départ
    const missionsAvecPosition = missions.map(mission => {
      if (!mission.position) {
        // Essayer de trouver les coordonnées du lieu de départ
        const coordsDepart = trackingModel.trouverCoordonneesVille(mission.lieu_depart)
        if (coordsDepart) {
          mission.position = {
            latitude: coordsDepart.lat,
            longitude: coordsDepart.lng,
            vitesse: 0,
            horodatage: null,
            est_simulee: true,
          }
        }
      } else {
        mission.position.est_simulee = false
      }

      return mission
    })

    res.json({
      succes: true,
      donnees: missionsAvecPosition,
      metadata: {
        total: missionsAvecPosition.length,
        horodatage: new Date().toISOString(),
      },
    })
  } catch (erreur) {
    console.error('❌ trackingController.getActiveVehicles :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération des véhicules actifs',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMissionTracking
// Récupère l'historique des positions d'une mission spécifique.
// Accessible à tous les rôles authentifiés.
// ─────────────────────────────────────────────────────────────────────────────

async function getMissionTracking(req, res) {
  try {
    const { id } = req.params

    // Validation de l'ID
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID de la mission invalide',
      })
    }

    const missionId = parseInt(id, 10)

    // Vérifier que la mission existe
    const mission = await missionModel.findById(missionId)
    if (!mission) {
      return res.status(404).json({
        succes: false,
        message: 'Mission introuvable',
      })
    }

    // Récupérer l'historique des positions
    const historique = await trackingModel.findByMission(missionId)

    res.json({
      succes: true,
      donnees: {
        mission: {
          id: mission.id,
          lieu_depart: mission.lieu_depart,
          lieu_arrivee: mission.lieu_arrivee,
          statut: mission.statut,
        },
        historique,
      },
    })
  } catch (erreur) {
    console.error('❌ trackingController.getMissionTracking :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la récupération du suivi de la mission',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updatePosition
// Met à jour la position GPS d'un véhicule pour une mission.
// Réservé aux chauffeurs qui sont assignés à la mission.
// ─────────────────────────────────────────────────────────────────────────────

async function updatePosition(req, res) {
  try {
    const { mission_id, latitude, longitude, vitesse, horodatage } = req.body

    // ── Validation des champs obligatoires ──
    if (!mission_id) {
      return res.status(400).json({
        succes: false,
        message: 'L\'ID de la mission est obligatoire',
      })
    }

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        succes: false,
        message: 'Les coordonnées latitude et longitude sont obligatoires',
      })
    }

    // Validation des coordonnées
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        succes: false,
        message: 'Latitude invalide. Doit être comprise entre -90 et 90',
      })
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        succes: false,
        message: 'Longitude invalide. Doit être comprise entre -180 et 180',
      })
    }

    // ── Vérification que l'utilisateur est le chauffeur de la mission ──
    const utilisateur = req.utilisateur
    if (!utilisateur) {
      return res.status(401).json({
        succes: false,
        message: 'Utilisateur non authentifié',
      })
    }

    // Récupérer la mission pour vérifier que l'utilisateur est le chauffeur
    const mission = await missionModel.findById(parseInt(mission_id, 10))

    if (!mission) {
      return res.status(404).json({
        succes: false,
        message: 'Mission introuvable',
      })
    }

    // Vérifier que l'utilisateur est le chauffeur de la mission
    // (soit via drivers.user_id, soit via le rôle chauffeur)
    if (utilisateur.role !== 'admin') {
      // Pour les non-admin, on vérifie qu'ils sont le chauffeur de la mission
      if (!mission.driver || mission.driver.id !== utilisateur.id) {
        // Vérifier aussi si l'utilisateur est lié au driver via user_id
        const driverModel = require('../models/driverModel')
        const driver = await driverModel.findById(mission.driver_id)

        if (!driver || driver.user_id !== utilisateur.id) {
          return res.status(403).json({
            succes: false,
            message: 'Accès refusé. Vous n\'êtes pas le chauffeur de cette mission.',
          })
        }
      }
    }

    // ── Mise à jour de la position ──
    const position = await trackingModel.upsertPosition(parseInt(mission_id, 10), {
      latitude: lat,
      longitude: lng,
      vitesse: vitesse ? parseInt(vitesse, 10) : 0,
      horodatage: horodatage || null,
    })

    res.json({
      succes: true,
      message: 'Position mise à jour avec succès',
      donnees: {
        id: position.id,
        latitude: parseFloat(position.latitude),
        longitude: parseFloat(position.longitude),
        vitesse: position.vitesse,
        horodatage: position.horodatage,
      },
    })
  } catch (erreur) {
    console.error('❌ trackingController.updatePosition :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la mise à jour de la position',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getActiveVehicles,
  getMissionTracking,
  updatePosition,
}