/**
 * paiementModel.js
 * Modèle de données pour les paiements progressifs — TransiFlow.
 *
 * Chaque facture peut avoir plusieurs paiements (acompte + solde).
 * Ce modèle met aussi à jour le statut de la facture après chaque paiement.
 */

const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// findByFacture
// Récupère tous les paiements d'une facture + solde restant.
// ─────────────────────────────────────────────────────────────────────────────

async function findByFacture(factureId) {
  // Paiements individuels
  const queryPaiements = `
    SELECT
      p.id,
      p.facture_id,
      p.montant,
      p.date_paiement,
      p.mode_paiement,
      p.reference,
      p.notes,
      p.created_at,
      u.nom AS created_by_nom
    FROM paiements p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.facture_id = $1
    ORDER BY p.date_paiement ASC, p.created_at ASC
  `

  // Solde calculé depuis la vue
  const querySolde = `
    SELECT montant_ttc, montant_paye, solde_restant, etat_paiement
    FROM factures_solde
    WHERE id = $1
  `

  const [resPaiements, resSolde] = await Promise.all([
    pool.query(queryPaiements, [factureId]),
    pool.query(querySolde,    [factureId]),
  ])

  const solde = resSolde.rows[0] || { montant_ttc: 0, montant_paye: 0, solde_restant: 0, etat_paiement: 'non_paye' }

  return {
    paiements:      resPaiements.rows,
    montant_ttc:    parseFloat(solde.montant_ttc),
    montant_paye:   parseFloat(solde.montant_paye),
    solde_restant:  parseFloat(solde.solde_restant),
    etat_paiement:  solde.etat_paiement,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create
// Crée un paiement et met à jour le statut de la facture.
//
// Règles métier :
//   total payé >= montant TTC → statut facture = 'payee'
//   total payé > 0 et < montant TTC → statut facture = 'partiel'
// ─────────────────────────────────────────────────────────────────────────────

async function create({ facture_id, montant, date_paiement, mode_paiement, reference, notes, created_by }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Insérer le paiement
    const resPaiement = await client.query(`
      INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [facture_id, montant, date_paiement || new Date(), mode_paiement, reference || null, notes || null, created_by || null])

    // Calculer le total payé après insertion
    const resSolde = await client.query(
      'SELECT montant_paye, montant_ttc, solde_restant, etat_paiement FROM factures_solde WHERE id = $1',
      [facture_id]
    )
    const solde = resSolde.rows[0]

    // Déterminer le nouveau statut de la facture
    let nouveauStatut
    if (parseFloat(solde.montant_paye) >= parseFloat(solde.montant_ttc)) {
      nouveauStatut = 'payee'
    } else if (parseFloat(solde.montant_paye) > 0) {
      nouveauStatut = 'partiel'
    } else {
      nouveauStatut = 'envoyee'
    }

    // Mettre à jour le statut de la facture
    await client.query(
      'UPDATE factures SET statut = $1, updated_at = NOW() WHERE id = $2',
      [nouveauStatut, facture_id]
    )

    await client.query('COMMIT')

    return {
      paiement:        resPaiement.rows[0],
      montant_paye:    parseFloat(solde.montant_paye),
      solde_restant:   parseFloat(solde.solde_restant),
      statut_facture:  nouveauStatut,
    }
  } catch (erreur) {
    await client.query('ROLLBACK')
    console.error('❌ paiementModel.create :', erreur.message)
    throw erreur
  } finally {
    client.release()
  }
}

module.exports = { findByFacture, create }
