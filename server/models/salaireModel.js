/**
 * salaireModel.js
 * Modèle pour gérer les salaires des chauffeurs — TransiFlow.
 */

const pool = require('../db/connection');

async function findAll({ driver_id = null, statut = '', mois_concerne = '', limit = 50, offset = 0 }) {
  const conditions = ['s.deleted_at IS NULL'];
  const values = [];
  let paramIndex = 1;

  if (driver_id) {
    conditions.push(`s.driver_id = $${paramIndex}`);
    values.push(driver_id);
    paramIndex++;
  }

  if (statut && statut !== 'tous') {
    conditions.push(`s.statut = $${paramIndex}`);
    values.push(statut);
    paramIndex++;
  }

  if (mois_concerne) {
    conditions.push(`s.mois_concerne = $${paramIndex}`);
    values.push(mois_concerne);
    paramIndex++;
  }

  const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      s.*, 
      d.prenom as driver_prenom, 
      d.nom as driver_nom,
      m.lieu_depart,
      m.lieu_arrivee
    FROM salaires s
    JOIN drivers d ON s.driver_id = d.id
    LEFT JOIN missions m ON s.mission_id = m.id
    ${whereSQL}
    ORDER BY s.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const queryTotal = `SELECT COUNT(*) as total FROM salaires s ${whereSQL}`;

  try {
    const [result, totalResult] = await Promise.all([
      pool.query(query, [...values, limit, offset]),
      pool.query(queryTotal, values)
    ]);
    return {
      salaires: result.rows,
      total: parseInt(totalResult.rows[0].total, 10)
    };
  } catch (error) {
    console.error('❌ salaireModel.findAll:', error.message);
    throw error;
  }
}

async function findById(id) {
  const query = `
    SELECT 
      s.*, 
      d.prenom as driver_prenom, 
      d.nom as driver_nom,
      m.lieu_depart,
      m.lieu_arrivee
    FROM salaires s
    JOIN drivers d ON s.driver_id = d.id
    LEFT JOIN missions m ON s.mission_id = m.id
    WHERE s.id = $1 AND s.deleted_at IS NULL
  `;
  try {
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ salaireModel.findById:', error.message);
    throw error;
  }
}

async function create(data) {
  const query = `
    INSERT INTO salaires (driver_id, mission_id, type_salaire, montant, statut, mois_concerne, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [
    data.driver_id,
    data.mission_id || null,
    data.type_salaire || 'mission',
    data.montant,
    data.statut || 'en_attente',
    data.mois_concerne || null,
    data.notes || null
  ];
  
  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('❌ salaireModel.create:', error.message);
    throw error;
  }
}

async function update(id, data) {
  const allowedFields = ['montant', 'statut', 'date_paiement', 'notes'];
  const setKeys = [];
  const values = [];
  let paramIndex = 1;

  Object.keys(data).forEach(key => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      setKeys.push(`${key} = $${paramIndex}`);
      values.push(data[key]);
      paramIndex++;
    }
  });

  if (setKeys.length === 0) return null;
  setKeys.push('updated_at = CURRENT_TIMESTAMP');

  const query = `
    UPDATE salaires
    SET ${setKeys.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  values.push(id);

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('❌ salaireModel.update:', error.message);
    throw error;
  }
}

async function deleteSalaire(id) {
  try {
    const result = await pool.query('UPDATE salaires SET deleted_at = NOW() WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('❌ salaireModel.delete:', error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getStats
// Statistiques agrégées des salaires pour un mois et une année donnés.
// Retourne le total par chauffeur + les totaux globaux.
// ─────────────────────────────────────────────────────────────────────────────

async function getStats(mois, annee) {
  // Formater le mois en "YYYY-MM" pour correspondre au format mois_concerne en base
  const moisStr      = String(mois).padStart(2, '0')
  const moisConcerne = `${annee}-${moisStr}`

  const queryParDriver = `
    SELECT
      d.id                                                            AS driver_id,
      d.prenom                                                        AS driver_prenom,
      d.nom                                                           AS driver_nom,
      COUNT(*)                                                        AS total_entrees,
      COALESCE(SUM(s.montant), 0)                                     AS total_montant,
      COALESCE(SUM(CASE WHEN s.statut = 'paye'        THEN s.montant ELSE 0 END), 0) AS montant_paye,
      COALESCE(SUM(CASE WHEN s.statut = 'en_attente'  THEN s.montant ELSE 0 END), 0) AS montant_en_attente,
      COUNT(CASE WHEN s.statut = 'paye'       THEN 1 END)            AS nb_payes,
      COUNT(CASE WHEN s.statut = 'en_attente' THEN 1 END)            AS nb_en_attente
    FROM salaires s
    JOIN drivers d ON s.driver_id = d.id
    WHERE s.mois_concerne = $1
      AND s.deleted_at IS NULL
    GROUP BY d.id, d.prenom, d.nom
    ORDER BY d.nom ASC
  `

  const queryTotaux = `
    SELECT
      COUNT(*)                                                        AS total_entrees,
      COALESCE(SUM(montant), 0)                                       AS total_montant,
      COALESCE(SUM(CASE WHEN statut = 'paye'       THEN montant ELSE 0 END), 0) AS montant_paye,
      COALESCE(SUM(CASE WHEN statut = 'en_attente' THEN montant ELSE 0 END), 0) AS montant_en_attente
    FROM salaires
    WHERE mois_concerne = $1
      AND deleted_at IS NULL
  `

  try {
    const [resParDriver, resTotaux] = await Promise.all([
      pool.query(queryParDriver, [moisConcerne]),
      pool.query(queryTotaux,    [moisConcerne]),
    ])

    const totaux = resTotaux.rows[0]
    return {
      mois_concerne:     moisConcerne,
      par_driver:        resParDriver.rows,
      total_entrees:     parseInt(totaux.total_entrees,     10),
      total_montant:     parseFloat(totaux.total_montant),
      montant_paye:      parseFloat(totaux.montant_paye),
      montant_en_attente: parseFloat(totaux.montant_en_attente),
    }
  } catch (error) {
    console.error('❌ salaireModel.getStats:', error.message)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findByDriver
// Récupère tous les salaires d'un chauffeur, avec filtres mois/année optionnels.
// ─────────────────────────────────────────────────────────────────────────────

async function findByDriver(driverId, { mois, annee } = {}) {
  const conditions  = ['s.driver_id = $1', 's.deleted_at IS NULL']
  const values      = [driverId]
  let   paramIndex  = 2

  // Filtre sur le mois exact si mois + annee fournis
  if (mois && annee) {
    const moisStr = String(mois).padStart(2, '0')
    conditions.push(`s.mois_concerne = $${paramIndex}`)
    values.push(`${annee}-${moisStr}`)
    paramIndex++
  } else if (annee) {
    // Filtre sur l'année seulement
    conditions.push(`s.mois_concerne LIKE $${paramIndex}`)
    values.push(`${annee}-%`)
    paramIndex++
  }

  const query = `
    SELECT
      s.*,
      d.prenom AS driver_prenom,
      d.nom    AS driver_nom,
      m.lieu_depart,
      m.lieu_arrivee
    FROM salaires s
    JOIN drivers  d ON s.driver_id  = d.id
    LEFT JOIN missions m ON s.mission_id = m.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY s.created_at DESC
  `

  try {
    const result = await pool.query(query, values)
    return result.rows
  } catch (error) {
    console.error('❌ salaireModel.findByDriver:', error.message)
    throw error
  }
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  getStats,
  findByDriver,
  delete: deleteSalaire
};
