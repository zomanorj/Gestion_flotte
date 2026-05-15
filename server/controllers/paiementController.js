/**
 * paiementController.js
 * Contrôleur HTTP pour les paiements progressifs — TransiFlow.
 *
 * Routes :
 *   GET  /api/factures/:id/paiements  → liste + solde restant
 *   POST /api/factures/:id/paiements  → enregistrer un paiement (acompte ou solde)
 */

const paiementModel = require('../models/paiementModel')
const factureModel  = require('../models/factureModel')

// ─────────────────────────────────────────────────────────────────────────────
// getPaiements
// Retourne la liste des paiements d'une facture et le solde restant.
// ─────────────────────────────────────────────────────────────────────────────

async function getPaiements(req, res) {
  try {
    const factureId = parseInt(req.params.id, 10)
    if (isNaN(factureId)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    // Vérifier que la facture existe
    const facture = await factureModel.findById(factureId)
    if (!facture) return res.status(404).json({ succes: false, message: 'Facture introuvable' })

    const donnees = await paiementModel.findByFacture(factureId)
    res.json({ succes: true, donnees })
  } catch (erreur) {
    console.error('❌ paiementController.getPaiements :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des paiements' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// addPaiement
// Enregistre un nouveau paiement (acompte ou solde total).
//
// Validations :
//   - montant > 0
//   - montant <= solde restant (ne pas surpayer)
//   - mode_paiement obligatoire
//   - reference obligatoire si mvola ou virement
// ─────────────────────────────────────────────────────────────────────────────

async function addPaiement(req, res) {
  try {
    const factureId = parseInt(req.params.id, 10)
    if (isNaN(factureId)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const { montant, date_paiement, mode_paiement, reference, notes } = req.body

    // Vérifier que la facture existe
    const facture = await factureModel.findById(factureId)
    if (!facture) return res.status(404).json({ succes: false, message: 'Facture introuvable' })

    // Facture annulée → paiement impossible
    if (facture.statut === 'annulee') {
      return res.status(400).json({ succes: false, message: 'Impossible de payer une facture annulée' })
    }

    // Validations de base
    const montantNum = parseFloat(montant)
    if (!montant || isNaN(montantNum) || montantNum <= 0) {
      return res.status(400).json({ succes: false, message: 'Le montant doit être supérieur à 0' })
    }

    if (!mode_paiement) {
      return res.status(400).json({ succes: false, message: 'Le mode de paiement est obligatoire' })
    }

    // Référence obligatoire pour MVola et virement
    if (['mvola', 'virement'].includes(mode_paiement) && !reference?.trim()) {
      return res.status(400).json({
        succes:  false,
        message: `La référence est obligatoire pour un paiement par ${mode_paiement}`,
      })
    }

    // Récupérer le solde actuel
    const soldeCourant = await paiementModel.findByFacture(factureId)
    if (montantNum > soldeCourant.solde_restant + 0.01) {
      // Tolérance de 1 centime pour les arrondis
      return res.status(400).json({
        succes:  false,
        message: `Le montant (${montantNum} Ar) dépasse le solde restant (${soldeCourant.solde_restant} Ar)`,
      })
    }

    // Créer le paiement
    const resultat = await paiementModel.create({
      facture_id:    factureId,
      montant:       montantNum,
      date_paiement: date_paiement || new Date().toISOString().split('T')[0],
      mode_paiement,
      reference:     reference?.trim() || null,
      notes:         notes?.trim()     || null,
      created_by:    req.user?.id      || null,
    })

    res.status(201).json({
      succes:  true,
      message: resultat.solde_restant <= 0 ? 'Facture intégralement payée' : 'Paiement enregistré',
      donnees: resultat,
    })
  } catch (erreur) {
    console.error('❌ paiementController.addPaiement :', erreur.message)
    res.status(500).json({ succes: false, message: "Erreur serveur lors de l'enregistrement du paiement" })
  }
}

module.exports = { getPaiements, addPaiement }
