/**
 * corbeilleModel.js
 * Modèle de données pour la gestion de la corbeille — TransiFlow.
 *
 * Permet de lister, restaurer et supprimer définitivement les éléments
 * marqués comme supprimés (soft-delete : deleted_at IS NOT NULL).
 */

const pool = require('../db/connection')

// Correspondance entre les types de l'API et les tables PostgreSQL
const TABLES_AUTORISEES = {
  vehicles: 'vehicles',
  drivers:  'drivers',
  missions: 'missions',
  clients:  'clients',
}

// ─────────────────────────────────────────────────────────────────────────────
// findAll
// Récupère tous les éléments supprimés pour un type donné.
// Inclut le nom de l'utilisateur qui a supprimé (si deleted_by renseigné).
// ─────────────────────────────────────────────────────────────────────────────

async function findAll(type) {
  const table = TABLES_AUTORISEES[type]
  if (!table) throw new Error(`Type de corbeille invalide : ${type}`)

  // Construction de la sélection selon la table
  let selectExtra = ''
  if (type === 'vehicles') {
    // Colonnes réelles de la table vehicles (pas de marque/modele)
    selectExtra = `t.immatriculation AS libelle, t.type AS vehicle_type, t.statut AS vehicle_statut`
  } else if (type === 'drivers') {
    selectExtra = `CONCAT(t.prenom, ' ', t.nom) AS libelle, t.prenom, t.nom`
  } else if (type === 'missions') {
    // Eviter le caractère → pour la compatibilité encodage
    selectExtra = `CONCAT(t.lieu_depart, ' - ', t.lieu_arrivee) AS libelle, t.date_mission, t.statut AS mission_statut`
  } else if (type === 'clients') {
    selectExtra = `t.nom AS libelle, t.telephone, t.email`
  }

  const query = `
    SELECT
      t.id,
      t.deleted_at,
      t.deleted_by,
      ${selectExtra},
      u.nom   AS deleted_by_nom,
      u.email AS deleted_by_email
    FROM ${table} t
    LEFT JOIN users u ON t.deleted_by = u.id
    WHERE t.deleted_at IS NOT NULL
    ORDER BY t.deleted_at DESC
  `

  try {
    const result = await pool.query(query)
    return result.rows
  } catch (erreur) {
    console.error(`❌ corbeilleModel.findAll(${type}) :`, erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// countAll
// Retourne le nombre d'éléments supprimés par type et le total global.
// ─────────────────────────────────────────────────────────────────────────────

async function countAll() {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM vehicles WHERE deleted_at IS NOT NULL) AS vehicles,
      (SELECT COUNT(*) FROM drivers  WHERE deleted_at IS NOT NULL) AS drivers,
      (SELECT COUNT(*) FROM missions WHERE deleted_at IS NOT NULL) AS missions,
      (SELECT COUNT(*) FROM clients  WHERE deleted_at IS NOT NULL) AS clients
  `
  try {
    const result = await pool.query(query)
    const row = result.rows[0]
    const vehicles = parseInt(row.vehicles, 10)
    const drivers  = parseInt(row.drivers,  10)
    const missions = parseInt(row.missions, 10)
    const clients  = parseInt(row.clients,  10)
    return {
      vehicles,
      drivers,
      missions,
      clients,
      total: vehicles + drivers + missions + clients,
    }
  } catch (erreur) {
    console.error('❌ corbeilleModel.countAll :', erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// restore
// Restaure un élément en remettant deleted_at et deleted_by à NULL.
// ─────────────────────────────────────────────────────────────────────────────

async function restore(type, id) {
  const table = TABLES_AUTORISEES[type]
  if (!table) throw new Error(`Type de corbeille invalide : ${type}`)

  const query = `
    UPDATE ${table}
    SET deleted_at = NULL, deleted_by = NULL
    WHERE id = $1 AND deleted_at IS NOT NULL
    RETURNING id
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error(`❌ corbeilleModel.restore(${type}, ${id}) :`, erreur.message)
    throw erreur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// purge
// Suppression définitive (DELETE physique) d'un élément de la corbeille.
// ─────────────────────────────────────────────────────────────────────────────

async function purge(type, id) {
  const table = TABLES_AUTORISEES[type]
  if (!table) throw new Error(`Type de corbeille invalide : ${type}`)

  const query = `
    DELETE FROM ${table}
    WHERE id = $1 AND deleted_at IS NOT NULL
    RETURNING id
  `
  try {
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (erreur) {
    console.error(`❌ corbeilleModel.purge(${type}, ${id}) :`, erreur.message)
    throw erreur
  }
}

module.exports = {
  findAll,
  countAll,
  restore,
  purge,
}
