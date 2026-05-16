/**
 * clientModel.js
 * Modèle de données pour les clients — TransiFlow.
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// Récupère la liste des clients (paginée, avec filtres).
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({ search = '', statut = '', type_client = '', page = 1, limit = 10 }) {
  const offset = (page - 1) * limit
  const values = []
  const conditions = ['c.deleted_at IS NULL']
  let paramIndex = 1

  if (search) {
    conditions.push(`(
      c.nom ILIKE $${paramIndex} OR 
      c.nom_contact ILIKE $${paramIndex} OR 
      c.telephone ILIKE $${paramIndex} OR
      c.ville ILIKE $${paramIndex}
    )`)
    values.push(`%${search}%`)
    paramIndex++
  }

  if (statut && statut !== 'tous') {
    conditions.push(`c.statut = $${paramIndex}`)
    values.push(statut)
    paramIndex++
  } else {
    // Par défaut, ne pas afficher les inactifs dans la liste générale si pas précisé
    // (optionnel : ici on affiche tout sauf si on veut filtrer)
  }

  if (type_client && type_client !== 'tous') {
    conditions.push(`c.type_client = $${paramIndex}`)
    values.push(type_client)
    paramIndex++
  }

  const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const queryClients = `
    SELECT
      c.id, c.type_client, c.nom, c.nom_contact, c.telephone, c.email, c.ville, c.statut,
      (SELECT COUNT(*) FROM missions m WHERE m.client_id = c.id) as total_missions,
      (SELECT COALESCE(SUM(f.montant_ttc), 0) FROM factures f WHERE f.client_id = c.id AND f.statut = 'payee') as ca_total
    FROM clients c
    ${whereSQL}
    ORDER BY c.nom ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  const queryTotal = `
    SELECT COUNT(*) as total
    FROM clients c
    ${whereSQL}
  `

  try {
    const [resultClients, resultTotal] = await Promise.all([
      pool.query(queryClients, [...values, limit, offset]),
      pool.query(queryTotal, values)
    ])

    return {
      clients: resultClients.rows,
      total: parseInt(resultTotal.rows[0].total, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    }
  } catch (erreur) {
    console.error('❌ clientModel.findAll : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const query = `
    SELECT * FROM clients WHERE id = $1 AND deleted_at IS NULL
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ clientModel.findById : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findWithStats
// ─────────────────────────────────────────────────────────────────────────────

async function findWithStats(id) {
  const query = `
    SELECT
      c.*,
      (SELECT COUNT(*) FROM missions m WHERE m.client_id = c.id) as total_missions,
      (SELECT COALESCE(SUM(f.montant_ttc), 0) FROM factures f WHERE f.client_id = c.id AND f.statut = 'payee') as ca_total,
      (SELECT COUNT(*) FROM factures f WHERE f.client_id = c.id AND f.statut IN ('brouillon', 'envoyee')) as factures_impayees
    FROM clients c
    WHERE c.id = $1 AND c.deleted_at IS NULL
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ clientModel.findWithStats : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────────────────────────

async function create(data) {
  const query = `
    INSERT INTO clients (
      type_client, nom, nom_contact, telephone, telephone2, 
      email, adresse, ville, nif, stat, notes, statut
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `
  const values = [
    data.type_client || 'entreprise',
    data.nom,
    data.nom_contact || null,
    data.telephone || null,
    data.telephone2 || null,
    data.email || null,
    data.adresse || null,
    data.ville || null,
    data.nif || null,
    data.stat || null,
    data.notes || null,
    data.statut || 'actif'
  ]

  try {
    const result = await pool.query(query, values)
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ clientModel.create : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────────────────────────

async function update(id, data) {
  const champsAutorises = [
    'type_client', 'nom', 'nom_contact', 'telephone', 'telephone2',
    'email', 'adresse', 'ville', 'nif', 'stat', 'notes', 'statut'
  ]
  
  const setKeys = []
  const values = []
  let paramIndex = 1

  Object.keys(data).forEach(key => {
    if (champsAutorises.includes(key) && data[key] !== undefined) {
      setKeys.push(`${key} = $${paramIndex}`)
      values.push(data[key])
      paramIndex++
    }
  })

  if (setKeys.length === 0) return null

  setKeys.push(`updated_at = NOW()`)

  const query = `
    UPDATE clients
    SET ${setKeys.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `
  values.push(id)

  try {
    const result = await pool.query(query, values)
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ clientModel.update : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// remove (soft delete)
// ─────────────────────────────────────────────────────────────────────────────

async function remove(id) {
  const query = `
    UPDATE clients
    SET statut = 'inactif', deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ clientModel.remove : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMissions
// ─────────────────────────────────────────────────────────────────────────────

async function getMissions(client_id, { statut = '', page = 1, limit = 10 }) {
  const offset = (page - 1) * limit
  const values = [client_id]
  let paramIndex = 2
  let whereSQL = `WHERE m.client_id = $1 AND m.deleted_at IS NULL`

  if (statut && statut !== 'tous') {
    whereSQL += ` AND m.statut = $${paramIndex}`
    values.push(statut)
    paramIndex++
  }

  // Exclure les missions annulées par défaut
  whereSQL += ` AND m.statut != 'annulee'`

  const query = `
    SELECT
      m.id, m.date_mission, m.lieu_depart, m.lieu_arrivee, m.statut, m.distance_km,
      v.immatriculation, v.type as vehicle_type,
      d.nom as driver_nom, d.prenom as driver_prenom,
      f.numero as facture_numero, f.statut as facture_statut, f.montant_ttc as montant_ttc
    FROM missions m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    LEFT JOIN drivers d ON m.driver_id = d.id
    LEFT JOIN factures f ON f.mission_id = m.id
    ${whereSQL}
    ORDER BY m.date_mission DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  const queryTotal = `
    SELECT COUNT(*) as total FROM missions m ${whereSQL}
  `

  try {
    const [resultMissions, resultTotal] = await Promise.all([
      pool.query(query, [...values, limit, offset]),
      pool.query(queryTotal, values)
    ])

    return {
      missions: resultMissions.rows,
      total: parseInt(resultTotal.rows[0].total, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    }
  } catch (erreur) {
    console.error('❌ clientModel.getMissions : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getFactures
// ─────────────────────────────────────────────────────────────────────────────

async function getFactures(client_id) {
  const query = `
    SELECT * FROM factures
    WHERE client_id = $1 AND deleted_at IS NULL
    ORDER BY date_emission DESC
  `
  try {
    const result = await pool.query(query, [client_id])
    return result.rows
  } catch (erreur) {
    console.error('❌ clientModel.getFactures : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getStats
// ─────────────────────────────────────────────────────────────────────────────

async function getStats(client_id) {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM missions WHERE client_id = $1 AND deleted_at IS NULL) as total_missions,
      (SELECT COUNT(*) FROM missions WHERE client_id = $1 AND statut = 'terminee' AND deleted_at IS NULL) as missions_terminees,
      (SELECT COALESCE(SUM(montant_ttc), 0) FROM factures WHERE client_id = $1 AND statut = 'payee' AND deleted_at IS NULL) as ca_total,
      (SELECT COALESCE(SUM(montant_ttc), 0) FROM factures WHERE client_id = $1 AND statut = 'payee' AND DATE_TRUNC('month', date_paiement) = DATE_TRUNC('month', CURRENT_DATE) AND deleted_at IS NULL) as ca_ce_mois,
      (SELECT COUNT(*) FROM factures WHERE client_id = $1 AND statut IN ('brouillon', 'envoyee') AND deleted_at IS NULL) as factures_impayees,
      (SELECT COALESCE(SUM(montant_ttc), 0) FROM factures WHERE client_id = $1 AND statut IN ('brouillon', 'envoyee') AND deleted_at IS NULL) as montant_impaye
  `
  try {
    const result = await pool.query(query, [client_id])
    const row = result.rows[0]
    return {
      total_missions: parseInt(row.total_missions, 10),
      missions_terminees: parseInt(row.missions_terminees, 10),
      ca_total: parseFloat(row.ca_total),
      ca_ce_mois: parseFloat(row.ca_ce_mois),
      factures_impayees: parseInt(row.factures_impayees, 10),
      montant_impaye: parseFloat(row.montant_impaye)
    }
  } catch (erreur) {
    console.error('❌ clientModel.getStats : erreur SQL', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// processCreditTransaction
// ─────────────────────────────────────────────────────────────────────────────

async function processCreditTransaction(client_id, type_transaction, montant, description, facture_id = null) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    // 1. Ajouter la transaction
    const insertTxQuery = `
      INSERT INTO client_transactions (client_id, facture_id, type_transaction, montant, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `
    const txResult = await client.query(insertTxQuery, [client_id, facture_id, type_transaction, montant, description])
    
    // 2. Mettre à jour le solde du client
    const updateSoldeQuery = `
      UPDATE clients
      SET solde_credit = solde_credit ${type_transaction === 'credit' ? '+' : '-'} $1
      WHERE id = $2
      RETURNING solde_credit
    `
    const soldeResult = await client.query(updateSoldeQuery, [montant, client_id])
    
    await client.query('COMMIT')
    
    return {
      transaction: txResult.rows[0],
      nouveau_solde: soldeResult.rows[0].solde_credit
    }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ clientModel.processCreditTransaction:', error.message)
    throw error
  } finally {
    client.release()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getTransactions
// ─────────────────────────────────────────────────────────────────────────────

async function getTransactions(client_id) {
  const query = `
    SELECT * FROM client_transactions
    WHERE client_id = $1
    ORDER BY created_at DESC
  `
  try {
    const result = await pool.query(query, [client_id])
    return result.rows
  } catch (error) {
    console.error('❌ clientModel.getTransactions:', error.message)
    throw error
  }
}

module.exports = {
  findAll,
  findById,
  findWithStats,
  create,
  update,
  remove,
  getMissions,
  getFactures,
  getStats,
  processCreditTransaction,
  getTransactions
}
