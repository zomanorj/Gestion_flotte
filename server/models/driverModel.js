/**
 * driverModel.js
 * Modèle de données pour la gestion des chauffeurs — TransiFlow.
 *
 * Ce module contient toutes les requêtes SQL brutes (sans ORM) pour
 * manipuler la table `drivers` de la base de données PostgreSQL.
 *
 * Fonctions exportées :
 *   - findAll({ page, limit, search, statut })  → liste paginée avec total
 *   - findById(id)                               → détail d'un chauffeur
 *   - findAvailable(date)                        → chauffeurs sans mission ce jour
 *   - findByNumeroPermis(numero_permis)          → vérification unicité
 *   - create(data)                               → insertion d'un nouveau chauffeur
 *   - update(id, data)                           → mise à jour partielle
 *   - remove(id)                                 → soft delete (statut = 'inactif')
 *   - getPermisAlertes()                         → permis expiré ou < 30 jours
 *   - count(statut)                              → compteur de chauffeurs
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// Statuts de chauffeurs autorisés (pour validation)
// ─────────────────────────────────────────────────────────────────────────────

const STATUTS_AUTORISES = ['actif', 'en_conge', 'inactif']

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// Récupère la liste des chauffeurs avec pagination, recherche et filtrage.
// Retourne un objet avec les chauffeurs ET le total pour la pagination frontend.
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

  // Filtre par recherche textuelle (nom, prénom ou numéro de permis)
  if (search) {
    whereClauses.push(`(LOWER(nom) LIKE $${paramIndex} OR LOWER(prenom) LIKE $${paramIndex} OR LOWER(numero_permis) LIKE $${paramIndex})`)
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

  // ── Requête principale : récupérer les chauffeurs paginés ──
  const queryDrivers = `
    SELECT
      id,
      user_id,
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
      created_at,
      updated_at
    FROM drivers
    ${whereSQL}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  // ── Requête de comptage : nombre total de chauffeurs (pour pagination) ──
  const queryTotal = `
    SELECT COUNT(*) as total
    FROM drivers
    ${whereSQL}
  `

  try {
    // Exécution des deux requêtes en parallèle pour la performance
    const [resultDrivers, resultTotal] = await Promise.all([
      pool.query(queryDrivers, [...values, limit, offset]),
      pool.query(queryTotal, values),
    ])

    return {
      drivers: resultDrivers.rows,
      total: parseInt(resultTotal.rows[0].total, 10),
      page: page,
      limit: limit,
    }
  } catch (erreur) {
    console.error('❌ driverModel.findAll : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// Récupère un chauffeur par son identifiant unique.
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const query = `
    SELECT
      id,
      user_id,
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
      created_at,
      updated_at
    FROM drivers
    WHERE id = $1
  `

  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ driverModel.findById : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findAvailable
// Récupère les chauffeurs disponibles (sans mission) pour une date donnée.
// Un chauffeur est disponible s'il est actif et n'a pas de mission planifiée
// ou en cours pour la date spécifiée.
// ─────────────────────────────────────────────────────────────────────────────

async function findAvailable(date) {
  const query = `
    SELECT
      d.id,
      d.user_id,
      d.nom,
      d.prenom,
      d.telephone,
      d.numero_permis,
      d.date_expiration_permis,
      d.statut,
      d.photo_url,
      d.date_embauche,
      d.notes,
      d.created_at,
      d.updated_at
    FROM drivers d
    WHERE d.statut = 'actif'
      AND d.id NOT IN (
        SELECT driver_id
        FROM missions
        WHERE DATE(date_mission) = $1
          AND statut IN ('planifiee', 'en_cours')
      )
    ORDER BY d.nom, d.prenom
  `

  try {
    const result = await pool.query(query, [date])
    return result.rows
  } catch (erreur) {
    console.error('❌ driverModel.findAvailable : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findByNumeroPermis
// Vérifie si un numéro de permis existe déjà (pour validation à la création).
// ─────────────────────────────────────────────────────────────────────────────

async function findByNumeroPermis(numero_permis) {
  const query = `
    SELECT id FROM drivers
    WHERE LOWER(numero_permis) = LOWER($1)
  `

  try {
    const result = await pool.query(query, [numero_permis])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ driverModel.findByNumeroPermis : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// Insère un nouveau chauffeur dans la base de données.
// Retourne le chauffeur créé avec son id généré automatiquement.
// ─────────────────────────────────────────────────────────────────────────────

async function create(data) {
  const {
    nom,
    prenom,
    telephone,
    numero_permis,
    date_expiration_permis,
    statut = 'actif',
    photo_url,
    date_embauche,
    notes,
  } = data

  const query = `
    INSERT INTO drivers (
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
      id,
      user_id,
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
      created_at,
      updated_at
  `

  const values = [
    nom,
    prenom,
    telephone || null,
    numero_permis,
    date_expiration_permis,
    statut,
    photo_url || null,
    date_embauche || null,
    notes || null,
  ]

  try {
    const result = await pool.query(query, values)
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ driverModel.create : erreur SQL', erreur.message)
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
    'nom', 'prenom', 'telephone', 'numero_permis',
    'date_expiration_permis', 'statut', 'photo_url',
    'date_embauche', 'notes'
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

  // Si aucun champ à mettre à jour, on retourne le chauffeur tel quel
  if (setClauses.length === 0) {
    return findById(id)
  }

  // Ajout de updated_at et de l'id pour le WHERE
  setClauses.push(`updated_at = NOW()`)
  values.push(id)

  const query = `
    UPDATE drivers
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING
      id,
      user_id,
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
      created_at,
      updated_at
  `

  try {
    const result = await pool.query(query, values)
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ driverModel.update : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// remove
// Soft delete : change le statut en 'inactif' au lieu de supprimer la ligne.
// Permet de conserver l'historique des chauffeurs.
// ─────────────────────────────────────────────────────────────────────────────

async function remove(id) {
  const query = `
    UPDATE drivers
    SET statut = 'inactif', updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      user_id,
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
      created_at,
      updated_at
  `

  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ driverModel.remove : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPermisAlertes
// Récupère les chauffeurs dont le permis expire dans moins de 30 jours,
// ou est déjà expiré.
// ─────────────────────────────────────────────────────────────────────────────

async function getPermisAlertes() {
  const query = `
    SELECT
      id,
      user_id,
      nom,
      prenom,
      telephone,
      numero_permis,
      date_expiration_permis,
      statut,
      photo_url,
      date_embauche,
      notes,
      created_at,
      updated_at,
      CASE
        WHEN date_expiration_permis < CURRENT_DATE THEN 'expire'
        WHEN date_expiration_permis <= CURRENT_DATE + INTERVAL '30 days' THEN 'bientot_expire'
        ELSE 'valide'
      END as etat_permis,
      CASE
        WHEN date_expiration_permis < CURRENT_DATE THEN 'Déjà expiré'
        WHEN date_expiration_permis <= CURRENT_DATE + INTERVAL '30 days'
          THEN (date_expiration_permis - CURRENT_DATE) || ' jours restants'
        ELSE 'Valide'
      END as message_permis
    FROM drivers
    WHERE statut != 'inactif'
      AND date_expiration_permis <= CURRENT_DATE + INTERVAL '30 days'
    ORDER BY
      CASE
        WHEN date_expiration_permis < CURRENT_DATE THEN 0
        WHEN date_expiration_permis <= CURRENT_DATE + INTERVAL '30 days' THEN 1
        ELSE 2
      END,
      date_expiration_permis ASC
  `

  try {
    const result = await pool.query(query)
    return result.rows
  } catch (erreur) {
    console.error('❌ driverModel.getPermisAlertes : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// count
// Compte le nombre total de chauffeurs (optionnellement par statut).
// ─────────────────────────────────────────────────────────────────────────────

async function count(statut = null) {
  let query = 'SELECT COUNT(*) as total FROM drivers'
  let values = []

  if (statut) {
    query += ' WHERE statut = $1'
    values.push(statut)
  }

  try {
    const result = await pool.query(query, values)
    return parseInt(result.rows[0].total, 10)
  } catch (erreur) {
    console.error('❌ driverModel.count : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  findAll,
  findById,
  findAvailable,
  findByNumeroPermis,
  create,
  update,
  remove,
  getPermisAlertes,
  count,
  STATUTS_AUTORISES,
}