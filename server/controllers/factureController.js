/**
 * factureController.js
 * Contrôleur HTTP pour les factures — TransiFlow.
 */

const PDFDocument = require('pdfkit')
const factureModel = require('../models/factureModel')
const clientModel = require('../models/clientModel')

/**
 * Formate un montant en MGA pour le PDF.
 * Utilise fr-FR (espace insécable comme séparateur milliers) — jamais de slash.
 * Résultat : "2 000 000 Ar"
 */
function formatMontant(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' Ar'
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
// Génère un PDF facture tenant sur une seule page A4 (842pt).
// Structure : en-tête → client → tableau prestation → totaux → signature → pied
// ─────────────────────────────────────────────────────────────────────────────

async function generatePDF(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const facture = await factureModel.findById(id)
    if (!facture) return res.status(404).json({ succes: false, message: 'Facture introuvable' })

    // Marges compactes pour tenir sur une page A4
    const doc = new PDFDocument({
      size:    'A4',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      autoFirstPage: true,
    })

    const filename = `Facture-${facture.numero}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-cache')
    doc.pipe(res)

    // ── Constantes de mise en page ──
    const L = 50    // marge gauche
    const R = 545   // marge droite (595 - 50)
    const W = 495   // largeur utile

    // ─────────────────────────────────────────────────────────────────────────
    // 1. EN-TETE (y: 40-115)
    // ─────────────────────────────────────────────────────────────────────────
    let y = 40

    // Rectangle titre bleu marine
    doc.rect(L, y, W, 50).fill('#1E3A5F')

    // Titre FACTURE à gauche
    doc.fillColor('white').font('Helvetica-Bold').fontSize(18)
       .text('FACTURE', L + 12, y + 16)

    // Numéro + société à droite
    doc.font('Helvetica').fontSize(9)
       .text(facture.numero, R - 130, y + 10, { width: 120, align: 'right' })
    doc.fillColor('#BFD7FF').fontSize(8)
       .text('TransiFlow - Transport & Logistique', R - 180, y + 24, { width: 170, align: 'right' })

    y += 55

    // Ligne de dates (émission + échéance)
    doc.fillColor('#334155').font('Helvetica').fontSize(9)
       .text(`Emis le : ${formaterDateFR(facture.date_emission)}`, L, y)
    if (facture.date_echeance) {
      doc.text(`Echeance : ${formaterDateFR(facture.date_echeance)}`, L + 160, y)
    }
    // Statut payée en vert à droite
    if (facture.statut === 'payee') {
      doc.fillColor('#16A34A').font('Helvetica-Bold').fontSize(10)
         .text('ACQUITTEE', R - 100, y - 2, { width: 100, align: 'right' })
      if (facture.date_paiement) {
        doc.fillColor('#16A34A').font('Helvetica').fontSize(8)
           .text(`le ${formaterDateFR(facture.date_paiement)}`, R - 100, y + 12, { width: 100, align: 'right' })
      }
    }

    y += 18
    // Séparateur horizontal
    doc.moveTo(L, y).lineTo(R, y).strokeColor('#CBD5E1').lineWidth(0.5).stroke()

    // ─────────────────────────────────────────────────────────────────────────
    // 2. BLOC CLIENT (y: 118-185)
    // ─────────────────────────────────────────────────────────────────────────
    y += 10

    doc.fillColor('#1E3A5F').font('Helvetica-Bold').fontSize(8)
       .text('FACTURER A :', L, y)
    y += 12

    // Nom client en gras
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10)
       .text(facture.client_nom || '-', L, y)
    y += 13

    doc.font('Helvetica').fontSize(9).fillColor('#475569')
    if (facture.client_adresse) { doc.text(facture.client_adresse, L, y); y += 11 }
    if (facture.client_ville)   { doc.text(facture.client_ville,   L, y); y += 11 }
    if (facture.client_nif)     { doc.text(`NIF : ${facture.client_nif}`,   L, y); y += 11 }
    if (facture.client_stat)    { doc.text(`STAT : ${facture.client_stat}`, L, y); y += 11 }

    y += 6
    doc.moveTo(L, y).lineTo(R, y).strokeColor('#CBD5E1').lineWidth(0.5).stroke()

    // ─────────────────────────────────────────────────────────────────────────
    // 3. TABLEAU DESIGNATION (y: 195-265)
    // ─────────────────────────────────────────────────────────────────────────
    y += 10

    // En-tête de tableau (fond bleu)
    const COL_PRIX = R - 110  // colonne prix à partir de x
    doc.rect(L, y, W, 18).fill('#1E40AF')
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5)
       .text('DESIGNATION', L + 8, y + 5)
       .text('MONTANT HT', COL_PRIX, y + 5, { width: 100, align: 'right' })
    y += 18

    // Ligne de contenu
    // Remplacer → par " - " pour compatibilité pdfkit
    let desc = (facture.description || '').replace(/→/g, ' - ').replace(/→/g, ' - ')
    if (!desc && facture.lieu_depart && facture.lieu_arrivee) {
      desc = `Transport ${facture.lieu_depart} - ${facture.lieu_arrivee}`
      if (facture.date_mission) desc += ` le ${formaterDateFR(facture.date_mission)}`
    }

    // Hauteur de la ligne prestation (variable selon la longueur de la description)
    const ligneH = 30
    doc.rect(L, y, W, ligneH).stroke('#E2E8F0')
    doc.fillColor('#1E293B').font('Helvetica').fontSize(9)
       .text(desc, L + 8, y + 7, { width: COL_PRIX - L - 20 })

    if (facture.mission_id) {
      doc.fillColor('#94A3B8').fontSize(7.5)
         .text(`Ref. mission #${String(facture.mission_id).padStart(4, '0')}`, L + 8, y + 20)
    }
    doc.fillColor('#1E293B').font('Helvetica').fontSize(9)
       .text(formatMontant(facture.montant_ht), COL_PRIX, y + 7, { width: 100, align: 'right' })

    y += ligneH + 10

    // ─────────────────────────────────────────────────────────────────────────
    // 4. RECAPITULATIF TOTAUX (y: 275-330)
    // ─────────────────────────────────────────────────────────────────────────

    // Bloc totaux à droite
    const BX = R - 180  // x du bloc totaux
    const BW = 180       // largeur du bloc

    doc.rect(BX, y, BW, 52).fill('#F8FAFC').stroke('#E2E8F0')

    doc.fillColor('#475569').font('Helvetica').fontSize(9)
    doc.text('Sous-total HT :',         BX + 8, y + 8)
    doc.text(formatMontant(facture.montant_ht),  BX + 90, y + 8,  { width: BW - 98, align: 'right' })

    doc.text(`TVA (${parseFloat(facture.taux_tva || 20)} %) :`, BX + 8, y + 22)
    doc.text(formatMontant(facture.montant_tva), BX + 90, y + 22, { width: BW - 98, align: 'right' })

    // Ligne TOTAL TTC en gras
    doc.rect(BX, y + 33, BW, 19).fill('#1E3A5F')
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9.5)
    doc.text('TOTAL TTC :',             BX + 8, y + 37)
    doc.text(formatMontant(facture.montant_ttc), BX + 90, y + 37, { width: BW - 98, align: 'right' })

    y += 60

    // ─────────────────────────────────────────────────────────────────────────
    // 5. CONDITIONS + SIGNATURE (y: 340-430)
    // ─────────────────────────────────────────────────────────────────────────

    doc.fillColor('#1E3A5F').font('Helvetica-Bold').fontSize(8)
       .text('CONDITIONS DE PAIEMENT', L, y)
    y += 12

    doc.fillColor('#475569').font('Helvetica').fontSize(9)
    if (facture.conditions_paiement) {
      doc.text(facture.conditions_paiement, L, y); y += 12
    }
    if (facture.mode_paiement) {
      doc.text(`Mode : ${facture.mode_paiement.toUpperCase()}`, L, y); y += 12
    }

    y += 10

    // Bloc signature à droite
    doc.fillColor('#334155').font('Helvetica').fontSize(9)
       .text('Signature et cachet :', R - 160, y)
    doc.moveTo(R - 160, y + 35).lineTo(R, y + 35).strokeColor('#94A3B8').lineWidth(0.5).stroke()
    doc.fillColor('#94A3B8').fontSize(8)
       .text('Nom & Signature', R - 160, y + 38)

    y += 50

    // ─────────────────────────────────────────────────────────────────────────
    // 6. PIED DE PAGE (positionné à y=800 pour A4)
    // ─────────────────────────────────────────────────────────────────────────

    doc.moveTo(L, 800).lineTo(R, 800).strokeColor('#E2E8F0').lineWidth(0.5).stroke()
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5)
       .text('TransiFlow - Systeme de Gestion de Transport', L, 806, {
          width: W, align: 'center',
        })

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
