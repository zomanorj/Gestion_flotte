/**
 * missionModel.js
 * Modèle de données pour la gestion des missions — TransiFlow.
 *
 * Ce module contient toutes les requêtes SQL brutes (sans ORM) pour
 * manipuler la table `missions` de la base de données PostgreSQL.
 *
 * Fonctions exportées :
 *   - findAll({ page, limit, search, statut, date, vehicle_id, driver_id }) → liste paginée
 *   - findById(id)                    → détail avec JOIN vehicle + driver
 *   - findByDate(date)                → toutes les missions d'un jour
 *   - checkConflict(vehicle_id, driver_id, date_mission) → vérifie les conflits
 *   - create(data)                    → créer une mission
 *   - update(id, data)                → mise à jour partielle
 *   - updateStatut(id, statut)        → changer uniquement le statut
 *   - remove(id)                      → soft delete (statut = 'annulee')
 *   - getStats()                      → stats globales
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// Constantes : statuts autorisés et workflow
// ─────────────────────────────────────────────────────────────────────────────

const STATUTS_AUTORISES = ['brouillon', 'planifiee', 'en_cours', 'terminee', 'annulee']

// Workflow de transitions de statut autorisées
const WORKFLOW_STATUT = {
  'brouillon':   ['planifiee', 'annulee'],
  'planifiee':   ['en_cours', 'annulee'],
  'en_cours':    ['terminee'],
  'terminee':    [],  // statut final, aucune transition possible
  'annulee':     [],  // statut final, aucune transition possible
}

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// Récupère la liste des missions avec pagination, recherche et filtrage.
// Retourne un objet avec les missions ET le total pour la pagination frontend.
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({
  page = 1,
  limit = 10,
  search = '',
  statut = '',
  date = '',
  vehicle_id = null,
  driver_id = null,
} = {}) {
  // Calcul de l'offset pour la pagination
  const offset = (page - 1) * limit

  // Construction dynamique de la requête selon les filtres
  let whereClauses = []
  let values = []
  let paramIndex = 1

  // Filtre par recherche textuelle (lieu de départ ou d'arrivée)
  if (search) {
    whereClauses.push(`(LOWER(m.lieu_depart) LIKE $${paramIndex} OR LOWER(m.lieu_arrivee) LIKE $${paramIndex})`)
    values.push(`%${search.toLowerCase()}%`)
    paramIndex++
  }

  // Filtre par statut
  if (statut && statut !== 'tous') {
    whereClauses.push(`m.statut = $${paramIndex}`)
    values.push(statut)
    paramIndex++
  }

  // Filtre par date (jour précis)
  if (date) {
    whereClauses.push(`m.date_mission = $${paramIndex}`)
    values.push(date)
    paramIndex++
  }

  // Filtre par véhicule
  if (vehicle_id) {
    whereClauses.push(`m.vehicle_id = $${paramIndex}`)
    values.push(vehicle_id)
    paramIndex++
  }

  // Filtre par chauffeur
  if (driver_id) {
    whereClauses.push(`m.driver_id = $${paramIndex}`)
    values.push(driver_id)
    paramIndex++
  }

  // Assemblage de la clause WHERE
  const whereSQL = whereClauses.length > 0
    ? 'WHERE ' + whereClauses.join(' AND ')
    : ''

  // ── Requête principale : récupérer les missions paginées avec jointures ──
  const queryMissions = `
    SELECT
      m.id,
      m.vehicle_id,
      m.driver_id,
      m.lieu_depart,
      m.lieu_arrivee,
      m.date_mission,
      m.heure_depart,
      m.heure_arrivee_prevue,
      m.chargement,
      m.poids_tonne,
      m.distance_km,
      m.depart_lat,
      m.depart_lng,
      m.arrivee_lat,
      m.arrivee_lng,
      m.trajet_points,
      m.statut,
      m.notes,
      m.created_by,
      m.created_at,
      m.updated_at,
      -- Jointure avec vehicles
      v.immatriculation as vehicle_immatriculation,
      v.type as vehicle_type,
      v.capacite as vehicle_capacite,
      -- Jointure avec drivers
      d.nom as driver_nom,
      d.prenom as driver_prenom,
      d.numero_permis as driver_numero_permis
    FROM missions m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    LEFT JOIN drivers d ON m.driver_id = d.id
    ${whereSQL}
    ORDER BY m.date_mission DESC, m.heure_depart DESC, m.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  // ── Requête de comptage : nombre total de missions (pour pagination) ──
  const queryTotal = `
    SELECT COUNT(*) as total
    FROM missions m
    ${whereSQL}
  `

  try {
    // Exécution des deux requêtes en parallèle pour la performance
    const [resultMissions, resultTotal] = await Promise.all([
      pool.query(queryMissions, [...values, limit, offset]),
      pool.query(queryTotal, values),
    ])

    // Formater les missions pour le frontend
    const missions = resultMissions.rows.map(row => ({
      id: row.id,
      vehicle_id: row.vehicle_id,
      driver_id: row.driver_id,
      lieu_depart: row.lieu_depart,
      lieu_arrivee: row.lieu_arrivee,
      date_mission: row.date_mission,
      heure_depart: row.heure_depart,
      heure_arrivee_prevue: row.heure_arrivee_prevue,
      chargement: row.chargement,
      poids_tonne: row.poids_tonne,
      distance_km: row.distance_km,
      depart_lat: row.depart_lat ? parseFloat(row.depart_lat) : null,
      depart_lng: row.depart_lng ? parseFloat(row.depart_lng) : null,
      arrivee_lat: row.arrivee_lat ? parseFloat(row.arrivee_lat) : null,
      arrivee_lng: row.arrivee_lng ? parseFloat(row.arrivee_lng) : null,
      trajet_points: row.trajet_points,
      statut: row.statut,
      notes: row.notes,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Données du véhicule joint
      vehicle: row.vehicle_immatriculation ? {
        id: row.vehicle_id,
        immatriculation: row.vehicle_immatriculation,
        type: row.vehicle_type,
        capacite: row.vehicle_capacite,
      } : null,
      // Données du chauffeur joint
      driver: row.driver_nom ? {
        id: row.driver_id,
        nom: row.driver_nom,
        prenom: row.driver_prenom,
        numero_permis: row.driver_numero_permis,
      } : null,
    }))

    return {
      missions,
      total: parseInt(resultTotal.rows[0].total, 10),
      page: page,
      limit: limit,
    }
  } catch (erreur) {
    console.error('❌ missionModel.findAll : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// Récupère une mission par son identifiant avec les détails du véhicule et du chauffeur.
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const query = `
    SELECT
      m.id,
      m.vehicle_id,
      m.driver_id,
      m.lieu_depart,
      m.lieu_arrivee,
      m.date_mission,
      m.heure_depart,
      m.heure_arrivee_prevue,
      m.chargement,
      m.poids_tonne,
      m.distance_km,
      m.depart_lat,
      m.depart_lng,
      m.arrivee_lat,
      m.arrivee_lng,
      m.trajet_points,
      m.statut,
      m.notes,
      m.client_id,
      m.created_by,
      m.created_at,
      m.updated_at,
      -- Jointure avec vehicles
      v.immatriculation as vehicle_immatriculation,
      v.type as vehicle_type,
      v.capacite as vehicle_capacite,
      -- Jointure avec drivers
      d.nom as driver_nom,
      d.prenom as driver_prenom,
      d.numero_permis as driver_numero_permis,
      -- Jointure avec clients
      c.nom as client_nom,
      c.telephone as client_telephone
    FROM missions m
    LEFT JOIN vehicles  v ON m.vehicle_id  = v.id
    LEFT JOIN drivers   d ON m.driver_id   = d.id
    LEFT JOIN clients   c ON m.client_id   = c.id
    WHERE m.id = $1
  `

  try {
    const result = await pool.query(query, [id])
    const row = result.rows[0]

    if (!row) return null

    return {
      id: row.id,
      vehicle_id: row.vehicle_id,
      driver_id: row.driver_id,
      lieu_depart: row.lieu_depart,
      lieu_arrivee: row.lieu_arrivee,
      date_mission: row.date_mission,
      heure_depart: row.heure_depart,
      heure_arrivee_prevue: row.heure_arrivee_prevue,
      chargement: row.chargement,
      poids_tonne: row.poids_tonne,
      distance_km: row.distance_km,
      depart_lat: row.depart_lat ? parseFloat(row.depart_lat) : null,
      depart_lng: row.depart_lng ? parseFloat(row.depart_lng) : null,
      arrivee_lat: row.arrivee_lat ? parseFloat(row.arrivee_lat) : null,
      arrivee_lng: row.arrivee_lng ? parseFloat(row.arrivee_lng) : null,
      trajet_points: row.trajet_points,
      statut: row.statut,
      notes: row.notes,
      client_id: row.client_id || null,
      client_nom: row.client_nom || null,
      client_telephone: row.client_telephone || null,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      vehicle: row.vehicle_immatriculation ? {
        id: row.vehicle_id,
        immatriculation: row.vehicle_immatriculation,
        type: row.vehicle_type,
        capacite: row.vehicle_capacite,
      } : null,
      driver: row.driver_nom ? {
        id: row.driver_id,
        nom: row.driver_nom,
        prenom: row.driver_prenom,
        numero_permis: row.driver_numero_permis,
      } : null,
    }
  } catch (erreur) {
    console.error('❌ missionModel.findById : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findByDate
// Récupère toutes les missions d'une date donnée (pour le planning).
// ─────────────────────────────────────────────────────────────────────────────

async function findByDate(date) {
  const query = `
    SELECT
      m.id,
      m.vehicle_id,
      m.driver_id,
      m.lieu_depart,
      m.lieu_arrivee,
      m.date_mission,
      m.heure_depart,
      m.heure_arrivee_prevue,
      m.chargement,
      m.poids_tonne,
      m.distance_km,
      m.depart_lat,
      m.depart_lng,
      m.arrivee_lat,
      m.arrivee_lng,
      m.trajet_points,
      m.statut,
      m.notes,
      m.created_at,
      m.updated_at,
      -- Jointure avec vehicles
      v.immatriculation as vehicle_immatriculation,
      v.type as vehicle_type,
      -- Jointure avec drivers
      d.nom as driver_nom,
      d.prenom as driver_prenom
    FROM missions m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    LEFT JOIN drivers d ON m.driver_id = d.id
    WHERE m.date_mission = $1
      AND m.statut NOT IN ('annulee', 'brouillon')
    ORDER BY m.heure_depart ASC NULLS FIRST
  `

  try {
    const result = await pool.query(query, [date])

    return result.rows.map(row => ({
      id: row.id,
      vehicle_id: row.vehicle_id,
      driver_id: row.driver_id,
      lieu_depart: row.lieu_depart,
      lieu_arrivee: row.lieu_arrivee,
      date_mission: row.date_mission,
      heure_depart: row.heure_depart,
      heure_arrivee_prevue: row.heure_arrivee_prevue,
      chargement: row.chargement,
      poids_tonne: row.poids_tonne,
      distance_km: row.distance_km,
      depart_lat: row.depart_lat ? parseFloat(row.depart_lat) : null,
      depart_lng: row.depart_lng ? parseFloat(row.depart_lng) : null,
      arrivee_lat: row.arrivee_lat ? parseFloat(row.arrivee_lat) : null,
      arrivee_lng: row.arrivee_lng ? parseFloat(row.arrivee_lng) : null,
      trajet_points: row.trajet_points,
      statut: row.statut,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      vehicle: {
        id: row.vehicle_id,
        immatriculation: row.vehicle_immatriculation,
        type: row.vehicle_type,
      },
      driver: {
        id: row.driver_id,
        nom: row.driver_nom,
        prenom: row.driver_prenom,
      },
    }))
  } catch (erreur) {
    console.error('❌ missionModel.findByDate : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// checkConflict
// Vérifie si un véhicule ou un chauffeur est déjà occupé à une date donnée.
// Retourne les conflits trouvés.
// ─────────────────────────────────────────────────────────────────────────────

async function checkConflict(vehicle_id, driver_id, date_mission, excludeMissionId = null) {
  const conflicts = {
    vehicle: null,
    driver: null,
  }

  try {
    // Vérifier si le véhicule est déjà assigné à une mission ce jour-là
    if (vehicle_id) {
      let queryVehicle = `
        SELECT m.id, m.lieu_depart, m.lieu_arrivee, m.statut
        FROM missions m
        WHERE m.vehicle_id = $1
          AND m.date_mission = $2
          AND m.statut NOT IN ('annulee', 'terminee', 'brouillon')
      `
      const paramsVehicle = [vehicle_id, date_mission]

      // Exclure la mission actuelle si on est en mode modification
      if (excludeMissionId) {
        queryVehicle += ' AND m.id != $3'
        paramsVehicle.push(excludeMissionId)
      }

      const resultVehicle = await pool.query(queryVehicle, paramsVehicle)
      if (resultVehicle.rows.length > 0) {
        conflicts.vehicle = resultVehicle.rows[0]
      }
    }

    // Vérifier si le chauffeur est déjà assigné à une mission ce jour-là
    if (driver_id) {
      let queryDriver = `
        SELECT m.id, m.lieu_depart, m.lieu_arrivee, m.statut
        FROM missions m
        WHERE m.driver_id = $1
          AND m.date_mission = $2
          AND m.statut NOT IN ('annulee', 'terminee', 'brouillon')
      `
      const paramsDriver = [driver_id, date_mission]

      if (excludeMissionId) {
        queryDriver += ' AND m.id != $3'
        paramsDriver.push(excludeMissionId)
      }

      const resultDriver = await pool.query(queryDriver, paramsDriver)
      if (resultDriver.rows.length > 0) {
        conflicts.driver = resultDriver.rows[0]
      }
    }

    return conflicts
  } catch (erreur) {
    console.error('❌ missionModel.checkConflict : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// Insère une nouvelle mission dans la base de données.
// Retourne la mission créée avec son id généré automatiquement.
// ─────────────────────────────────────────────────────────────────────────────

async function create(data) {
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
    statut = 'brouillon',
    notes,
    created_by,
  } = data

  const query = `
    INSERT INTO missions (
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
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *
  `

  const values = [
    vehicle_id,
    driver_id,
    lieu_depart,
    lieu_arrivee,
    date_mission,
    heure_depart || null,
    heure_arrivee_prevue || null,
    chargement || null,
    poids_tonne || null,
    distance_km || null,
    depart_lat || null,
    depart_lng || null,
    arrivee_lat || null,
    arrivee_lng || null,
    trajet_points || null,
    statut,
    notes || null,
    created_by || null,
  ]

  try {
    const result = await pool.query(query, values)
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ missionModel.create : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// update
// Met à jour uniquement les champs fournis (mise à jour partielle).
// Met automatiquement à jour le champ updated_at.
// ─────────────────────────────────────────────────────────────────────────────

async function update(id, data) {
  // Liste des champs modifiables
  const champsAutorises = [
    'vehicle_id', 'driver_id', 'lieu_depart', 'lieu_arrivee',
    'date_mission', 'heure_depart', 'heure_arrivee_prevue',
    'chargement', 'poids_tonne', 'distance_km', 'notes',
    'depart_lat', 'depart_lng', 'arrivee_lat', 'arrivee_lng', 'trajet_points'
  ]

  // Construction dynamique des champs à mettre à jour
  const setClauses = []
  const values = []
  let paramIndex = 1

  for (const champ of champsAutorises) {
    if (data[champ] !== undefined) {
      setClauses.push(`${champ} = $${paramIndex}`)
      values.push(data[champ])
      paramIndex++
    }
  }

  // Si aucun champ à mettre à jour, on retourne la mission telle quelle
  if (setClauses.length === 0) {
    return findById(id)
  }

  // Ajout de updated_at et de l'id pour le WHERE
  setClauses.push(`updated_at = NOW()`)
  values.push(id)

  const query = `
    UPDATE missions
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `

  try {
    const result = await pool.query(query, values)
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ missionModel.update : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateStatut
// Change uniquement le statut d'une mission selon le workflow défini.
// Vérifie que la transition est autorisée.
// ─────────────────────────────────────────────────────────────────────────────

async function updateStatut(id, nouveauStatut) {
  // Vérifier que le nouveau statut est autorisé
  if (!STATUTS_AUTORISES.includes(nouveauStatut)) {
    throw new Error(`Statut "${nouveauStatut}" non autorisé`)
  }

  try {
    // Récupérer le statut actuel
    const missionActuelle = await findById(id)
    if (!missionActuelle) {
      return null
    }

    const statutActuel = missionActuelle.statut

    // Vérifier que la transition est autorisée par le workflow
    const transitionsAutorisees = WORKFLOW_STATUT[statutActuel] || []
    if (!transitionsAutorisees.includes(nouveauStatut)) {
      return {
        error: 'transition_interdite',
        message: `Transition non autorisée de "${statutActuel}" vers "${nouveauStatut}"`,
        statutActuel,
        transitionsAutorisees,
      }
    }

    // Mettre à jour le statut
    const query = `
      UPDATE missions
      SET statut = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `

    const result = await pool.query(query, [nouveauStatut, id])
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ missionModel.updateStatut : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// remove
// Soft delete : change le statut en 'annulee' au lieu de supprimer la ligne.
// Permet de conserver l'historique des missions.
// ─────────────────────────────────────────────────────────────────────────────

async function remove(id) {
  const query = `
    UPDATE missions
    SET statut = 'annulee', updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `

  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ missionModel.remove : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getStats
// Récupère les statistiques globales des missions.
// ─────────────────────────────────────────────────────────────────────────────

async function getStats() {
  const query = `
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN statut = 'brouillon' THEN 1 END) as brouillon,
      COUNT(CASE WHEN statut = 'planifiee' THEN 1 END) as planifiee,
      COUNT(CASE WHEN statut = 'en_cours' THEN 1 END) as en_cours,
      COUNT(CASE WHEN statut = 'terminee' THEN 1 END) as terminee,
      COUNT(CASE WHEN statut = 'annulee' THEN 1 END) as annulee,
      COUNT(CASE WHEN date_mission = CURRENT_DATE THEN 1 END) as aujourdhui
    FROM missions
  `

  try {
    const result = await pool.query(query)
    const row = result.rows[0]

    return {
      total: parseInt(row.total, 10),
      parStatut: {
        brouillon: parseInt(row.brouillon, 10),
        planifiee: parseInt(row.planifiee, 10),
        en_cours: parseInt(row.en_cours, 10),
        terminee: parseInt(row.terminee, 10),
        annulee: parseInt(row.annulee, 10),
      },
      aujourdhui: parseInt(row.aujourdhui, 10),
    }
  } catch (erreur) {
    console.error('❌ missionModel.getStats : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// count
// Compte le nombre total de missions (optionnellement par statut).
// ─────────────────────────────────────────────────────────────────────────────

async function count(statut = null) {
  let query = 'SELECT COUNT(*) as total FROM missions'
  let values = []

  if (statut) {
    query += ' WHERE statut = $1'
    values.push(statut)
  }

  try {
    const result = await pool.query(query, values)
    return parseInt(result.rows[0].total, 10)
  } catch (erreur) {
    console.error('❌ missionModel.count : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions et constantes
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  findAll,
  findById,
  findByDate,
  checkConflict,
  create,
  update,
  updateStatut,
  remove,
  getStats,
  count,
  STATUTS_AUTORISES,
  WORKFLOW_STATUT,
}