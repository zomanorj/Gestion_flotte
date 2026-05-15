/**
 * factureController.js
 * Contrôleur HTTP pour les factures — TransiFlow.
 */

const PDFDocument = require('pdfkit')
const factureModel = require('../models/factureModel')
const clientModel = require('../models/clientModel')

// Utilitaire de formatage de la monnaie (MGA)
const formatMGA = (montant) => {
  return new Intl.NumberFormat('fr-MG', {
    style: 'currency',
    currency: 'MGA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(montant).replace('MGA', 'Ar')
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
    const { client_id, statut, date_debut, date_fin, page, limit } = req.query
    const resultats = await factureModel.findAll({
      client_id: client_id ? parseInt(client_id, 10) : null,
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

    const factureMaj = await factureModel.marquerPayee(id, { mode_paiement, date_paiement })
    if (!factureMaj) return res.status(404).json({ succes: false, message: 'Facture introuvable' })

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
// Génère un PDF pour une facture spécifique.
// ─────────────────────────────────────────────────────────────────────────────

async function generatePDF(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const facture = await factureModel.findById(id)
    if (!facture) return res.status(404).json({ succes: false, message: 'Facture introuvable' })

    // Configuration PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    })

    const filename = `Facture-${facture.numero}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-cache')

    doc.pipe(res)

    // ── En-tête de la facture ──
    doc.rect(50, 50, 495, 80).stroke('#1e3a5f')

    // Logo (placeholder) et Titre
    doc.fontSize(24).font('Helvetica-Bold').text('FACTURE', 70, 70, { align: 'center', color: '#1e3a5f' })
    doc.fontSize(10).font('Helvetica').text('TransiFlow', 70, 100, { align: 'center', color: '#64748b' })

    // Infos Facture
    doc.fontSize(11).font('Helvetica-Bold').text(`N° ${facture.numero}`, 70, 145, { color: '#1e3a5f' })
    doc.fontSize(10).font('Helvetica').text(`Date d'émission : ${formaterDateFR(facture.date_emission)}`, 350, 145, { align: 'right' })
    if (facture.date_echeance) {
      doc.text(`Échéance : ${formaterDateFR(facture.date_echeance)}`, 350, 160, { align: 'right' })
    }

    // ── Client ──
    doc.fontSize(12).font('Helvetica-Bold').text('FACTURER À :', 70, 190, { color: '#1e3a5f' })
    doc.moveTo(70, 205).lineTo(250, 205).stroke('#e2e8f0')

    doc.fontSize(10).font('Helvetica-Bold').text(facture.client_nom, 70, 215)
    if (facture.client_adresse) doc.font('Helvetica').text(facture.client_adresse, 70, 230)
    if (facture.client_ville) doc.text(facture.client_ville, 70, 245)
    
    let infoFiscalesY = 260
    if (facture.client_nif) { doc.text(`NIF: ${facture.client_nif}`, 70, infoFiscalesY); infoFiscalesY += 15; }
    if (facture.client_stat) { doc.text(`STAT: ${facture.client_stat}`, 70, infoFiscalesY); }

    // ── Tableau Désignation ──
    const startTableY = 320
    doc.rect(50, startTableY, 495, 20).fill('#f8fafc').stroke()
    
    doc.fillColor('#1e3a5f').fontSize(10).font('Helvetica-Bold')
    doc.text('DÉSIGNATION', 60, startTableY + 5)
    doc.text('MONTANT HT', 400, startTableY + 5, { width: 135, align: 'right' })

    doc.fillColor('#000').font('Helvetica')
    
    // Contenu
    const contentY = startTableY + 30
    
    let desc = facture.description || ''
    if (!desc && facture.lieu_depart && facture.lieu_arrivee) {
      desc = `Transport ${facture.lieu_depart} → ${facture.lieu_arrivee}`
      if (facture.date_mission) desc += ` le ${formaterDateFR(facture.date_mission)}`
    }
    
    doc.text(desc, 60, contentY, { width: 320 })
    if (facture.mission_id) {
      doc.fontSize(9).fillColor('#64748b').text(`Réf mission: #${String(facture.mission_id).padStart(4, '0')}`, 60, contentY + 15)
    }

    doc.fontSize(10).fillColor('#000').text(formatMGA(facture.montant_ht), 400, contentY, { width: 135, align: 'right' })

    // Ligne bas du tableau
    const endTableY = contentY + 50
    doc.moveTo(50, startTableY).lineTo(50, endTableY).stroke()
    doc.moveTo(545, startTableY).lineTo(545, endTableY).stroke()
    doc.moveTo(50, endTableY).lineTo(545, endTableY).stroke()

    // ── Récapitulatif Total ──
    const summaryY = endTableY + 20
    doc.rect(345, summaryY, 200, 70).stroke('#e2e8f0')

    doc.text('Sous-total HT :', 355, summaryY + 10)
    doc.text(formatMGA(facture.montant_ht), 400, summaryY + 10, { width: 135, align: 'right' })

    doc.text(`TVA (${parseFloat(facture.taux_tva)}%) :`, 355, summaryY + 30)
    doc.text(formatMGA(facture.montant_tva), 400, summaryY + 30, { width: 135, align: 'right' })

    doc.font('Helvetica-Bold').text('TOTAL TTC :', 355, summaryY + 55)
    doc.text(formatMGA(facture.montant_ttc), 400, summaryY + 55, { width: 135, align: 'right' })

    // ── Conditions & Infos de paiement ──
    const infoY = summaryY + 90
    doc.font('Helvetica-Bold').text('INFORMATIONS DE PAIEMENT', 70, infoY, { color: '#1e3a5f' })
    doc.moveTo(70, infoY + 15).lineTo(250, infoY + 15).stroke('#e2e8f0')

    doc.font('Helvetica').fillColor('#000')
    let currentInfoY = infoY + 25
    if (facture.conditions_paiement) {
      doc.text(`Conditions : ${facture.conditions_paiement}`, 70, currentInfoY)
      currentInfoY += 15
    }
    if (facture.mode_paiement) {
      doc.text(`Mode de paiement attendu/reçu : ${facture.mode_paiement.toUpperCase()}`, 70, currentInfoY)
    }

    if (facture.statut === 'payee') {
      doc.fontSize(16).fillColor('#22c55e').font('Helvetica-Bold').text('ACQUITTÉE', 400, infoY + 20, { align: 'center' })
      doc.fontSize(10).fillColor('#000').font('Helvetica').text(`Le ${formaterDateFR(facture.date_paiement)}`, 400, infoY + 40, { align: 'center' })
    }

    // ── Pied de page ──
    const pageHeight = doc.page.height
    doc.fontSize(8).fillColor('#94a3b8').text(
      'TransiFlow - Système de Gestion de Transport',
      70, pageHeight - 40, { align: 'center' }
    )

    doc.end()

  } catch (erreur) {
    console.error('❌ factureController.generatePDF :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la génération du PDF' })
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
