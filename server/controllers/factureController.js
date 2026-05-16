/**
 * factureController.js
 * Contrôleur HTTP pour les factures — TransiFlow.
 */

const PDFDocument = require('pdfkit')
const factureModel = require('../models/factureModel')
const clientModel = require('../models/clientModel')

/**
 * Formate un montant en MGA pour le PDF.
 * Pas de slash, séparateur espace.
 * Résultat : "2 000 000 Ar"
 */
const fmt = (n) => {
  if (!n && n !== 0) return '0 Ar'
  return Math.round(parseFloat(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar'
}

// Utilitaire de formatage de date
function formaterDateFR(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

async function getFactures(req, res) {
  try {
    const { client_id, mission_id, statut, date_debut, date_fin, page, limit } = req.query
    const resultats = await factureModel.findAll({
      client_id: client_id ? parseInt(client_id, 10) : null,
      mission_id: mission_id ? parseInt(mission_id, 10) : null,
      statut,
      date_debut,
      date_fin,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    })

    res.json({
      succes: true,
      donnees: resultats.factures,
      pagination: {
        total: resultats.total,
        page: resultats.page,
        limit: resultats.limit,
        pages: Math.ceil(resultats.total / resultats.limit)
      }
    })
  } catch (erreur) {
    console.error('❌ factureController.getFactures :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des factures' })
  }
}

async function getFacture(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const facture = await factureModel.findById(id)
    if (!facture) return res.status(404).json({ succes: false, message: 'Facture introuvable' })

    res.json({ succes: true, donnees: facture })
  } catch (erreur) {
    console.error('❌ factureController.getFacture :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération de la facture' })
  }
}

async function createFacture(req, res) {
  try {
    const { client_id, montant_ht, mission_id } = req.body
    const pool = require('../db/connection')

    const erreurs = []
    if (!client_id) erreurs.push('Le client est obligatoire')
    if (montant_ht === undefined || isNaN(parseFloat(montant_ht))) erreurs.push('Le montant HT est invalide ou manquant')

    if (erreurs.length > 0) {
      return res.status(400).json({ succes: false, message: 'Erreurs de validation', erreurs })
    }

    // Vérifier que le client existe
    const clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [client_id])
    if (!clientCheck.rows.length) {
      return res.status(400).json({ succes: false, message: 'Client introuvable' })
    }

    // Si mission_id fourni, vérifier qu'elle existe
    if (mission_id && parseInt(mission_id) > 0) {
      const missionCheck = await pool.query('SELECT id FROM missions WHERE id = $1', [parseInt(mission_id)])
      if (!missionCheck.rows.length) {
        return res.status(400).json({ succes: false, message: `Mission #${mission_id} introuvable — sélectionnez une mission valide ou laissez vide` })
      }
    }

    const donneesFacture = {
      ...req.body,
      created_by: req.user ? req.user.id : null,
    }

    const nouvelleFacture = await factureModel.create(donneesFacture)
    res.status(201).json({ succes: true, message: 'Facture créée avec succès', donnees: nouvelleFacture })
  } catch (erreur) {
    console.error('❌ factureController.createFacture :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la création de la facture' })
  }
}

async function updateFacture(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const factureExistante = await factureModel.findById(id)
    if (!factureExistante) return res.status(404).json({ succes: false, message: 'Facture introuvable' })
    if (factureExistante.statut !== 'brouillon') {
      return res.status(403).json({ succes: false, message: 'Impossible de modifier une facture envoyée ou payée' })
    }

    const factureMaj = await factureModel.update(id, req.body)
    res.json({ succes: true, message: 'Facture mise à jour', donnees: factureMaj })
  } catch (erreur) {
    console.error('❌ factureController.updateFacture :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la mise à jour de la facture' })
  }
}

