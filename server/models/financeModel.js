/**
 * financeModel.js
 * Modèle de données pour la gestion financière — TransiFlow.
 * Toutes les requêtes SQL pour les dépenses et budgets.
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// getDepenses
// Liste paginée des dépenses avec filtres optionnels.
// ─────────────────────────────────────────────────────────────────────────────

async function getDepenses({ mission_id, vehicle_id, categorie,
  date_debut, date_fin, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit
  const conditions = []
  const params = []
  let idx = 1

  if (mission_id)   { conditions.push(`d.mission_id = $${idx++}`);  params.push(mission_id) }
  if (vehicle_id)   { conditions.push(`d.vehicle_id = $${idx++}`);  params.push(vehicle_id) }
  if (categorie)    { conditions.push(`d.categorie = $${idx++}`);   params.push(categorie) }
  if (date_debut)   { conditions.push(`d.date_depense >= $${idx++}`); params.push(date_debut) }
  if (date_fin)     { conditions.push(`d.date_depense <= $${idx++}`); params.push(date_fin) }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM depenses d ${whereClause}`, params
  )
  const total = parseInt(countResult.rows[0].count)

  const result = await pool.query(`
    SELECT d.*,
      m.lieu_depart, m.lieu_arrivee,
      v.immatriculation,
      u.nom as created_by_nom
    FROM depenses d
    LEFT JOIN missions m ON d.mission_id = m.id
    LEFT JOIN vehicles v ON d.vehicle_id = v.id
    LEFT JOIN users   u ON d.created_by = u.id
    ${whereClause}
    ORDER BY d.date_depense DESC, d.id DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, [...params, limit, offset])

  return { rows: result.rows, total }
}

// ─────────────────────────────────────────────────────────────────────────────
// getDepenseById
// ─────────────────────────────────────────────────────────────────────────────

async function getDepenseById(id) {
  const result = await pool.query(`
    SELECT d.*,
      m.lieu_depart, m.lieu_arrivee,
      v.immatriculation,
      u.nom as created_by_nom
    FROM depenses d
    LEFT JOIN missions m ON d.mission_id = m.id
    LEFT JOIN vehicles v ON d.vehicle_id = v.id
    LEFT JOIN users   u ON d.created_by = u.id
    WHERE d.id = $1
  `, [id])
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// createDepense
// ─────────────────────────────────────────────────────────────────────────────

async function createDepense({ mission_id, vehicle_id, categorie, montant,
  devise = 'MGA', description, date_depense, justificatif_url, created_by }) {
  const result = await pool.query(`
    INSERT INTO depenses
      (mission_id, vehicle_id, categorie, montant, devise,
       description, date_depense, justificatif_url, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `, [mission_id || null, vehicle_id || null, categorie, montant,
      devise, description || null, date_depense, justificatif_url || null, created_by || null])
  return result.rows[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// updateDepense
// ─────────────────────────────────────────────────────────────────────────────

async function updateDepense(id, { mission_id, vehicle_id, categorie,
  montant, devise, description, date_depense, justificatif_url }) {
  const result = await pool.query(`
    UPDATE depenses SET
      mission_id       = COALESCE($2, mission_id),
      vehicle_id       = COALESCE($3, vehicle_id),
      categorie        = COALESCE($4, categorie),
      montant          = COALESCE($5, montant),
      devise           = COALESCE($6, devise),
      description      = COALESCE($7, description),
      date_depense     = COALESCE($8, date_depense),
      justificatif_url = COALESCE($9, justificatif_url)
    WHERE id = $1
    RETURNING *
  `, [id, mission_id, vehicle_id, categorie, montant, devise,
      description, date_depense, justificatif_url])
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteDepense
// ─────────────────────────────────────────────────────────────────────────────

async function deleteDepense(id) {
  const result = await pool.query('DELETE FROM depenses WHERE id = $1 RETURNING id', [id])
  return result.rows[0] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// getCoutMission
// Coût total d'une mission par catégorie.
// ─────────────────────────────────────────────────────────────────────────────

async function getCoutMission(mission_id) {
  const result = await pool.query(`
    SELECT categorie, SUM(montant) as total
    FROM depenses
    WHERE mission_id = $1
    GROUP BY categorie
    ORDER BY total DESC
  `, [mission_id])

  const totalResult = await pool.query(
    'SELECT COALESCE(SUM(montant), 0) as total FROM depenses WHERE mission_id = $1',
    [mission_id]
  )

  return {
    par_categorie: result.rows.map(r => ({
      categorie: r.categorie,
      total: parseFloat(r.total),
    })),
    total_general: parseFloat(totalResult.rows[0].total),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getStatsFinancieres
// Statistiques globales sur une période.
// ─────────────────────────────────────────────────────────────────────────────

async function getStatsFinancieres(date_debut, date_fin) {
  const params = []
  let whereClause = ''
  if (date_debut && date_fin) {
    whereClause = 'WHERE date_depense BETWEEN $1 AND $2'
    params.push(date_debut, date_fin)
  }

  const totalResult = await pool.query(
    `SELECT COALESCE(SUM(montant), 0) as total FROM depenses ${whereClause}`, params
  )

  const parCategorieResult = await pool.query(`
    SELECT categorie, COALESCE(SUM(montant), 0) as total
    FROM depenses ${whereClause}
    GROUP BY categorie ORDER BY total DESC
  `, params)

  const parVehiculeResult = await pool.query(`
    SELECT v.immatriculation, COALESCE(SUM(d.montant), 0) as total
    FROM depenses d
    JOIN vehicles v ON d.vehicle_id = v.id
    ${whereClause}
    GROUP BY v.immatriculation ORDER BY total DESC
    LIMIT 5
  `, params)

  const parMoisResult = await pool.query(`
    SELECT TO_CHAR(date_depense, 'YYYY-MM') as mois,
           COALESCE(SUM(montant), 0) as total
    FROM depenses ${whereClause}
    GROUP BY TO_CHAR(date_depense, 'YYYY-MM')
    ORDER BY mois ASC
  `, params)

  // Coût moyen par km (en joignant avec les missions qui ont une distance)
  const coutKmResult = await pool.query(`
    SELECT CASE WHEN SUM(m.distance_km) > 0
      THEN ROUND(SUM(d.montant) / SUM(m.distance_km), 0)
      ELSE 0 END as cout_par_km
    FROM depenses d
    JOIN missions m ON d.mission_id = m.id
    WHERE m.distance_km > 0 ${date_debut ? `AND d.date_depense BETWEEN $1 AND $2` : ''}
  `, params)

  const coutMissionResult = await pool.query(`
    SELECT CASE WHEN COUNT(DISTINCT mission_id) > 0
      THEN ROUND(SUM(montant) / COUNT(DISTINCT mission_id), 0)
      ELSE 0 END as cout_par_mission
    FROM depenses
    WHERE mission_id IS NOT NULL ${date_debut ? `AND date_depense BETWEEN $1 AND $2` : ''}
  `, params)

  return {
    total_depenses: parseFloat(totalResult.rows[0].total),
    par_categorie: parCategorieResult.rows.map(r => ({
      categorie: r.categorie, total: parseFloat(r.total),
    })),
    par_vehicule: parVehiculeResult.rows.map(r => ({
      immatriculation: r.immatriculation, total: parseFloat(r.total),
    })),
    par_mois: parMoisResult.rows.map(r => ({
      mois: r.mois, total: parseFloat(r.total),
    })),
    cout_moyen_par_km: parseFloat(coutKmResult.rows[0]?.cout_par_km || 0),
    cout_moyen_par_mission: parseFloat(coutMissionResult.rows[0]?.cout_par_mission || 0),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getBudgets / setBudget / comparerBudgetReel
// ─────────────────────────────────────────────────────────────────────────────

async function getBudgets(vehicle_id, annee) {
  const conditions = annee ? 'WHERE annee = $1' : ''
  const params = annee ? [annee] : []
  if (vehicle_id) {
    // already handled by conditions above if needed
  }
  const result = await pool.query(`
    SELECT b.*, v.immatriculation
    FROM budgets b
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    WHERE b.annee = $1 ${vehicle_id ? 'AND b.vehicle_id = $2' : ''}
    ORDER BY b.mois ASC
  `, vehicle_id ? [annee, vehicle_id] : [annee])
  return result.rows
}

async function setBudget(vehicle_id, mois, annee,
  { budget_carburant, budget_maintenance, budget_total }) {
  const result = await pool.query(`
    INSERT INTO budgets (vehicle_id, mois, annee, budget_carburant, budget_maintenance, budget_total)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (vehicle_id, mois, annee) DO UPDATE SET
      budget_carburant   = EXCLUDED.budget_carburant,
      budget_maintenance = EXCLUDED.budget_maintenance,
      budget_total       = EXCLUDED.budget_total
    RETURNING *
  `, [vehicle_id, mois, annee,
      budget_carburant || 0, budget_maintenance || 0, budget_total || 0])
  return result.rows[0]
}

async function comparerBudgetReel(vehicle_id, mois, annee) {
  const budgetResult = await pool.query(
    'SELECT * FROM budgets WHERE vehicle_id=$1 AND mois=$2 AND annee=$3',
    [vehicle_id, mois, annee]
  )
  const budget = budgetResult.rows[0]

  const reelResult = await pool.query(`
    SELECT COALESCE(SUM(montant), 0) as total
    FROM depenses
    WHERE vehicle_id = $1
      AND EXTRACT(MONTH FROM date_depense) = $2
      AND EXTRACT(YEAR  FROM date_depense) = $3
  `, [vehicle_id, mois, annee])
  const reel = parseFloat(reelResult.rows[0].total)

  const budgetTotal = budget ? parseFloat(budget.budget_total) : 0
  const ecart = budgetTotal - reel
  const pourcentage = budgetTotal > 0 ? Math.round((reel / budgetTotal) * 100) : 0

  return { budget: budgetTotal, reel, ecart, pourcentage }
}

module.exports = {
  getDepenses, getDepenseById, createDepense, updateDepense,
  deleteDepense, getCoutMission, getStatsFinancieres,
  getBudgets, setBudget, comparerBudgetReel,
}
