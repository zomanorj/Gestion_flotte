/**
 * activiteModel.js
 * Modèle de données pour le journal d'activité — TransiFlow.
 *
 * Enregistre toutes les actions importantes : connexions, créations,
 * modifications, suppressions, paiements, etc.
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// log
// Insère une entrée dans le journal d'activité.
// Les erreurs sont silencieuses (catch) pour ne pas bloquer les opérations.
// ─────────────────────────────────────────────────────────────────────────────

async function log({ user_id, action, entite, entite_id, description, donnees_avant, donnees_apres, ip_address }) {
  const query = `
    INSERT INTO journal_activite
      (user_id, action, entite, entite_id, description, donnees_avant, donnees_apres, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `
  try {
    const result = await pool.query(query, [
      user_id    || null,
      action,
      entite     || null,
      entite_id  || null,
      description,
      donnees_avant  ? JSON.stringify(donnees_avant)  : null,
      donnees_apres  ? JSON.stringify(donnees_apres)  : null,
      ip_address || null,
    ])
    return result.rows[0]
  } catch (erreur) {
    // Silencieux : le journal ne doit jamais bloquer les opérations métier
    console.error('❌ activiteModel.log :', erreur.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// Récupère les entrées du journal avec filtres et pagination.
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({ user_id, action, entite, date_debut, date_fin, page = 1, limit = 20 } = {}) {
  const offset     = (page - 1) * limit
  const values     = []
  const conditions = []
  let   paramIndex = 1

  if (user_id) {
    conditions.push(`ja.user_id = $${paramIndex}`)
    values.push(user_id)
    paramIndex++
  }

  if (action && action !== 'tous') {
    conditions.push(`ja.action = $${paramIndex}`)
    values.push(action)
    paramIndex++
  }

  if (entite && entite !== 'tous') {
    conditions.push(`ja.entite = $${paramIndex}`)
    values.push(entite)
    paramIndex++
  }

  if (date_debut) {
    conditions.push(`ja.created_at >= $${paramIndex}`)
    values.push(date_debut)
    paramIndex++
  }

  if (date_fin) {
    conditions.push(`ja.created_at <= $${paramIndex} + INTERVAL '1 day'`)
    values.push(date_fin)
    paramIndex++
  }

  const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const queryActivite = `
    SELECT
      ja.*,
      u.nom   AS user_nom,
      u.email AS user_email,
      u.role  AS user_role
    FROM journal_activite ja
    LEFT JOIN users u ON ja.user_id = u.id
    ${whereSQL}
    ORDER BY ja.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  const queryTotal = `
    SELECT COUNT(*) AS total
    FROM journal_activite ja
    ${whereSQL}
  `

  try {
    const [resultActivite, resultTotal] = await Promise.all([
      pool.query(queryActivite, [...values, limit, offset]),
      pool.query(queryTotal, values),
    ])

    return {
      activite: resultActivite.rows,
      total:    parseInt(resultTotal.rows[0].total, 10),
      page:     parseInt(page, 10),
      limit:    parseInt(limit, 10),
    }
  } catch (erreur) {
    console.error('❌ activiteModel.findAll :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getActiviteRecente
// Retourne les N dernières entrées du journal avec infos utilisateur.
// ─────────────────────────────────────────────────────────────────────────────

async function getActiviteRecente(limit = 20) {
  const query = `
    SELECT
      ja.*,
      u.nom   AS user_nom,
      u.email AS user_email,
      u.role  AS user_role
    FROM journal_activite ja
    LEFT JOIN users u ON ja.user_id = u.id
    ORDER BY ja.created_at DESC
    LIMIT $1
  `
  try {
    const result = await pool.query(query, [limit])
    return result.rows
  } catch (erreur) {
    console.error('❌ activiteModel.getActiviteRecente :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findByEntite
// Retourne l'historique d'un élément spécifique (ex: véhicule id=5).
// ─────────────────────────────────────────────────────────────────────────────

async function findByEntite(entite, entite_id) {
  const query = `
    SELECT
      ja.*,
      u.nom   AS user_nom,
      u.email AS user_email,
      u.role  AS user_role
    FROM journal_activite ja
    LEFT JOIN users u ON ja.user_id = u.id
    WHERE ja.entite = $1 AND ja.entite_id = $2
    ORDER BY ja.created_at DESC
  `
  try {
    const result = await pool.query(query, [entite, entite_id])
    return result.rows
  } catch (erreur) {
    console.error('❌ activiteModel.findByEntite :', erreur.message)
    throw erreur
  }
}

module.exports = {
  log,
  findAll,
  getActiviteRecente,
  findByEntite,
}
