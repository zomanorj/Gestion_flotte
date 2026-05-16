/**
 * contratModel.js
 * Modèle de données pour les contrats clients — TransiFlow.
 *
 * Gestion complète : création avec numéro auto, mise à jour, renouvellement
 * et alertes d'expiration.
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// Récupère la liste des contrats avec filtres optionnels et pagination.
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({ client_id, statut, page = 1, limit = 10 } = {}) {
  const offset     = (page - 1) * limit
  const values     = []
  const conditions = []
  let   paramIndex = 1

  if (client_id) {
    conditions.push(`c.client_id = $${paramIndex}`)
    values.push(client_id)
    paramIndex++
  }

  if (statut && statut !== 'tous') {
    conditions.push(`c.statut = $${paramIndex}`)
    values.push(statut)
    paramIndex++
  }

  const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const queryContrats = `
    SELECT
      c.*,
      cl.nom AS client_nom
    FROM contrats c
    LEFT JOIN clients cl ON c.client_id = cl.id
    ${whereSQL}
    ORDER BY c.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  const queryTotal = `
    SELECT COUNT(*) AS total
    FROM contrats c
    ${whereSQL}
  `

  try {
    const [resultContrats, resultTotal] = await Promise.all([
      pool.query(queryContrats, [...values, limit, offset]),
      pool.query(queryTotal, values),
    ])

    return {
      contrats: resultContrats.rows,
      total:    parseInt(resultTotal.rows[0].total, 10),
      page:     parseInt(page, 10),
      limit:    parseInt(limit, 10),
    }
  } catch (erreur) {
    console.error('❌ contratModel.findAll :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// Récupère un contrat par son identifiant, avec JOIN client.
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const query = `
    SELECT
      c.*,
      cl.nom AS client_nom
    FROM contrats c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.id = $1
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ contratModel.findById :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findByClient
// Récupère tous les contrats d'un client donné.
// ─────────────────────────────────────────────────────────────────────────────

async function findByClient(client_id) {
  const query = `
    SELECT c.*, cl.nom AS client_nom
    FROM contrats c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.client_id = $1
    ORDER BY c.created_at DESC
  `
  try {
    const result = await pool.query(query, [client_id])
    return result.rows
  } catch (erreur) {
    console.error('❌ contratModel.findByClient :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findActifByClient
// Récupère le contrat actif en cours d'un client (non expiré).
// ─────────────────────────────────────────────────────────────────────────────

async function findActifByClient(client_id) {
  const query = `
    SELECT c.*, cl.nom AS client_nom
    FROM contrats c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.client_id = $1
      AND c.statut = 'actif'
      AND (c.date_fin IS NULL OR c.date_fin >= NOW())
    ORDER BY c.date_debut DESC
    LIMIT 1
  `
  try {
    const result = await pool.query(query, [client_id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ contratModel.findActifByClient :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateNumero
// Génère un numéro de contrat unique au format CTR-YYYY-XXXX.
// ─────────────────────────────────────────────────────────────────────────────

async function generateNumero() {
  const annee  = new Date().getFullYear()
  const query  = `SELECT COUNT(*) AS total FROM contrats WHERE EXTRACT(YEAR FROM created_at) = $1`

  try {
    const result  = await pool.query(query, [annee])
    const suivant = parseInt(result.rows[0].total, 10) + 1
    return `CTR-${annee}-${String(suivant).padStart(4, '0')}`
  } catch (erreur) {
    console.error('❌ contratModel.generateNumero :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// Crée un nouveau contrat avec numéro auto-généré.
// ─────────────────────────────────────────────────────────────────────────────

async function create(data) {
  const numero = await generateNumero()

  const query = `
    INSERT INTO contrats (
      client_id, numero, titre, statut, date_debut, date_fin,
      tarif_km, tarif_mission, conditions_paiement, delai_paiement_jours,
      remise_pourcentage, notes, renouvellement_auto, duree_renouvellement_mois,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `
  try {
    const result = await pool.query(query, [
      data.client_id,
      numero,
      data.titre,
      data.statut                    || 'actif',
      data.date_debut,
      data.date_fin                  || null,
      data.tarif_km                  || null,
      data.tarif_mission             || null,
      data.conditions_paiement       || null,
      data.delai_paiement_jours      || 30,
      data.remise_pourcentage        || 0,
      data.notes                     || null,
      data.renouvellement_auto       || false,
      data.duree_renouvellement_mois || 12,
      data.created_by                || null,
    ])
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ contratModel.create :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// update
// Met à jour les champs autorisés d'un contrat.
// ─────────────────────────────────────────────────────────────────────────────

async function update(id, data) {
  const champsAutorises = [
    'titre', 'statut', 'date_debut', 'date_fin',
    'tarif_km', 'tarif_mission', 'conditions_paiement', 'delai_paiement_jours',
    'remise_pourcentage', 'notes', 'renouvellement_auto', 'duree_renouvellement_mois',
  ]

  const setKeys = []
  const values  = []
  let   paramIndex = 1

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
    UPDATE contrats
    SET ${setKeys.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `
  values.push(id)

  try {
    const result = await pool.query(query, values)
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ contratModel.update :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// renouveler
// Crée un nouveau contrat à partir du contrat existant.
// La nouvelle date_debut = date_fin du contrat actuel + 1 jour.
// ─────────────────────────────────────────────────────────────────────────────

async function renouveler(id) {
  const contratExistant = await findById(id)
  if (!contratExistant) throw new Error('Contrat introuvable')

  // Calculer la nouvelle date de début : lendemain de la date_fin
  const dateFinActuelle = contratExistant.date_fin
    ? new Date(contratExistant.date_fin)
    : new Date()

  const nouvelleDateDebut = new Date(dateFinActuelle)
  nouvelleDateDebut.setDate(nouvelleDateDebut.getDate() + 1)

  // Calculer la nouvelle date_fin si durée_renouvellement_mois est définie
  let nouvelleDateFin = null
  if (contratExistant.duree_renouvellement_mois) {
    nouvelleDateFin = new Date(nouvelleDateDebut)
    nouvelleDateFin.setMonth(nouvelleDateFin.getMonth() + parseInt(contratExistant.duree_renouvellement_mois, 10))
  }

  return create({
    ...contratExistant,
    date_debut: nouvelleDateDebut.toISOString().split('T')[0],
    date_fin:   nouvelleDateFin ? nouvelleDateFin.toISOString().split('T')[0] : null,
    statut:     'actif',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// getContratsExpirantBientot
// Retourne les contrats dont la date_fin est dans les 30 prochains jours.
// ─────────────────────────────────────────────────────────────────────────────

async function getContratsExpirantBientot() {
  const query = `
    SELECT
      c.*,
      cl.nom AS client_nom
    FROM contrats c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.statut = 'actif'
      AND c.date_fin IS NOT NULL
      AND c.date_fin BETWEEN NOW() AND NOW() + INTERVAL '30 days'
    ORDER BY c.date_fin ASC
  `
  try {
    const result = await pool.query(query)
    return result.rows
  } catch (erreur) {
    console.error('❌ contratModel.getContratsExpirantBientot :', erreur.message)
    throw erreur
  }
}

module.exports = {
  findAll,
  findById,
  findByClient,
  findActifByClient,
  generateNumero,
  create,
  update,
  renouveler,
  getContratsExpirantBientot,
}
