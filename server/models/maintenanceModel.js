/**
 * maintenanceModel.js
 * Modèle de données pour la maintenance préventive — TransiFlow.
 * Requêtes SQL pour maintenances et alertes.
 */

const pool = require('../db/connection')

// Intervalles de maintenance recommandés par type (km, mois)
const INTERVALLES = {
  revision:  { km: 10000, mois: 6  },
  vidange:   { km: 5000,  mois: 3  },
  pneus:     { km: 40000, mois: 24 },
  freins:    { km: 30000, mois: 18 },
  courroie:  { km: 60000, mois: 48 },
  filtres:   { km: 15000, mois: 12 },
  autre:     { km: 10000, mois: 6  },
}

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({ vehicle_id, statut, type, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit
  const conditions = []
  const params = []
  let idx = 1

  if (vehicle_id) { conditions.push(`m.vehicle_id = $${idx++}`);      params.push(vehicle_id) }
  if (statut)     { conditions.push(`m.statut = $${idx++}`);           params.push(statut) }
  if (type)       { conditions.push(`m.type_maintenance = $${idx++}`); params.push(type) }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM maintenances m ${whereClause}`, params
  )
  const total = parseInt(countResult.rows[0].count)

  const result = await pool.query(`
    SELECT m.*, v.immatriculation, v.kilometrage as km_actuel,
           u.nom as created_by_nom
    FROM maintenances m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    LEFT JOIN users   u ON m.created_by = u.id
    ${whereClause}
    ORDER BY COALESCE(m.date_planifiee, m.date_realisee) ASC, m.id DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, [...params, limit, offset])

  return { rows: result.rows, total }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const result = await pool.query(`
    SELECT m.*, v.immatriculation, v.kilometrage as km_actuel, v.type as vehicle_type
    FROM maintenances m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    WHERE m.id = $1
  `, [id])
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// getMaintenancesUrgentes
// Planifiées dans les 7 prochains jours ou km proche.
// ─────────────────────────────────────────────────────────────────────────────

async function getMaintenancesUrgentes() {
  const result = await pool.query(`
    SELECT m.*, v.immatriculation, v.kilometrage as km_actuel
    FROM maintenances m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    WHERE m.statut = 'planifiee'
      AND (
        m.date_planifiee <= CURRENT_DATE + INTERVAL '7 days'
        OR (m.kilometrage_planifie IS NOT NULL
            AND v.kilometrage IS NOT NULL
            AND m.kilometrage_planifie - v.kilometrage <= 500)
      )
    ORDER BY m.date_planifiee ASC
  `)
  return result.rows
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────────────────────────

async function create({ vehicle_id, type_maintenance, date_planifiee,
  kilometrage_planifie, garage, description, created_by }) {
  const result = await pool.query(`
    INSERT INTO maintenances
      (vehicle_id, type_maintenance, date_planifiee, kilometrage_planifie,
       garage, description, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `, [vehicle_id, type_maintenance, date_planifiee || null,
      kilometrage_planifie || null, garage || null, description || null,
      created_by || null])
  return result.rows[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────────────────────────

async function update(id, fields) {
  const sets = []
  const params = [id]
  let idx = 2

  const allowed = ['type_maintenance','statut','date_planifiee','kilometrage_planifie',
                   'garage','description']
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${idx++}`)
      params.push(fields[key])
    }
  }
  sets.push(`updated_at = NOW()`)
  if (!sets.length) return findById(id)

  const result = await pool.query(
    `UPDATE maintenances SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  )
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// terminer
// Marquer une maintenance terminée + créer la prochaine si demandé.
// ─────────────────────────────────────────────────────────────────────────────

async function terminer(id, { date_realisee, cout, kilometrage_realise,
  pieces_changees, garage, prochaine_maintenance_km, prochaine_maintenance_date,
  planifier_prochaine = false }) {
  const result = await pool.query(`
    UPDATE maintenances SET
      statut                    = 'terminee',
      date_realisee             = COALESCE($2, CURRENT_DATE),
      cout                      = $3,
      kilometrage_realise       = $4,
      pieces_changees           = $5,
      garage                    = COALESCE($6, garage),
      prochaine_maintenance_km  = $7,
      prochaine_maintenance_date = $8,
      updated_at                = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, date_realisee || null, cout || null, kilometrage_realise || null,
      pieces_changees ? JSON.stringify(pieces_changees) : null,
      garage || null, prochaine_maintenance_km || null, prochaine_maintenance_date || null])

  const maint = result.rows[0]
  if (!maint) return null

  // Créer automatiquement la prochaine maintenance si demandé
  if (planifier_prochaine && maint.prochaine_maintenance_km) {
    await pool.query(`
      INSERT INTO maintenances
        (vehicle_id, type_maintenance, kilometrage_planifie, date_planifiee)
      VALUES ($1,$2,$3,$4)
    `, [maint.vehicle_id, maint.type_maintenance,
        maint.prochaine_maintenance_km, maint.prochaine_maintenance_date || null])
  }

  return maint
}

// ─────────────────────────────────────────────────────────────────────────────
// getHistorique
// ─────────────────────────────────────────────────────────────────────────────

async function getHistorique(vehicle_id) {
  const result = await pool.query(`
    SELECT m.*, v.immatriculation
    FROM maintenances m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    WHERE m.vehicle_id = $1
    ORDER BY COALESCE(m.date_realisee, m.date_planifiee) DESC
  `, [vehicle_id])
  return result.rows
}

// ─────────────────────────────────────────────────────────────────────────────
// getProchaineMaintenance
// Prochaine maintenance planifiée pour un véhicule.
// ─────────────────────────────────────────────────────────────────────────────

async function getProchaineMaintenance(vehicle_id) {
  const result = await pool.query(`
    SELECT m.*, v.immatriculation
    FROM maintenances m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    WHERE m.vehicle_id = $1 AND m.statut = 'planifiee'
    ORDER BY COALESCE(m.date_planifiee, '9999-12-31') ASC,
             COALESCE(m.kilometrage_planifie, 9999999) ASC
    LIMIT 1
  `, [vehicle_id])
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// getCoutTotal
// Coût total de maintenance pour un véhicule et une année.
// ─────────────────────────────────────────────────────────────────────────────

async function getCoutTotal(vehicle_id, annee) {
  const result = await pool.query(`
    SELECT COALESCE(SUM(cout), 0) as total
    FROM maintenances
    WHERE vehicle_id = $1
      AND statut = 'terminee'
      AND EXTRACT(YEAR FROM date_realisee) = $2
  `, [vehicle_id, annee])
  return parseFloat(result.rows[0].total)
}

module.exports = {
  findAll, findById, getMaintenancesUrgentes, create, update,
  terminer, getHistorique, getProchaineMaintenance, getCoutTotal,
  INTERVALLES,
}
