/**
 * utilisateurModel.js
 * Modèle de données pour la gestion des utilisateurs — TransiFlow.
 *
 * Toutes les fonctions utilisent pool.query() avec async/await.
 * Les mots de passe sont toujours hachés avec bcrypt (coût 10).
 */

const pool   = require('../db/connection')
const bcrypt = require('bcryptjs')

const COUT_HACHAGE = 10

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// Récupère la liste paginée des utilisateurs avec filtres optionnels.
// Inclut un LEFT JOIN vers la table drivers si driver_id est renseigné.
// ─────────────────────────────────────────────────────────────────────────────

async function findAll({ search = '', role = '', statut = '', page = 1, limit = 10 } = {}) {
  const offset     = (page - 1) * limit
  const values     = []
  const conditions = []
  let   paramIndex = 1

  if (search) {
    conditions.push(`(u.nom ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`)
    values.push(`%${search}%`)
    paramIndex++
  }

  if (role && role !== 'tous') {
    conditions.push(`u.role = $${paramIndex}`)
    values.push(role)
    paramIndex++
  }

  if (statut && statut !== 'tous') {
    conditions.push(`u.statut = $${paramIndex}`)
    values.push(statut)
    paramIndex++
  }

  const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const queryUtilisateurs = `
    SELECT
      u.id, u.nom, u.email, u.role, u.statut,
      u.driver_id, u.telephone, u.photo_url,
      u.derniere_connexion, u.created_at, u.updated_at,
      d.nom     AS driver_nom,
      d.prenom  AS driver_prenom
    FROM users u
    LEFT JOIN drivers d ON u.driver_id = d.id
    ${whereSQL}
    ORDER BY u.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `

  const queryTotal = `
    SELECT COUNT(*) AS total
    FROM users u
    ${whereSQL}
  `

  try {
    const [resultUsers, resultTotal] = await Promise.all([
      pool.query(queryUtilisateurs, [...values, limit, offset]),
      pool.query(queryTotal, values),
    ])

    return {
      utilisateurs: resultUsers.rows,
      total:        parseInt(resultTotal.rows[0].total, 10),
      page:         parseInt(page, 10),
      limit:        parseInt(limit, 10),
    }
  } catch (erreur) {
    console.error('❌ utilisateurModel.findAll :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findById
// Récupère un utilisateur par son identifiant, avec JOIN driver.
// ─────────────────────────────────────────────────────────────────────────────

async function findById(id) {
  const query = `
    SELECT
      u.id, u.nom, u.email, u.role, u.statut,
      u.driver_id, u.telephone, u.photo_url,
      u.derniere_connexion, u.created_at, u.updated_at,
      d.nom    AS driver_nom,
      d.prenom AS driver_prenom
    FROM users u
    LEFT JOIN drivers d ON u.driver_id = d.id
    WHERE u.id = $1
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ utilisateurModel.findById :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findByEmail
// Récupère un utilisateur par son adresse email (utile pour la connexion).
// ─────────────────────────────────────────────────────────────────────────────

async function findByEmail(email) {
  const query = `
    SELECT * FROM users WHERE email = $1
  `
  try {
    const result = await pool.query(query, [email.toLowerCase().trim()])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ utilisateurModel.findByEmail :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// Crée un nouvel utilisateur. Vérifie l'unicité de l'email et hache le mdp.
// ─────────────────────────────────────────────────────────────────────────────

async function create({ nom, email, mot_de_passe, role, driver_id, telephone }) {
  // Vérifier que l'email n'est pas déjà utilisé
  const emailExistant = await findByEmail(email)
  if (emailExistant) {
    const err = new Error('Un compte existe déjà avec cet email')
    err.code  = 'EMAIL_DEJA_UTILISE'
    throw err
  }

  const motDePasseHache = await bcrypt.hash(mot_de_passe, COUT_HACHAGE)

  const query = `
    INSERT INTO users (nom, email, mot_de_passe, role, driver_id, telephone, statut)
    VALUES ($1, $2, $3, $4, $5, $6, 'actif')
    RETURNING id, nom, email, role, statut, driver_id, telephone, created_at
  `
  try {
    const result = await pool.query(query, [
      nom.trim(),
      email.toLowerCase().trim(),
      motDePasseHache,
      role || 'gestionnaire',
      driver_id || null,
      telephone || null,
    ])
    return result.rows[0]
  } catch (erreur) {
    console.error('❌ utilisateurModel.create :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// update
// Met à jour les champs autorisés d'un utilisateur.
// ─────────────────────────────────────────────────────────────────────────────

async function update(id, data) {
  const champsAutorises = ['nom', 'email', 'telephone', 'role', 'statut', 'driver_id']

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
    UPDATE users
    SET ${setKeys.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, nom, email, role, statut, driver_id, telephone, updated_at
  `
  values.push(id)

  try {
    const result = await pool.query(query, values)
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ utilisateurModel.update :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// changerMotDePasse
// Hache et enregistre un nouveau mot de passe pour l'utilisateur donné.
// ─────────────────────────────────────────────────────────────────────────────

async function changerMotDePasse(id, nouveauMdp) {
  const motDePasseHache = await bcrypt.hash(nouveauMdp, COUT_HACHAGE)
  const query = `
    UPDATE users
    SET mot_de_passe = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id
  `
  try {
    const result = await pool.query(query, [motDePasseHache, id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ utilisateurModel.changerMotDePasse :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// reinitialiserMotDePasse
// Génère un mot de passe aléatoire de 8 caractères, le hache et le stocke.
// Retourne le mot de passe en clair (à afficher UNE SEULE FOIS à l'admin).
// ─────────────────────────────────────────────────────────────────────────────

async function reinitialiserMotDePasse(id) {
  // Génération d'un mot de passe alphanumérique aléatoire de 8 caractères
  const mdpClair = Math.random().toString(36).slice(-8).replace(/[^a-zA-Z0-9]/g, 'x').padEnd(8, 'z')
  await changerMotDePasse(id, mdpClair)
  return mdpClair
}

// ─────────────────────────────────────────────────────────────────────────────
// desactiver
// Passe le statut de l'utilisateur à 'inactif'.
// ─────────────────────────────────────────────────────────────────────────────

async function desactiver(id) {
  const query = `
    UPDATE users
    SET statut = 'inactif', updated_at = NOW()
    WHERE id = $1
    RETURNING id, statut
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error('❌ utilisateurModel.desactiver :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// mettreAJourDerniereConnexion
// Met à jour l'horodatage de dernière connexion (appelé après login réussi).
// ─────────────────────────────────────────────────────────────────────────────

async function mettreAJourDerniereConnexion(id) {
  const query = `
    UPDATE users
    SET derniere_connexion = NOW()
    WHERE id = $1
  `
  try {
    await pool.query(query, [id])
  } catch (erreur) {
    console.error('❌ utilisateurModel.mettreAJourDerniereConnexion :', erreur.message)
    throw erreur
  }
}

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  update,
  changerMotDePasse,
  reinitialiserMotDePasse,
  desactiver,
  mettreAJourDerniereConnexion,
}
