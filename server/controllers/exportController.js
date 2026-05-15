/**
 * exportController.js
 * Contrôleur HTTP pour l'export de données en Excel — TransiFlow.
 *
 * Ce module génère des fichiers Excel (.xlsx) pour :
 *   - Les missions
 *   - Les véhicules
 *   - Les chauffeurs
 *
 * Utilise la bibliothèque ExcelJS pour créer des fichiers Excel stylisés.
 *
 * Fonctions exportées :
 *   - exportMissionsExcel(req, res)  → GET /api/export/missions
 *   - exportVehiculesExcel(req, res) → GET /api/export/vehicules
 *   - exportChauffeursExcel(req, res) → GET /api/export/chauffeurs
 */

const ExcelJS = require('exceljs')
const pool = require('../db/connection')

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de style pour les fichiers Excel
// ─────────────────────────────────────────────────────────────────────────────

const COULEURS_STATUT = {
  brouillon:   'E5E7EB', // gris
  planifiee:   '3B82F6', // bleu
  en_cours:    'F59E0B', // orange
  terminee:    '10B981', // vert
  annulee:     'EF4444', // rouge
}

const STYLE_EN_TETE = {
  font:      { bold: true, color: { argb: 'FFFFFFFF' } },
  fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
  alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
  border:    { bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } } },
}

const STYLE_CELLULE = {
  alignment: { vertical: 'middle', wrapText: true },
  border:    { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } },
}

const STYLE_LIGNE_ALTERNEE = {
  ...STYLE_CELLULE,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
}

// ─────────────────────────────────────────────────────────────────────────────
// exportMissionsExcel
// Génère un fichier Excel avec la liste des missions sur une période.
// Query params : date_debut, date_fin, statut (optionnel)
// ─────────────────────────────────────────────────────────────────────────────

