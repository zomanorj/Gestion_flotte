/**
 * trackingModel.js
 * Modèle de données pour le suivi GPS des missions — Transport STTA.
 *
 * Ce module contient toutes les requêtes SQL brutes pour manipuler
 * la table `tracking` de la base de données PostgreSQL.
 *
 * Fonctions exportées :
 *   - findAllActive()                    → toutes les missions en_cours avec dernière position
 *   - findByMission(mission_id)          → historique des positions d'une mission
 *   - upsertPosition(mission_id, data)   → INSERT ou UPDATE la position courante
 *   - getLastPosition(mission_id)        → dernière position enregistrée
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// Coordonnées des villes principales de Madagascar (pour fallback/simulation)
// ─────────────────────────────────────────────────────────────────────────────

const COORDONNEES_VILLES = {
  'Antananarivo': { lat: -18.9137, lng: 47.5361 },
  'Toamasina':    { lat: -18.1443, lng: 49.4023 },
  'Mahajanga':    { lat: -15.7167, lng: 46.3167 },
  'Fianarantsoa': { lat: -21.4545, lng: 47.0833 },
  'Toliary':      { lat: -23.3500, lng: 43.6667 },
  'Antsirabe':    { lat: -19.8659, lng: 47.0333 },
  'Antsiranana':  { lat: -12.2794, lng: 49.2969 },
}

/**
 * Trouve les coordonnées d'une ville par recherche approximative.
 * @param {string} nomVille - Nom de la ville à rechercher
 * @returns {{ lat: number, lng: number } | null}
 */
function trouverCoordonneesVille(nomVille) {
  if (!nomVille) return null

  const nomNormalise = nomVille.toLowerCase().trim()

  // Recherche exacte
  for (const [ville, coords] of Object.entries(COORDONNEES_VILLES)) {
    if (ville.toLowerCase() === nomNormalise) {
      return coords
    }
  }

  // Recherche partielle (commence par)
  for (const [ville, coords] of Object.entries(COORDONNEES_VILLES)) {
    if (ville.toLowerCase().startsWith(nomNormalise.substring(0, 4))) {
      return coords
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// findAllActive
// Récupère toutes les missions en cours avec leur dernière position connue.
// ─────────────────────────────────────────────────────────────────────────────

async function findAllActive() {
  const query = `
    SELECT
      m.id as mission_id,
      m.lieu_depart,
      m.lieu_arrivee,
      m.date_mission,
      m.heure_depart,
      m.statut as mission_statut,
      -- Véhicule
      v.immatriculation as vehicle_immatriculation,
      v.type as vehicle_type,
      -- Chauffeur
      d.nom as driver_nom,
      d.prenom as driver_prenom,
      d.telephone as driver_telephone,
      -- Dernière position
      t.latitude,
      t.longitude,
      t.vitesse,
      t.horodatage as dernier_horodatage
    FROM missions m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    LEFT JOIN drivers d ON m.driver_id = d.id
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, vitesse, horodatage
      FROM tracking
      WHERE mission_id = m.id
      ORDER BY horodatage DESC
      LIMIT 1
    ) t ON true
    WHERE m.statut = 'en_cours'
    ORDER BY m.date_mission DESC, m.heure_depart DESC
  `

  try {
    const result = await pool.query(query)

    return result.rows.map(row => ({
      mission_id: row.mission_id,
      lieu_depart: row.lieu_depart,
      lieu_arrivee: row.lieu_arrivee,
      date_mission: row.date_mission,
      heure_depart: row.heure_depart,
      statut: row.mission_statut,
      vehicle: {
        immatriculation: row.vehicle_immatriculation,
        type: row.vehicle_type,
      },
      driver: {
        nom: row.driver_nom,
        prenom: row.driver_prenom,
        telephone: row.driver_telephone,
      },
      position: row.latitude ? {
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        vitesse: row.vitesse || 0,
        horodatage: row.dernier_horodatage,
      } : null,
    }))
  } catch (erreur) {
    console.error('❌ trackingModel.findAllActive : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findByMission
// Récupère l'historique complet des positions d'une mission.
// ─────────────────────────────────────────────────────────────────────────────

async function findByMission(mission_id) {
  const query = `
    SELECT
      id,
      latitude,
      longitude,
      vitesse,
      horodatage
    FROM tracking
    WHERE mission_id = $1
    ORDER BY horodatage ASC
  `

  try {
    const result = await pool.query(query, [mission_id])

    return result.rows.map(row => ({
      id: row.id,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      vitesse: row.vitesse || 0,
      horodatage: row.horodatage,
    }))
  } catch (erreur) {
    console.error('❌ trackingModel.findByMission : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// upsertPosition
// Insère une nouvelle position ou met à jour la position courante.
// Si une position existe déjà pour cette mission, on la met à jour,
// sinon on en crée une nouvelle.
// ─────────────────────────────────────────────────────────────────────────────

async function upsertPosition(mission_id, { latitude, longitude, vitesse = 0, horodatage = null }) {
  // Vérifier d'abord s'il existe déjà une position pour cette mission
  const checkQuery = `
    SELECT id FROM tracking WHERE mission_id = $1 ORDER BY horodatage DESC LIMIT 1
  `

  try {
    const checkResult = await pool.query(checkQuery, [mission_id])

    if (checkResult.rows.length > 0) {
      // UPDATE : mettre à jour la dernière position
      const updateQuery = `
        UPDATE tracking
        SET
          latitude = $2,
          longitude = $3,
          vitesse = $4,
          horodatage = COALESCE($5, NOW())
        WHERE id = $1
        RETURNING *
      `

      const result = await pool.query(updateQuery, [
        checkResult.rows[0].id,
        latitude,
        longitude,
        vitesse,
        horodatage,
      ])

      return result.rows[0]
    } else {
      // INSERT : créer une nouvelle position
      const insertQuery = `
        INSERT INTO tracking (mission_id, latitude, longitude, vitesse, horodatage)
        VALUES ($1, $2, $3, $4, COALESCE($5, NOW()))
        RETURNING *
      `

      const result = await pool.query(insertQuery, [
        mission_id,
        latitude,
        longitude,
        vitesse,
        horodatage,
      ])

      return result.rows[0]
    }
  } catch (erreur) {
    console.error('❌ trackingModel.upsertPosition : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getLastPosition
// Récupère la dernière position enregistrée pour une mission.
// ─────────────────────────────────────────────────────────────────────────────

async function getLastPosition(mission_id) {
  const query = `
    SELECT
      id,
      latitude,
      longitude,
      vitesse,
      horodatage
    FROM tracking
    WHERE mission_id = $1
    ORDER BY horodatage DESC
    LIMIT 1
  `

  try {
    const result = await pool.query(query, [mission_id])

    if (result.rows.length === 0) {
      return null
    }

    return {
      id: result.rows[0].id,
      latitude: parseFloat(result.rows[0].latitude),
      longitude: parseFloat(result.rows[0].longitude),
      vitesse: result.rows[0].vitesse || 0,
      horodatage: result.rows[0].horodatage,
    }
  } catch (erreur) {
    console.error('❌ trackingModel.getLastPosition : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions et constantes
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  findAllActive,
  findByMission,
  upsertPosition,
  getLastPosition,
  COORDONNEES_VILLES,
  trouverCoordonneesVille,
}