async function marquerPayee(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    const { mode_paiement, date_paiement } = req.body

    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })
    if (!mode_paiement) return res.status(400).json({ succes: false, message: 'Mode de paiement obligatoire' })

    const factureExistante = await factureModel.findById(id)
    if (!factureExistante) return res.status(404).json({ succes: false, message: 'Facture introuvable' })

    if (mode_paiement === 'credit') {
      const clientModel = require('../models/clientModel')
      const clientStats = await clientModel.getStats(factureExistante.client_id)
      const client = await clientModel.findById(factureExistante.client_id)
      
      if (!client || (client.solde_credit || 0) < factureExistante.montant_ttc) {
        return res.status(400).json({ succes: false, message: 'Solde de crédit insuffisant' })
      }

      await clientModel.processCreditTransaction(
        factureExistante.client_id,
        'debit',
        factureExistante.montant_ttc,
        `Paiement facture #${factureExistante.numero}`,
        id
      )
    }

    const factureMaj = await factureModel.marquerPayee(id, { mode_paiement, date_paiement })
    
    res.json({ succes: true, message: 'Facture marquée comme payée', donnees: factureMaj })
  } catch (erreur) {
    console.error('❌ factureController.marquerPayee :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors du marquage en payé' })
  }
}

async function annulerFacture(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const factureMaj = await factureModel.annuler(id)
    if (!factureMaj) return res.status(400).json({ succes: false, message: 'Facture introuvable ou déjà payée' })

    res.json({ succes: true, message: 'Facture annulée avec succès', donnees: factureMaj })
  } catch (erreur) {
    console.error('❌ factureController.annulerFacture :', erreur.message)
    res.status(500).json({ succes: false, message: "Erreur serveur lors de l'annulation" })
  }
}

