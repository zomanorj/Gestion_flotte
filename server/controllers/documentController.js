/**
 * documentController.js
 * Contrôleur HTTP pour la génération de documents PDF — TransiFlow.
 *
 * Ce module génère des documents PDF professionnels :
 *   - Bons de livraison pour les missions
 *   - Rapports récapitulatifs de missions
 *
 * Fonctions exportées :
 *   - generateBonLivraison(req, res)  → PDF bon de livraison d'une mission
 *   - generateRapportMissions(req, res) → PDF rapport de missions
 */

const PDFDocument = require('pdfkit')
const missionModel = require('../models/missionModel')

// ─────────────────────────────────────────────────────────────────────────────
// Constantes et utilitaires
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formate une date en français
 */
function formaterDateFR(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Formate une heure
 */
function formaterHeure(heureStr) {
  if (!heureStr) return '—'
  return heureStr.substring(0, 5)
}

/**
 * Génère un numéro de bon de livraison
 */
function genererNumeroBL(missionId, annee) {
  return `BL-${annee}-${String(missionId).padStart(4, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// generateBonLivraison
// Génère un PDF bon de livraison pour une mission spécifique.
// ─────────────────────────────────────────────────────────────────────────────

async function generateBonLivraison(req, res) {
  try {
    const { missionId } = req.params

    // Validation
    if (!missionId || isNaN(parseInt(missionId, 10))) {
      return res.status(400).json({
        succes: false,
        message: 'ID de la mission invalide',
      })
    }

    const mission = await missionModel.findById(parseInt(missionId, 10))

    if (!mission) {
      return res.status(404).json({
        succes: false,
        message: 'Mission introuvable',
      })
    }

    // Vérifier que la mission n'est pas un brouillon ou annulée
    if (mission.statut === 'brouillon' || mission.statut === 'annulee') {
      return res.status(400).json({
        succes: false,
        message: 'Impossible de générer un bon de livraison pour une mission ' + mission.statut,
      })
    }

    // ── Configuration du PDF ──
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50,
      },
    })

    // Headers pour le téléchargement
    const filename = `BL-transiflow-${missionId}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-cache')

    // Stream vers la réponse
    doc.pipe(res)

    // ── En-tête avec logo ──
    // Cadre supérieur
    doc.rect(50, 50, 495, 80).stroke('#1e3a5f')

    // Titre
    doc.fontSize(24).font('Helvetica-Bold').text('BON DE LIVRAISON', 70, 70, {
      align: 'center',
      color: '#1e3a5f',
    })

    // Sous-titre
    doc.fontSize(10).font('Helvetica').text('TransiFlow', 70, 100, {
      align: 'center',
      color: '#64748b',
    })

    // ── Informations du bon ──
    const annee = new Date(mission.date_mission).getFullYear()
    const numeroBL = genererNumeroBL(mission.id, annee)

    doc.fontSize(11).font('Helvetica-Bold').text(`N° ${numeroBL}`, 70, 145, {
      color: '#1e3a5f',
    })

    doc.fontSize(10).font('Helvetica').text(
      `Date : ${formaterDateFR(mission.date_mission)}`,
      400,
      145,
      { align: 'right' }
    )

    // ── Section : Informations de la mission ──
    doc.fontSize(12).font('Helvetica-Bold').text('INFORMATIONS DE LA MISSION', 70, 175, {
      color: '#1e3a5f',
    })

    // Ligne de séparation
    doc.moveTo(70, 192).lineTo(545, 192).stroke('#e2e8f0')

    const missionY = 200
    doc.fontSize(10).font('Helvetica')

    doc.text('Départ :', 70, missionY)
    doc.font('Helvetica-Bold').text(mission.lieu_depart, 150, missionY)

    doc.font('Helvetica').text('Arrivée :', 70, missionY + 18)
    doc.font('Helvetica-Bold').text(mission.lieu_arrivee, 150, missionY + 18)

    doc.font('Helvetica').text('Date :', 70, missionY + 36)
    doc.font('Helvetica-Bold').text(formaterDateFR(mission.date_mission), 150, missionY + 36)

    doc.font('Helvetica').text('Heure départ :', 70, missionY + 54)
    doc.font('Helvetica-Bold').text(formaterHeure(mission.heure_depart), 150, missionY + 54)

    if (mission.distance_km) {
      doc.font('Helvetica').text('Distance :', 350, missionY)
      doc.font('Helvetica-Bold').text(`${mission.distance_km} km`, 420, missionY)
    }

    // ── Section : Véhicule ──
    const vehicleY = missionY + 85
    doc.fontSize(12).font('Helvetica-Bold').text('VÉHICULE', 70, vehicleY, {
      color: '#1e3a5f',
    })

    doc.moveTo(70, vehicleY + 17).lineTo(545, vehicleY + 17).stroke('#e2e8f0')

    doc.fontSize(10).font('Helvetica')
    doc.text('Immatriculation :', 70, vehicleY + 28)
    doc.font('Helvetica-Bold').text(mission.vehicle?.immatriculation || '—', 180, vehicleY + 28)

    doc.font('Helvetica').text('Type :', 70, vehicleY + 46)
    doc.font('Helvetica-Bold').text(mission.vehicle?.type || '—', 180, vehicleY + 46)

    doc.font('Helvetica').text('Capacité :', 350, vehicleY + 28)
    doc.font('Helvetica-Bold').text(
      mission.vehicle?.capacite ? `${mission.vehicle.capacite} ${mission.vehicle.type === 'citerne' ? 'tonnes' : 'places'}` : '—',
      420,
      vehicleY + 28
    )

    // ── Section : Chauffeur ──
    const driverY = vehicleY + 85
    doc.fontSize(12).font('Helvetica-Bold').text('CHAUFFEUR', 70, driverY, {
      color: '#1e3a5f',
    })

    doc.moveTo(70, driverY + 17).lineTo(545, driverY + 17).stroke('#e2e8f0')

    doc.fontSize(10).font('Helvetica')
    doc.text('Nom :', 70, driverY + 28)
    doc.font('Helvetica-Bold').text(
      mission.driver ? `${mission.driver.prenom} ${mission.driver.nom.toUpperCase()}` : '—',
      180,
      driverY + 28
    )

    doc.font('Helvetica').text('Permis n° :', 70, driverY + 46)
    doc.font('Helvetica-Bold').text(mission.driver?.numero_permis || '—', 180, driverY + 46)

    // ── Section : Chargement ──
    const chargementY = driverY + 80
    doc.fontSize(12).font('Helvetica-Bold').text('CHARGEMENT', 70, chargementY, {
      color: '#1e3a5f',
    })

    doc.moveTo(70, chargementY + 17).lineTo(545, chargementY + 17).stroke('#e2e8f0')

    doc.fontSize(10).font('Helvetica')
    doc.text('Nature :', 70, chargementY + 28)
    doc.font('Helvetica-Bold').text(mission.chargement || '—', 180, chargementY + 28)

    doc.font('Helvetica').text('Poids :', 70, chargementY + 46)
    doc.font('Helvetica-Bold').text(mission.poids_tonne ? `${mission.poids_tonne} tonnes` : '—', 180, chargementY + 46)

    // ── Section : Notes (si présentes) ──
    if (mission.notes) {
      const notesY = chargementY + 80
      doc.fontSize(12).font('Helvetica-Bold').text('NOTES', 70, notesY, {
        color: '#1e3a5f',
      })

      doc.moveTo(70, notesY + 17).lineTo(545, notesY + 17).stroke('#e2e8f0')

      doc.fontSize(10).font('Helvetica').text(mission.notes, 70, notesY + 28, {
        width: 475,
        align: 'left',
      })
    }

    // ── Section : Signatures ──
    const signatureY = chargementY + (mission.notes ? 130 : 100)

    // Ligne de séparation
    doc.moveTo(70, signatureY).lineTo(545, signatureY).stroke('#e2e8f0')

    // Signature expéditeur
    doc.fontSize(10).font('Helvetica').text('Signature Expéditeur :', 70, signatureY + 15)
    doc.rect(70, signatureY + 35, 200, 60).stroke('#cbd5e1')

    // Signature chauffeur
    doc.fontSize(10).font('Helvetica').text('Signature Chauffeur :', 340, signatureY + 15)
    doc.rect(340, signatureY + 35, 200, 60).stroke('#cbd5e1')

    // ── Pied de page ──
    const pageHeight = doc.page.height
    doc.fontSize(8).font('Helvetica').text(
      `Document généré le ${new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      70,
      pageHeight - 40,
      { align: 'center', color: '#94a3b8' }
    )

    doc.text(
      'TransiFlow - Système de Gestion de Transport',
      70,
      pageHeight - 25,
      { align: 'center', color: '#94a3b8' }
    )

    // ── Finalisation ──
    doc.end()

  } catch (erreur) {
    console.error('❌ documentController.generateBonLivraison :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la génération du bon de livraison',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateRapportMissions
// Génère un PDF rapport récapitulatif des missions sur une période.
// ─────────────────────────────────────────────────────────────────────────────

async function generateRapportMissions(req, res) {
  try {
    const { date_debut, date_fin, statut } = req.query

    // Validation des dates
    if (!date_debut || !date_fin) {
      return res.status(400).json({
        succes: false,
        message: 'Les dates de début et de fin are obligatoires',
      })
    }

    if (new Date(date_fin) < new Date(date_debut)) {
      return res.status(400).json({
        succes: false,
        message: 'La date de fin doit être postérieure à la date de début',
      })
    }

    // Récupérer les missions avec filtres
    const resultats = await missionModel.findAll({
      page: 1,
      limit: 100,
      statut: statut || '',
      date: '',
    })

    // Filtrer par date manuellement (car findAll ne supporte pas les plages)
    let missions = resultats.missions.filter(m => {
      const dateMission = new Date(m.date_mission)
      return dateMission >= new Date(date_debut) && dateMission <= new Date(date_fin)
    })

    // Filtrage additionnel par statut si spécifié
    if (statut && statut !== 'tous') {
      missions = missions.filter(m => m.statut === statut)
    }

    // ── Configuration du PDF ──
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 40,
        right: 40,
      },
    })

    // Headers pour le téléchargement
    const filename = `rapport-missions-${date_debut}-${date_fin}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-cache')

    doc.pipe(res)

    // ── En-tête ──
    doc.fontSize(20).font('Helvetica-Bold').text('RAPPORT DE MISSIONS', 60, 60, {
      color: '#1e3a5f',
    })

    doc.fontSize(10).font('Helvetica').text('TransiFlow', 60, 85, {
      color: '#64748b',
    })

    // Période
    doc.fontSize(11).font('Helvetica').text(
      `Période : ${formaterDateFR(date_debut)} au ${formaterDateFR(date_fin)}`,
      60,
      110
    )

    if (statut && statut !== 'tous') {
      doc.text(`Statut : ${statut}`, 60, 125)
    }

    // ── Tableau des missions ──
    let tableauY = 155

    // En-têtes du tableau
    doc.fontSize(9).font('Helvetica-Bold').text('Réf', 60, tableauY, { width: 60 })
    doc.text('Date', 120, tableauY, { width: 80 })
    doc.text('Trajet', 200, tableauY, { width: 180 })
    doc.text('Véhicule', 380, tableauY, { width: 80 })
    doc.text('Chauffeur', 460, tableauY, { width: 100 })
    doc.text('Statut', 560, tableauY, { width: 60 })

    // Ligne sous les en-têtes
    doc.moveTo(50, tableauY + 15).lineTo(630, tableauY + 15).stroke('#1e3a5f')

    tableauY += 25

    // Lignes du tableau
    doc.fontSize(8).font('Helvetica')

    missions.forEach((mission, index) => {
      // Alterner les couleurs de fond
      if (index % 2 === 0) {
        doc.rect(50, tableauY - 5, 590, 18).fill('#f8fafc')
      }

      doc.text(`#${String(mission.id).padStart(4, '0')}`, 60, tableauY, { width: 60 })
      doc.text(formaterDateFR(mission.date_mission), 120, tableauY, { width: 80 })
      doc.text(`${mission.lieu_depart} → ${mission.lieu_arrivee}`, 200, tableauY, { width: 170 })
      doc.text(mission.vehicle?.immatriculation || '—', 380, tableauY, { width: 70 })
      doc.text(
        mission.driver ? `${mission.driver.prenom} ${mission.driver.nom}` : '—',
        460,
        tableauY,
        { width: 90 }
      )

      // Couleur du statut
      const couleursStatut = {
        brouillon: '#64748b',
        planifiee: '#3b82f6',
        en_cours: '#f97316',
        terminee: '#22c55e',
        annulee: '#ef4444',
      }

      doc.fillColor(couleursStatut[mission.statut] || '#000')
      doc.text(mission.statut, 560, tableauY, { width: 60 })
      doc.fillColor('#000')

      tableauY += 18

      // Nouvelle page si nécessaire
      if (tableauY > 750) {
        doc.addPage()
        tableauY = 60
      }
    })

    // ── Totaux ──
    tableauY += 20
    doc.moveTo(50, tableauY).lineTo(630, tableauY).stroke('#1e3a5f')
    tableauY += 15

    doc.fontSize(10).font('Helvetica-Bold').text(
      `Total : ${missions.length} mission${missions.length > 1 ? 's' : ''}`,
      60,
      tableauY
    )

    // ── Pied de page ──
    const pageHeight = doc.page.height
    doc.fontSize(8).font('Helvetica').text(
      `Rapport généré le ${new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      60,
      pageHeight - 30,
      { align: 'center', color: '#94a3b8' }
    )

    doc.end()

  } catch (erreur) {
    console.error('❌ documentController.generateRapportMissions :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la génération du rapport',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  generateBonLivraison,
  generateRapportMissions,
}