async function exportMissionsExcel(req, res) {
  try {
    // ── Parsing des paramètres ──
    let date_debut = req.query.date_debut
    let date_fin = req.query.date_fin
    const statut = req.query.statut

    // Valeurs par défaut : 30 derniers jours
    if (!date_debut) {
      date_debut = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
    if (!date_fin) {
      date_fin = new Date().toISOString().split('T')[0]
    }

    // ── Récupération des missions ──
    let query = `
      SELECT 
        m.id,
        m.lieu_depart,
        m.lieu_arrivee,
        m.date_mission,
        m.heure_depart,
        m.heure_arrivee_prevue,
        m.chargement,
        m.poids_tonne,
        m.distance_km,
        m.statut,
        m.notes,
        v.immatriculation,
        d.nom as driver_nom,
        d.prenom as driver_prenom
      FROM missions m
      JOIN vehicles v ON m.vehicle_id = v.id
      JOIN drivers d ON m.driver_id = d.id
      WHERE m.date_mission BETWEEN $1 AND $2
    `
    const params = [date_debut, date_fin]

    if (statut) {
      query += ' AND m.statut = $3'
      params.push(statut)
    }

    query += ' ORDER BY m.date_mission DESC, m.id DESC'

    const result = await pool.query(query, params)
    const missions = result.rows

    // ── Calcul des totaux ──
    const totalMissions = missions.length
    const totalKm = missions.reduce((sum, m) => sum + (parseInt(m.distance_km) || 0), 0)
    const totalTonnes = missions.reduce((sum, m) => sum + (parseFloat(m.poids_tonne) || 0), 0)

    // ── Création du workbook ──
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'TransiFlow'
    workbook.created = new Date()

    // ══════════════════════════════════════════════════════════════════════════
    // Feuille 1 : Liste des missions
    // ══════════════════════════════════════════════════════════════════════════
    const sheetMissions = workbook.addWorksheet('Missions', {
      properties: { tabColor: { argb: 'FF1E40AF' } },
    })

    // Colonnes
    const colonnesMissions = [
      { header: 'Référence', key: 'reference', width: 12 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Heure départ', key: 'heure_depart', width: 14 },
      { header: 'Départ', key: 'depart', width: 20 },
      { header: 'Arrivée', key: 'arrivee', width: 20 },
      { header: 'Véhicule', key: 'vehicule', width: 14 },
      { header: 'Chauffeur', key: 'chauffeur', width: 22 },
      { header: 'Chargement', key: 'chargement', width: 25 },
      { header: 'Poids (T)', key: 'poids', width: 10 },
      { header: 'Distance (km)', key: 'distance', width: 14 },
      { header: 'Statut', key: 'statut', width: 12 },
    ]

    sheetMissions.columns = colonnesMissions

    // En-tête stylisé
    const ligneEnTete = sheetMissions.getRow(1)
    ligneEnTete.height = 25
    colonnesMissions.forEach((_, colIndex) => {
      const cellule = ligneEnTete.getCell(colIndex + 1)
      cellule.style = STYLE_EN_TETE
    })

    // Données
    missions.forEach((mission, index) => {
      const ligne = sheetMissions.getRow(index + 2)
      ligne.getCell(1).value = `#${String(mission.id).padStart(4, '0')}`
      ligne.getCell(2).value = new Date(mission.date_mission).toLocaleDateString('fr-FR')
      ligne.getCell(3).value = mission.heure_depart ? mission.heure_depart.substring(0, 5) : ''
      ligne.getCell(4).value = mission.lieu_depart
      ligne.getCell(5).value = mission.lieu_arrivee
      ligne.getCell(6).value = mission.immatriculation
      ligne.getCell(7).value = `${mission.driver_prenom} ${mission.driver_nom}`
      ligne.getCell(8).value = mission.chargement || ''
      ligne.getCell(9).value = mission.poids_tonne ? parseFloat(mission.poids_tonne).toFixed(2) : ''
      ligne.getCell(10).value = mission.distance_km || 0
      ligne.getCell(11).value = mission.statut

      // Style des cellules
      const estLigneAltermee = index % 2 === 1
      colonnesMissions.forEach((_, colIndex) => {
        const cellule = ligne.getCell(colIndex + 1)
        cellule.style = estLigneAltermee ? STYLE_LIGNE_ALTERNEE : STYLE_CELLULE
      })

      // Couleur du statut
      const statutCell = ligne.getCell(11)
      const couleurStatut = COULEURS_STATUT[mission.statut] || '9CA3AF'
      statutCell.style = {
        ...statutCell.style,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${couleurStatut}` } },
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
      }
    })

    // Ligne de totaux
    const ligneTotaux = sheetMissions.getRow(missions.length + 2)
    ligneTotaux.height = 20
    ligneTotaux.getCell(1).value = 'TOTAUX'
    ligneTotaux.getCell(1).font = { bold: true }
    ligneTotaux.getCell(2).value = totalMissions
    ligneTotaux.getCell(2).font = { bold: true }
    ligneTotaux.getCell(9).value = totalTonnes.toFixed(2)
    ligneTotaux.getCell(9).font = { bold: true }
    ligneTotaux.getCell(10).value = totalKm
    ligneTotaux.getCell(10).font = { bold: true }

    // ══════════════════════════════════════════════════════════════════════════
    // Feuille 2 : Résumé
    // ══════════════════════════════════════════════════════════════════════════
    const sheetResume = workbook.addWorksheet('Résumé', {
      properties: { tabColor: { argb: 'FF10B981' } },
    })

    // Titre
    sheetResume.mergeCells('A1:D1')
    const titreCell = sheetResume.getCell('A1')
    titreCell.value = `Rapport des missions du ${new Date(date_debut).toLocaleDateString('fr-FR')} au ${new Date(date_fin).toLocaleDateString('fr-FR')}`
    titreCell.style = {
      font: { bold: true, size: 16 },
      alignment: { vertical: 'middle', horizontal: 'center' },
    }
    sheetResume.getRow(1).height = 30

    // Stats globales
    const statsData = [
      ['Total missions', totalMissions],
      ['Total kilomètres', `${totalKm} km`],
      ['Total tonnes', `${totalTonnes.toFixed(2)} T`],
      ['', ''],
      ['Répartition par statut', ''],
    ]

    // Comptage par statut
    const statutsCount = {}
    missions.forEach(m => {
      statutsCount[m.statut] = (statutsCount[m.statut] || 0) + 1
    })
    Object.entries(statutsCount).forEach(([statut, count]) => {
      statsData.push([`  ${statut}`, count])
    })

    statsData.push(['', ''])
    statsData.push(['Top 5 trajets', ''])

    // Top trajets
    const trajetsCount = {}
    missions.forEach(m => {
      const trajet = `${m.lieu_depart} → ${m.lieu_arrivee}`
      trajetsCount[trajet] = (trajetsCount[trajet] || 0) + 1
    })
    const topTrajets = Object.entries(trajetsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    topTrajets.forEach(([trajet, count]) => {
      statsData.push([`  ${trajet}`, count])
    })

    // Écriture des données
    statsData.forEach((row, index) => {
      const ligne = sheetResume.getRow(index + 3)
      ligne.getCell(1).value = row[0]
      ligne.getCell(2).value = row[1]
      if (index === 0 || index === 3 || index === 6) {
        ligne.getCell(1).font = { bold: true }
      }
    })

    sheetResume.getColumn(1).width = 30
    sheetResume.getColumn(2).width = 15

    // ── Envoi du fichier ──
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="missions-${date_debut}-${date_fin}.xlsx"`
    )

    await workbook.xlsx.write(res)
    res.end()
  } catch (erreur) {
    console.error('❌ exportController.exportMissionsExcel :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la génération du fichier Excel',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportVehiculesExcel
// Génère un fichier Excel avec la liste complète des véhicules.
// ─────────────────────────────────────────────────────────────────────────────

async function exportVehiculesExcel(req, res) {
  try {
    // ── Récupération des véhicules ──
    const result = await pool.query(`
      SELECT 
        id,
        immatriculation,
        type,
        capacite,
        statut,
        kilometrage,
        date_assurance,
        date_visite_technique,
        notes,
        created_at
      FROM vehicles
      ORDER BY immatriculation ASC
    `)
    const vehicules = result.rows

    // ── Création du workbook ──
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'TransiFlow'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Véhicules', {
      properties: { tabColor: { argb: 'FF1E40AF' } },
    })

    // Colonnes
    const colonnes = [
      { header: 'Immatriculation', key: 'immatriculation', width: 16 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Capacité', key: 'capacite', width: 10 },
      { header: 'Statut', key: 'statut', width: 14 },
      { header: 'Kilométrage', key: 'kilometrage', width: 12 },
      { header: 'Date assurance', key: 'date_assurance', width: 16 },
      { header: 'Date visite', key: 'date_visite', width: 16 },
      { header: 'Notes', key: 'notes', width: 25 },
    ]

    sheet.columns = colonnes

    // En-tête stylisé
    const ligneEnTete = sheet.getRow(1)
    ligneEnTete.height = 25
    colonnes.forEach((_, colIndex) => {
      ligneEnTete.getCell(colIndex + 1).style = STYLE_EN_TETE
    })

    // Données
    const aujourdHui = new Date()
    vehicules.forEach((vehicule, index) => {
      const ligne = sheet.getRow(index + 2)
      ligne.getCell(1).value = vehicule.immatriculation
      ligne.getCell(2).value = vehicule.type
      ligne.getCell(3).value = vehicule.capacite
      ligne.getCell(4).value = vehicule.statut
      ligne.getCell(5).value = vehicule.kilometrage
      ligne.getCell(6).value = vehicule.date_assurance 
        ? new Date(vehicule.date_assurance).toLocaleDateString('fr-FR') 
        : ''
      ligne.getCell(7).value = vehicule.date_visite_technique 
        ? new Date(vehicule.date_visite_technique).toLocaleDateString('fr-FR') 
        : ''
      ligne.getCell(8).value = vehicule.notes || ''

      // Style des cellules
      const estLigneAltermee = index % 2 === 1
      colonnes.forEach((_, colIndex) => {
        const cellule = ligne.getCell(colIndex + 1)
        cellule.style = estLigneAltermee ? STYLE_LIGNE_ALTERNEE : STYLE_CELLULE
      })

      // Cellules date expirée en rouge clair
      const dateAssurance = vehicule.date_assurance ? new Date(vehicule.date_assurance) : null
      const dateVisite = vehicule.date_visite_technique ? new Date(vehicule.date_visite_technique) : null

      if (dateAssurance && dateAssurance <= aujourdHui) {
        ligne.getCell(6).style = {
          ...ligne.getCell(6).style,
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
          font: { color: { argb: 'FFDC2626' } },
        }
      }
      if (dateVisite && dateVisite <= aujourdHui) {
        ligne.getCell(7).style = {
          ...ligne.getCell(7).style,
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
          font: { color: { argb: 'FFDC2626' } },
        }
      }
    })

    // ── Envoi du fichier ──
    const dateAujourdhui = new Date().toISOString().split('T')[0]
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vehicules-${dateAujourdhui}.xlsx"`
    )

    await workbook.xlsx.write(res)
    res.end()
  } catch (erreur) {
    console.error('❌ exportController.exportVehiculesExcel :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la génération du fichier Excel',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportChauffeursExcel
// Génère un fichier Excel avec la liste complète des chauffeurs.
// ─────────────────────────────────────────────────────────────────────────────

async function exportChauffeursExcel(req, res) {
  try {
    // ── Récupération des chauffeurs ──
    const result = await pool.query(`
      SELECT 
        id,
        nom,
        prenom,
        telephone,
        numero_permis,
        date_expiration_permis,
        statut,
        date_embauche,
        notes
      FROM drivers
      ORDER BY nom ASC, prenom ASC
    `)
    const chauffeurs = result.rows

    // ── Création du workbook ──
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'TransiFlow'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Chauffeurs', {
      properties: { tabColor: { argb: 'FF10B981' } },
    })

    // Colonnes
    const colonnes = [
      { header: 'Nom', key: 'nom', width: 18 },
      { header: 'Prénom', key: 'prenom', width: 16 },
      { header: 'Téléphone', key: 'telephone', width: 14 },
      { header: 'N° Permis', key: 'numero_permis', width: 16 },
      { header: 'Expiration permis', key: 'date_expiration_permis', width: 18 },
      { header: 'Statut', key: 'statut', width: 12 },
      { header: 'Date embauche', key: 'date_embauche', width: 16 },
      { header: 'Notes', key: 'notes', width: 25 },
    ]

    sheet.columns = colonnes

    // En-tête stylisé
    const ligneEnTete = sheet.getRow(1)
    ligneEnTete.height = 25
    colonnes.forEach((_, colIndex) => {
      ligneEnTete.getCell(colIndex + 1).style = STYLE_EN_TETE
    })

    // Données
    const aujourdHui = new Date()
    chauffeurs.forEach((chauffeur, index) => {
      const ligne = sheet.getRow(index + 2)
      ligne.getCell(1).value = chauffeur.nom
      ligne.getCell(2).value = chauffeur.prenom
      ligne.getCell(3).value = chauffeur.telephone || ''
      ligne.getCell(4).value = chauffeur.numero_permis
      ligne.getCell(5).value = chauffeur.date_expiration_permis 
        ? new Date(chauffeur.date_expiration_permis).toLocaleDateString('fr-FR') 
        : ''
      ligne.getCell(6).value = chauffeur.statut
      ligne.getCell(7).value = chauffeur.date_embauche 
        ? new Date(chauffeur.date_embauche).toLocaleDateString('fr-FR') 
        : ''
      ligne.getCell(8).value = chauffeur.notes || ''

      // Style des cellules
      const estLigneAltermee = index % 2 === 1
      colonnes.forEach((_, colIndex) => {
        const cellule = ligne.getCell(colIndex + 1)
        cellule.style = estLigneAltermee ? STYLE_LIGNE_ALTERNEE : STYLE_CELLULE
      })

      // Permis expiré en rouge clair
      const dateExpiration = chauffeur.date_expiration_permis 
        ? new Date(chauffeur.date_expiration_permis) 
        : null
      if (dateExpiration && dateExpiration <= aujourdHui) {
        ligne.getCell(5).style = {
          ...ligne.getCell(5).style,
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
          font: { color: { argb: 'FFDC2626' } },
        }
      }
    })

    // ── Envoi du fichier ──
    const dateAujourdhui = new Date().toISOString().split('T')[0]
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="chauffeurs-${dateAujourdhui}.xlsx"`
    )

    await workbook.xlsx.write(res)
    res.end()
  } catch (erreur) {
    console.error('❌ exportController.exportChauffeursExcel :', erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la génération du fichier Excel',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export des fonctions
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  exportMissionsExcel,
  exportVehiculesExcel,
  exportChauffeursExcel,
}