async function getStatsFactures(req, res) {
  try {
    const { date_debut, date_fin } = req.query
    const stats = await factureModel.getStatsFactures(date_debut, date_fin)
    res.json({ succes: true, donnees: stats })
  } catch (erreur) {
    console.error('❌ factureController.getStatsFactures :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur lors de la récupération des statistiques' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generatePDF
// Génère un PDF facture tenant sur une seule page A4 (842pt).
// Structure : en-tête → client → tableau prestation → totaux → signature → pied
// ─────────────────────────────────────────────────────────────────────────────

async function generatePDF(req, res) {
  try {
    const facture = await factureModel.findById(req.params.id)
    if (!facture) {
      return res.status(404).json({ message: 'Facture introuvable' })
    }

    // Headers pour téléchargement
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Facture-${facture.numero}.pdf`
    )

    // Créer le document PDF UNE SEULE PAGE
    // bufferPages:true indispensable pour appeler flushPages() avant end()
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      autoFirstPage: true,
      bufferPages: true,
    })

    // Pipe vers la réponse
    doc.pipe(res)

    // ── FONCTION FORMATAGE MONTANT ──
    const fmt = (n) => {
      if (!n && n !== 0) return '0 Ar'
      return Math.round(parseFloat(n))
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar'
    }

    // ── FONCTION DATE ──
    const fmtDate = (d) => {
      if (!d) return ''
      return new Date(d).toLocaleDateString('fr-FR')
    }

    // ── EN-TÊTE ──
    doc.fontSize(20).font('Helvetica-Bold')
       .text('TRANSIFLOW', 40, 40)
    doc.fontSize(9).font('Helvetica')
       .fillColor('#64748B')
       .text('Systeme de Gestion de Transport', 40, 65)
    doc.fillColor('black')

    // Numéro et dates à droite
    doc.fontSize(18).font('Helvetica-Bold')
       .fillColor('#1E40AF')
       .text('FACTURE', 350, 40, { width: 200, align: 'right' })
    doc.fontSize(9).font('Helvetica')
       .fillColor('black')
       .text(`N${String.fromCharCode(176)} ${facture.numero}`,
             350, 65, { width: 200, align: 'right' })
       .text(`Date : ${fmtDate(facture.date_emission)}`,
             350, 78, { width: 200, align: 'right' })
       .text(`Echeance : ${fmtDate(facture.date_echeance)}`,
             350, 91, { width: 200, align: 'right' })

    // Ligne séparatrice
    doc.moveTo(40, 115).lineTo(555, 115)
       .strokeColor('#E2E8F0').lineWidth(1).stroke()

    // ── CLIENT ──
    doc.fontSize(8).fillColor('#64748B')
       .text('FACTURER A :', 40, 125)
    doc.fontSize(11).font('Helvetica-Bold')
       .fillColor('black')
       .text(facture.client_nom || '', 40, 138)
    doc.fontSize(9).font('Helvetica')

    let yClient = 153
    if (facture.client_adresse) {
      doc.text(facture.client_adresse, 40, yClient)
      yClient += 13
    }
    if (facture.client_ville) {
      doc.text(facture.client_ville, 40, yClient)
      yClient += 13
    }
    if (facture.client_nif) {
      doc.text(`NIF : ${facture.client_nif}`, 40, yClient)
      yClient += 13
    }
    if (facture.client_stat) {
      doc.text(`STAT : ${facture.client_stat}`, 40, yClient)
      yClient += 13
    }
    if (facture.client_telephone) {
      doc.text(`Tel : ${facture.client_telephone}`, 40, yClient)
    }

    // Ligne séparatrice
    doc.moveTo(40, 235).lineTo(555, 235)
       .strokeColor('#E2E8F0').lineWidth(1).stroke()

    // ── TABLEAU PRESTATIONS ──
    // En-tête tableau bleu
    doc.rect(40, 245, 515, 22)
       .fill('#1E40AF')
    doc.fontSize(9).font('Helvetica-Bold')
       .fillColor('white')
       .text('DESIGNATION', 50, 252)
       .text('MONTANT HT', 450, 252,
             { width: 95, align: 'right' })
    doc.fillColor('black').font('Helvetica')

    // Ligne prestation
    doc.rect(40, 267, 515, 30)
       .strokeColor('#E2E8F0').lineWidth(0.5).stroke()

    // Description — remplacer caractères spéciaux
    const description = (facture.description || 'Prestation de transport')
      .replace(/→/g, '-')
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/«/g, '"')
      .replace(/»/g, '"')

    doc.fontSize(9)
       .text(description, 50, 274, { width: 370 })
       .text(fmt(facture.montant_ht), 450, 274,
             { width: 95, align: 'right' })

    // Référence mission si disponible
    if (facture.mission_id) {
      doc.fontSize(8).fillColor('#64748B')
         .text(
           `Ref mission : #${String(facture.mission_id).padStart(4,'0')}`,
           50, 286
         )
      doc.fillColor('black')
    }

    // ── TOTAUX ──
    const yTotaux = 315
    doc.moveTo(350, yTotaux).lineTo(555, yTotaux)
       .strokeColor('#E2E8F0').stroke()

    doc.fontSize(9)
       .text('Sous-total HT :', 350, yTotaux + 8)
       .text(fmt(facture.montant_ht), 450, yTotaux + 8,
             { width: 95, align: 'right' })

       .text(`TVA (${facture.taux_tva}%) :`,
             350, yTotaux + 22)
       .text(fmt(facture.montant_tva), 450, yTotaux + 22,
             { width: 95, align: 'right' })

    // Rectangle TOTAL
    doc.rect(350, yTotaux + 36, 205, 24)
       .fill('#F1F5F9')
    doc.fontSize(11).font('Helvetica-Bold')
       .fillColor('#1E40AF')
       .text('TOTAL TTC :', 360, yTotaux + 42)
       .text(fmt(facture.montant_ttc), 450, yTotaux + 42,
             { width: 95, align: 'right' })
    doc.fillColor('black').font('Helvetica')

    // ── PAIEMENT ──
    const yPaiement = yTotaux + 80
    doc.moveTo(40, yPaiement).lineTo(555, yPaiement)
       .strokeColor('#E2E8F0').stroke()

    doc.fontSize(8).fillColor('#64748B')
       .text('INFORMATIONS DE PAIEMENT', 40, yPaiement + 8)
    doc.fontSize(9).fillColor('black')

    if (facture.mode_paiement) {
      doc.text(
        `Mode : ${facture.mode_paiement}`,
        40, yPaiement + 22
      )
    }
    doc.text(
      `Conditions : ${facture.conditions_paiement || 'Paiement a 30 jours'}`,
      40, yPaiement + 35
    )

    // ── SIGNATURE ──
    const ySign = yPaiement + 65
    doc.fontSize(9)
       .text('Signature & cachet :', 40, ySign)
       .text('_________________________________', 40, ySign + 15)

    // ── PIED DE PAGE ──
    doc.fontSize(8).fillColor('#94A3B8')
       .text(
         'TransiFlow - Systeme de Gestion de Transport',
         40, 790,
         { width: 515, align: 'center' }
       )

    // Vider le buffer et terminer le document UNE SEULE FOIS
    doc.flushPages()
    doc.end()

  } catch (error) {
    console.error('Erreur generation PDF:', error)
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur generation PDF' })
    }
  }
}

module.exports = {
  getFactures,
  getFacture,
  createFacture,
  updateFacture,
  marquerPayee,
  annulerFacture,
  getStatsFactures,
  generatePDF
}
