/**
 * incidentModel.js
 * Modèle de données pour les incidents — TransiFlow.
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({ statut, gravite, type, vehicle_id, driver_id,
  date_debut, date_fin, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit
  const conditions = []
  const params = []
  let idx = 1

  if (statut)     { conditions.push(`i.statut = $${idx++}`);        params.push(statut) }
  if (gravite)    { conditions.push(`i.gravite = $${idx++}`);       params.push(gravite) }
  if (type)       { conditions.push(`i.type_incident = $${idx++}`); params.push(type) }
  if (vehicle_id) { conditions.push(`i.vehicle_id = $${idx++}`);    params.push(vehicle_id) }
  if (driver_id)  { conditions.push(`i.driver_id = $${idx++}`);     params.push(driver_id) }
  if (date_debut) { conditions.push(`i.date_incident >= $${idx++}`); params.push(date_debut) }
  if (date_fin)   { conditions.push(`i.date_incident <= $${idx++}`); params.push(date_fin) }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM incidents i ${whereClause}`, params
  )
  const total = parseInt(countResult.rows[0].count)

  const result = await pool.query(`
    SELECT i.*,
      v.immatriculation,
      d.nom as driver_nom, d.prenom as driver_prenom,
      m.lieu_depart, m.lieu_arrivee,
      u.nom as declared_by_nom
    FROM incidents i
    LEFT JOIN vehicles v ON i.vehicle_id = v.id
    LEFT JOIN drivers  d ON i.driver_id  = d.id
    LEFT JOIN missions m ON i.mission_id = m.id
    LEFT JOIN users    u ON i.declared_by = u.id
    ${whereClause}
    ORDER BY i.date_incident DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, [...params, limit, offset])

  return { rows: result.rows, total }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const result = await pool.query(`
    SELECT i.*,
      v.immatriculation, v.type as vehicle_type,
      d.nom as driver_nom, d.prenom as driver_prenom, d.telephone as driver_tel,
      m.lieu_depart, m.lieu_arrivee,
      u1.nom as declared_by_nom,
      u2.nom as resolved_by_nom
    FROM incidents i
    LEFT JOIN vehicles v  ON i.vehicle_id  = v.id
    LEFT JOIN drivers  d  ON i.driver_id   = d.id
    LEFT JOIN missions m  ON i.mission_id  = m.id
    LEFT JOIN users    u1 ON i.declared_by = u1.id
    LEFT JOIN users    u2 ON i.resolved_by = u2.id
    WHERE i.id = $1
  `, [id])
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// getIncidentsOuverts
// ─────────────────────────────────────────────────────────────────────────────

async function getIncidentsOuverts() {
  const result = await pool.query(`
    SELECT i.*, v.immatriculation, d.nom as driver_nom, d.prenom as driver_prenom
    FROM incidents i
    LEFT JOIN vehicles v ON i.vehicle_id = v.id
    LEFT JOIN drivers  d ON i.driver_id  = d.id
    WHERE i.statut IN ('ouvert','en_traitement')
    ORDER BY CASE i.gravite
      WHEN 'critique' THEN 1 WHEN 'grave' THEN 2
      WHEN 'moyen'    THEN 3 ELSE 4 END,
      i.date_incident DESC
  `)
  return result.rows
}

// ─────────────────────────────────────────────────────────────────────────────
// getStats
// ─────────────────────────────────────────────────────────────────────────────

async function getStats(date_debut, date_fin) {
  const params = []
  let w = ''
  if (date_debut && date_fin) { w = 'WHERE date_incident BETWEEN $1 AND $2'; params.push(date_debut, date_fin) }

  const [totalR, typeR, graviteR, statutR, coutR, resolusR] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM incidents ${w}`, params),
    pool.query(`SELECT type_incident, COUNT(*) as count FROM incidents ${w} GROUP BY type_incident ORDER BY count DESC`, params),
    pool.query(`SELECT gravite, COUNT(*) as count FROM incidents ${w} GROUP BY gravite`, params),
    pool.query(`SELECT statut, COUNT(*) as count FROM incidents ${w} GROUP BY statut`, params),
    pool.query(`SELECT COALESCE(SUM(cout_reparation),0) as total FROM incidents ${w} AND cout_reparation IS NOT NULL`.replace('WHERE  AND','WHERE'), params),
    pool.query(`SELECT AVG(EXTRACT(EPOCH FROM (date_resolution - date_incident))/3600) as heures FROM incidents WHERE statut IN ('resolu','clos') AND date_resolution IS NOT NULL ${date_debut ? 'AND date_incident BETWEEN $1 AND $2' : ''}`, params),
  ])

  const total = parseInt(totalR.rows[0].count)
  const resolus = statutR.rows.find(r => r.statut === 'resolu')?.count || 0
  const tauxResolution = total > 0 ? Math.round((parseInt(resolus) / total) * 100) : 0

  return {
    total,
    par_type:    typeR.rows.map(r => ({ type: r.type_incident, count: parseInt(r.count) })),
    par_gravite: graviteR.rows.map(r => ({ gravite: r.gravite, count: parseInt(r.count) })),
    par_statut:  statutR.rows.map(r => ({ statut: r.statut, count: parseInt(r.count) })),
    cout_total_reparations: parseFloat(coutR.rows[0]?.total || 0),
    taux_resolution: tauxResolution,
    delai_moyen_resolution_heures: Math.round(parseFloat(resolusR.rows[0]?.heures || 0)),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────────────────────────

async function create({ mission_id, vehicle_id, driver_id, type_incident,
  gravite, titre, description, lieu, latitude, longitude,
  date_incident, numero_sinistre, declared_by }) {
  const result = await pool.query(`
    INSERT INTO incidents
      (mission_id, vehicle_id, driver_id, type_incident, gravite, titre,
       description, lieu, latitude, longitude, date_incident,
       numero_sinistre, declared_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *
  `, [mission_id || null, vehicle_id, driver_id || null, type_incident,
      gravite || 'moyen', titre, description || null, lieu || null,
      latitude || null, longitude || null,
      date_incident || new Date().toISOString(),
      numero_sinistre || null, declared_by || null])
  return result.rows[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────────────────────────

async function update(id, fields) {
  const allowed = ['type_incident','gravite','statut','titre','description',
                   'lieu','latitude','longitude','numero_sinistre']
  const sets = ['updated_at = NOW()']
  const params = [id]
  let idx = 2

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${idx++}`)
      params.push(fields[key])
    }
  }

  const result = await pool.query(
    `UPDATE incidents SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params
  )
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// resoudre
// ─────────────────────────────────────────────────────────────────────────────

async function resoudre(id, { actions_prises, cout_reparation,
  date_resolution, resolved_by }) {
  const result = await pool.query(`
    UPDATE incidents SET
      statut           = 'resolu',
      actions_prises   = $2,
      cout_reparation  = $3,
      date_resolution  = COALESCE($4, NOW()),
      resolved_by      = $5,
      updated_at       = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, actions_prises, cout_reparation || null,
      date_resolution || null, resolved_by || null])
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// clore
// ─────────────────────────────────────────────────────────────────────────────

async function clore(id) {
  const result = await pool.query(`
    UPDATE incidents SET statut = 'clos', updated_at = NOW()
    WHERE id = $1 RETURNING *
  `, [id])
  return result.rows[0] || null
}

module.exports = {
  findAll, findById, getIncidentsOuverts, getStats,
  create, update, resoudre, clore,
}
