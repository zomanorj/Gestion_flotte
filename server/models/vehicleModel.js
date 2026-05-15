/**
 * vehicleModel.js
 * Modèle de données pour la gestion des véhicules — TransiFlow.
 *
 * Ce module contient toutes les requêtes SQL brutes (sans ORM) pour
 * manipuler la table `vehicles` de la base de données PostgreSQL.
 *
 * Fonctions exportées :
 *   - findAll({ page, limit, search, statut }) → liste paginée avec total
 *   - findById(id)                            → détail d'un véhicule
 *   - findByImmatriculation(immatriculation)  → vérification unicité
 *   - create(data)                            → insertion d'un nouveau véhicule
 *   - update(id, data)                        → mise à jour partielle
 *   - remove(id)                              → soft delete (statut = 'archive')
 *   - findAlertes()                           → véhicules avec docs expirant
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// Types de véhicules autorisés (pour validation)
// ─────────────────────────────────────────────────────────────────────────────

const TYPES_VEHICULE_AUTORISES = ['camion', 'citerne', 'pickup', 'autre']

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// Récupère la liste des véhicules avec pagination, recherche et filtrage.
// Retourne un objet avec les véhicules ET le total pour la pagination frontend.
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({
  page = 1,
  limit = 10,
  search = '',
  statut = '',
} = {}) {
  // Calcul de l'offset pour la pagination
  const offset = (page - 1) * limit

  // Construction dynamique de la requête selon les filtres
  let whereClauses = []
  let values = []
  let paramIndex = 1

  // Filtre par recherche textuelle (immatriculation ou type)
  if (search) {
    whereClauses.push(`LOWER(immatriculation) LIKE $${paramIndex} OR LOWER(type) LIKE $${paramIndex}`)
    values.push(`%${search.toLowerCase()}%`)
    paramIndex++
  }

  // Filtre par statut
  if (statut && statut !== 'tous') {
    whereClauses.push(`statut = $${paramIndex}`)
    values.push(statut)
    paramIndex++
  }

  // Assemblage de la clause WHERE
  const whereSQL = whereClauses.length > 0
    ? 'WHERE ' + whereClauses.join(' AND ')
    : ''

  // ── Requête principale : récupérer les véhicules paginés ──
  const queryVehicules = `
    SELECT
      id,
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
      created_at,
      updated_at
    FROM vehicles
    ${whereSQL}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  // ── Requête de comptage : nombre total de véhicules (pour pagination) ──
  const queryTotal = `
    SELECT COUNT(*) as total
    FROM vehicles
    ${whereSQL}
  `

  try {
    // Exécution des deux requêtes en parallèle pour la performance
    const [resultVehicules, resultTotal] = await Promise.all([
      pool.query(queryVehicules, [...values, limit, offset]),
      pool.query(queryTotal, values),
    ])

    return {
      vehicules: resultVehicules.rows,
      total: parseInt(resultTotal.rows[0].total, 10),
      page: page,
      limit: limit,
    }
  } catch (erreur) {
    console.error('❌ vehicleModel.findAll : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// Récupère un véhicule par son identifiant unique.
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const query = `
    SELECT
      id,
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
      created_at,
      updated_at
    FROM vehicles
    WHERE id = $1
  `

  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ vehicleModel.findById : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findByImmatriculation
// Vérifie si une immatriculation existe déjà (pour validation à la création).
// ─────────────────────────────────────────────────────────────────────────────

async function findByImmatriculation(immatriculation) {
  const query = `
    SELECT id FROM vehicles
    WHERE LOWER(immatriculation) = LOWER($1)
  `

  try {
    const result = await pool.query(query, [immatriculation])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ vehicleModel.findByImmatriculation : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// Insère un nouveau véhicule dans la base de données.
// Retourne le véhicule créé avec son id généré automatiquement.
// ─────────────────────────────────────────────────────────────────────────────

async function create(data) {
  const {
    immatriculation,
    type,
    capacite,
    statut = 'actif',
    date_assurance,
    date_visite_technique,
    kilometrage = 0,
    notes,
  } = data

  const query = `
    INSERT INTO vehicles (
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
      created_at,
      updated_at
  `

  const values = [
    immatriculation,
    type,
    capacite,
    statut,
    date_assurance || null,
    date_visite_technique || null,
    kilometrage,
    notes || null,
  ]

  try {
    const result = await pool.query(query, values)
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ vehicleModel.create : erreur SQL', erreur.message)
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
    'immatriculation', 'type', 'capacite', 'statut',
    'date_assurance', 'date_visite_technique', 'kilometrage', 'notes'
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

  // Si aucun champ à mettre à jour, on retourne le véhicule tel quel
  if (setClauses.length === 0) {
    return findById(id)
  }

  // Ajout de updated_at et de l'id pour le WHERE
  setClauses.push(`updated_at = NOW()`)
  values.push(id)

  const query = `
    UPDATE vehicles
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING
      id,
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
      created_at,
      updated_at
  `

  try {
    const result = await pool.query(query, values)
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ vehicleModel.update : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// remove
// Soft delete : change le statut en 'archive' au lieu de supprimer la ligne.
// Permet de conserver l'historique des véhicules.
// ─────────────────────────────────────────────────────────────────────────────

async function remove(id) {
  const query = `
    UPDATE vehicles
    SET statut = 'archive', updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
      created_at,
      updated_at
  `

  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ vehicleModel.remove : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findAlertes
// Récupère les véhicules dont l'assurance ou la visite technique expire
// dans moins de 30 jours, ou est déjà expirée.
// ─────────────────────────────────────────────────────────────────────────────

async function findAlertes() {
  // Recherche les véhicules (non archivés) avec :
  //   - assurance expirée ou expirant dans moins de 30 jours
  //   - OU visite technique expirée ou expirant dans moins de 30 jours
  const query = `
    SELECT
      id,
      immatriculation,
      type,
      capacite,
      statut,
      date_assurance,
      date_visite_technique,
      kilometrage,
      notes,
      created_at,
      updated_at,
      CASE
        WHEN date_assurance IS NOT NULL AND date_assurance < CURRENT_DATE THEN 'expiree'
        WHEN date_assurance IS NOT NULL AND date_assurance <= CURRENT_DATE + INTERVAL '30 days' THEN 'bientot_expiree'
        ELSE 'valide'
      END as etat_assurance,
      CASE
        WHEN date_visite_technique IS NOT NULL AND date_visite_technique < CURRENT_DATE THEN 'expiree'
        WHEN date_visite_technique IS NOT NULL AND date_visite_technique <= CURRENT_DATE + INTERVAL '30 days' THEN 'bientot_expiree'
        ELSE 'valide'
      END as etat_visite
    FROM vehicles
    WHERE statut != 'archive'
      AND (
        (date_assurance IS NOT NULL AND date_assurance <= CURRENT_DATE + INTERVAL '30 days')
        OR
        (date_visite_technique IS NOT NULL AND date_visite_technique <= CURRENT_DATE + INTERVAL '30 days')
      )
    ORDER BY
      CASE WHEN date_assurance < CURRENT_DATE THEN 0
           WHEN date_assurance <= CURRENT_DATE + INTERVAL '30 days' THEN 1
           ELSE 2 END,
      date_assurance ASC,
      CASE WHEN date_visite_technique < CURRENT_DATE THEN 0
           WHEN date_visite_technique <= CURRENT_DATE + INTERVAL '30 days' THEN 1
           ELSE 2 END,
      date_visite_technique ASC
  `

  try {
    const result = await pool.query(query)
    return result.rows
  } catch (erreur) {
    console.error('❌ vehicleModel.findAlertes : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// count
// Compte le nombre total de véhicules (optionnellement par statut).
// ─────────────────────────────────────────────────────────────────────────────

async function count(statut = null) {
  let query = 'SELECT COUNT(*) as total FROM vehicles'
  let values = []

  if (statut) {
    query += ' WHERE statut = $1'
    values.push(statut)
  }

  try {
    const result = await pool.query(query, values)
    return parseInt(result.rows[0].total, 10)
  } catch (erreur) {
    console.error('❌ vehicleModel.count : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  findAll,
  findById,
  findByImmatriculation,
  create,
  update,
  remove,
  findAlertes,
  count,
  TYPES_VEHICULE_AUTORISES,
}