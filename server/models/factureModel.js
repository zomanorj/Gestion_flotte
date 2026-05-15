/**
 * factureModel.js
 * Modèle de données pour les factures — TransiFlow.
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({ client_id = null, statut = '', date_debut = '', date_fin = '', page = 1, limit = 10 }) {
  const offset = (page - 1) * limit
  const values = []
  const conditions = []
  let paramIndex = 1

  if (client_id) {
    conditions.push(`f.client_id = $${paramIndex}`)
    values.push(client_id)
    paramIndex++
  }

  if (statut && statut !== 'tous') {
    conditions.push(`f.statut = $${paramIndex}`)
    values.push(statut)
    paramIndex++
  }

  if (date_debut) {
    conditions.push(`f.date_emission >= $${paramIndex}`)
    values.push(date_debut)
    paramIndex++
  }

  if (date_fin) {
    conditions.push(`f.date_emission <= $${paramIndex}`)
    values.push(date_fin)
    paramIndex++
  }

  const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const query = `
    SELECT
      f.*,
      c.nom as client_nom,
      c.type_client,
      m.lieu_depart,
      m.lieu_arrivee
    FROM factures f
    JOIN clients c ON f.client_id = c.id
    LEFT JOIN missions m ON f.mission_id = m.id
    ${whereSQL}
    ORDER BY f.date_emission DESC, f.id DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  const queryTotal = `
    SELECT COUNT(*) as total FROM factures f ${whereSQL}
  `

  try {
    const [resultFactures, resultTotal] = await Promise.all([
      pool.query(query, [...values, limit, offset]),
      pool.query(queryTotal, values)
    ])

    return {
      factures: resultFactures.rows,
      total: parseInt(resultTotal.rows[0].total, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    }
  } catch (erreur) {
    console.error('❌ factureModel.findAll : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const query = `
    SELECT
      f.*,
      c.nom as client_nom,
      c.adresse as client_adresse,
      c.ville as client_ville,
      c.nif as client_nif,
      c.stat as client_stat,
      c.type_client,
      m.lieu_depart,
      m.lieu_arrivee,
      m.date_mission,
      m.distance_km
    FROM factures f
    JOIN clients c ON f.client_id = c.id
    LEFT JOIN missions m ON f.mission_id = m.id
    WHERE f.id = $1
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ factureModel.findById : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateNumero
// ─────────────────────────────────────────────────────────────────────────────

async function generateNumero() {
  const annee = new Date().getFullYear()
  const prefix = `FAC-${annee}-`
  const query = `
    SELECT numero 
    FROM factures 
    WHERE numero LIKE $1 
    ORDER BY numero DESC 
    LIMIT 1
  `
  try {
    const result = await pool.query(query, [`${prefix}%`])
    let prochainNumero = 1
    if (result.rows.length > 0) {
      const dernierNumero = result.rows[0].numero
      const parts = dernierNumero.split('-')
      prochainNumero = parseInt(parts[2], 10) + 1
    }
    return `${prefix}${String(prochainNumero).padStart(4, '0')}`
  } catch (erreur) {
    console.error('❌ factureModel.generateNumero : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────────────────────────

async function create(data) {
  const taux_tva = data.taux_tva !== undefined ? parseFloat(data.taux_tva) : 20.00
  const montant_ht = parseFloat(data.montant_ht)
  const montant_tva = (montant_ht * taux_tva) / 100
  const montant_ttc = montant_ht + montant_tva

  const numero = await generateNumero()

  const query = `
    INSERT INTO factures (
      numero, client_id, mission_id, statut, date_emission, date_echeance,
      montant_ht, taux_tva, montant_tva, montant_ttc, description,
      conditions_paiement, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
  `
  const values = [
    numero,
    data.client_id,
    (data.mission_id && parseInt(data.mission_id) > 0) ? parseInt(data.mission_id) : null,
    data.statut || 'brouillon',
    data.date_emission || new Date(),
    data.date_echeance || null,
    montant_ht,
    taux_tva,
    montant_tva,
    montant_ttc,
    data.description || null,
    data.conditions_paiement || null,
    data.notes || null,
    data.created_by || null
  ]

  try {
    const result = await pool.query(query, values)
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ factureModel.create : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────────────────────────

async function update(id, data) {
  const champsAutorises = [
    'client_id', 'mission_id', 'date_emission', 'date_echeance',
    'montant_ht', 'taux_tva', 'description', 'conditions_paiement', 'notes'
  ]
  
  const setKeys = []
  const values = []
  let paramIndex = 1
  let besoinRecalcul = false

  Object.keys(data).forEach(key => {
    if (champsAutorises.includes(key) && data[key] !== undefined) {
      setKeys.push(`${key} = $${paramIndex}`)
      values.push(data[key])
      paramIndex++
      if (key === 'montant_ht' || key === 'taux_tva') besoinRecalcul = true
    }
  })

  if (setKeys.length === 0) return null

  // Si on a modifié HT ou TVA, on recalcule dans la requête
  if (besoinRecalcul) {
    setKeys.push(`montant_tva = (COALESCE($${paramIndex}, montant_ht) * COALESCE($${paramIndex+1}, taux_tva)) / 100`)
    values.push(data.montant_ht !== undefined ? data.montant_ht : null)
    values.push(data.taux_tva !== undefined ? data.taux_tva : null)
    paramIndex += 2
    
    setKeys.push(`montant_ttc = COALESCE($${paramIndex-2}, montant_ht) + ((COALESCE($${paramIndex-2}, montant_ht) * COALESCE($${paramIndex-1}, taux_tva)) / 100)`)
  }

  setKeys.push(`updated_at = NOW()`)

  const query = `
    UPDATE factures
    SET ${setKeys.join(', ')}
    WHERE id = $${paramIndex} AND statut = 'brouillon'
    RETURNING *
  `
  values.push(id)

  try {
    const result = await pool.query(query, values)
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ factureModel.update : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// marquerPayee
// ─────────────────────────────────────────────────────────────────────────────

async function marquerPayee(id, { date_paiement, mode_paiement }) {
  const query = `
    UPDATE factures
    SET 
      statut = 'payee',
      date_paiement = $2,
      mode_paiement = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `
  try {
    const result = await pool.query(query, [id, date_paiement || new Date(), mode_paiement])
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ factureModel.marquerPayee : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// annuler
// ─────────────────────────────────────────────────────────────────────────────

async function annuler(id) {
  const query = `
    UPDATE factures
    SET statut = 'annulee', updated_at = NOW()
    WHERE id = $1 AND statut != 'payee'
    RETURNING *
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ factureModel.annuler : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getStatsFactures
// ─────────────────────────────────────────────────────────────────────────────

async function getStatsFactures(date_debut = null, date_fin = null) {
  const values = []
  let paramIndex = 1
  const conditions = []

  if (date_debut) {
    conditions.push(`date_emission >= $${paramIndex}`)
    values.push(date_debut)
    paramIndex++
  }

  if (date_fin) {
    conditions.push(`date_emission <= $${paramIndex}`)
    values.push(date_fin)
    paramIndex++
  }

  const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const query = `
    SELECT
      COUNT(*) as total_emises,
      COALESCE(SUM(CASE WHEN statut = 'payee' THEN 1 ELSE 0 END), 0) as total_payees,
      COALESCE(SUM(CASE WHEN statut IN ('brouillon', 'envoyee') THEN 1 ELSE 0 END), 0) as total_impayees,
      COALESCE(SUM(montant_ht), 0) as montant_total_ht,
      COALESCE(SUM(montant_ttc), 0) as montant_total_ttc,
      COALESCE(SUM(CASE WHEN statut = 'payee' THEN montant_ttc ELSE 0 END), 0) as montant_encaisse,
      COALESCE(SUM(CASE WHEN statut IN ('brouillon', 'envoyee') THEN montant_ttc ELSE 0 END), 0) as montant_en_attente
    FROM factures
    ${whereSQL}
  `

  try {
    const result = await pool.query(query, values)
    const row = result.rows[0]
    return {
      total_emises: parseInt(row.total_emises, 10),
      total_payees: parseInt(row.total_payees, 10),
      total_impayees: parseInt(row.total_impayees, 10),
      montant_total_ht: parseFloat(row.montant_total_ht),
      montant_total_ttc: parseFloat(row.montant_total_ttc),
      montant_encaisse: parseFloat(row.montant_encaisse),
      montant_en_attente: parseFloat(row.montant_en_attente)
    }
  } catch (erreur) {
    console.error('❌ factureModel.getStatsFactures : erreur SQL', erreur.message)
    throw erreur
  }
}

module.exports = {
  findAll,
  findById,
  generateNumero,
  create,
  update,
  marquerPayee,
  annuler,
  getStatsFactures
}
