// Contrôleur paie — bulletins et masse salariale
const db          = require('../config/db');
const PDFDocument = require('pdfkit');
const { calculerFichePaie, resumeMensuel } = require('../services/paieService');

const MOIS_FR = ['', 'Janvier','Février','Mars','Avril','Mai','Juin',
                 'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

/**
 * GET /api/paie/:annee/:mois
 * Résumé de la paie mensuelle pour tous les chauffeurs.
 */
const getMensuelle = async (req, res) => {
  try {
    const { annee, mois } = req.params;
    if (!annee || !mois || mois < 1 || mois > 12) {
      return res.status(400).json({ message: 'Année et mois invalides' });
    }

    const fiches = await resumeMensuel(parseInt(annee), parseInt(mois));

    const masse_salariale = fiches.reduce((s, f) => s + f.net_a_payer, 0);
    const nb_missions     = fiches.reduce((s, f) => s + f.nb_missions, 0);

    return res.json({ fiches, masse_salariale, nb_missions, annee: parseInt(annee), mois: parseInt(mois) });
  } catch (err) {
    console.error('Erreur getMensuelle paie :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/paie/chauffeur/:id/:annee/:mois
 * Fiche de paie détaillée d'un chauffeur.
 */
const getChauffeurMensuel = async (req, res) => {
  try {
    const { id, annee, mois } = req.params;
    const fiche = await calculerFichePaie(parseInt(id), parseInt(annee), parseInt(mois));
    return res.json(fiche);
  } catch (err) {
    console.error('Erreur getChauffeurMensuel :', err);
    if (err.message === 'Chauffeur introuvable') return res.status(404).json({ message: err.message });
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PATCH /api/paie/chauffeur/:id/salaire
 * Met à jour le salaire de base et la prime mission d'un chauffeur.
 */
const updateSalaire = async (req, res) => {
  try {
    const { id } = req.params;
    const { salaire_base, prime_mission } = req.body;

    if (salaire_base === undefined && prime_mission === undefined) {
      return res.status(400).json({ message: 'Au moins salaire_base ou prime_mission requis' });
    }

    const [existant] = await db.query('SELECT id FROM chauffeurs WHERE id=?', [id]);
    if (existant.length === 0) return res.status(404).json({ message: 'Chauffeur introuvable' });

    const updates = [];
    const params  = [];
    if (salaire_base  !== undefined) { updates.push('salaire_base=?');  params.push(salaire_base); }
    if (prime_mission !== undefined) { updates.push('prime_mission=?'); params.push(prime_mission); }
    params.push(id);

    await db.query(`UPDATE chauffeurs SET ${updates.join(',')} WHERE id=?`, params);

    const [mis_a_jour] = await db.query(
      'SELECT id, nom, prenom, salaire_base, prime_mission FROM chauffeurs WHERE id=?', [id]
    );
    return res.json(mis_a_jour[0]);
  } catch (err) {
    console.error('Erreur updateSalaire :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/paie/chauffeur/:id/:annee/:mois/pdf
 * Génère un bulletin de paie PDF.
 */
const getBulletinPDF = async (req, res) => {
  try {
    const { id, annee, mois } = req.params;
    const fiche = await calculerFichePaie(parseInt(id), parseInt(annee), parseInt(mois));
    const { chauffeur, periode, missions, calcul } = fiche;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const nomFichier = `bulletin_${chauffeur.nom}_${periode.mois}_${periode.annee}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
    doc.pipe(res);

    // En-tête
    doc.fillColor('#1e3a8a').rect(50, 50, 495, 60).fill();
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
       .text('BULLETIN DE PAIE', 70, 65);
    doc.fontSize(11).font('Helvetica')
       .text(`Période : ${MOIS_FR[periode.mois]} ${periode.annee}`, 70, 88);

    // Infos chauffeur
    doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold')
       .text('Informations du chauffeur', 50, 135);
    doc.moveTo(50, 152).lineTo(545, 152).strokeColor('#e5e7eb').lineWidth(1).stroke();

    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    const col1 = 50, col2 = 300;
    let y = 162;
    doc.text(`Nom complet :`,       col1, y).font('Helvetica-Bold').text(`${chauffeur.prenom} ${chauffeur.nom}`, col1 + 110, y);
    doc.font('Helvetica').text(`N° Permis :`,   col2, y).font('Helvetica-Bold').text(chauffeur.numero_permis, col2 + 90, y);
    y += 20;
    doc.font('Helvetica').text(`Catégorie :`,   col1, y).font('Helvetica-Bold').text(chauffeur.categorie_permis, col1 + 110, y);
    doc.font('Helvetica').text(`Téléphone :`,   col2, y).font('Helvetica-Bold').text(chauffeur.telephone || '—', col2 + 90, y);

    // Tableau des missions
    y += 35;
    doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold').text('Missions effectuées', 50, y);
    y += 20;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    y += 8;

    // En-tête tableau
    doc.fillColor('#f3f4f6').rect(50, y, 495, 18).fill();
    doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold');
    doc.text('Mission', 55, y + 4);
    doc.text('Trajet', 195, y + 4);
    doc.text('Distance', 360, y + 4);
    doc.text('Date retour', 430, y + 4);
    y += 22;

    doc.font('Helvetica').fontSize(9).fillColor('#374151');
    missions.forEach((m, i) => {
      if (i % 2 === 0) {
        doc.fillColor('#f9fafb').rect(50, y - 3, 495, 16).fill();
      }
      doc.fillColor('#374151');
      const titre = m.titre.length > 25 ? m.titre.slice(0, 25) + '…' : m.titre;
      const trajet = `${m.lieu_depart} → ${m.lieu_destination}`;
      const trajetCourt = trajet.length > 30 ? trajet.slice(0, 30) + '…' : trajet;
      doc.text(titre, 55, y);
      doc.text(trajetCourt, 195, y);
      doc.text(`${Math.round(m.distance_km)} km`, 360, y);
      doc.text(m.date_retour_reelle ? new Date(m.date_retour_reelle).toLocaleDateString('fr-FR') : '—', 430, y);
      y += 16;
    });

    if (missions.length === 0) {
      doc.fillColor('#9ca3af').text('Aucune mission terminée ce mois', 55, y);
      y += 16;
    }

    // Récapitulatif salarial
    y += 20;
    doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold').text('Récapitulatif salarial', 50, y);
    y += 20;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    y += 10;

    const ligneSalaire = (label, montant, bold = false, couleur = '#374151') => {
      doc.fillColor(couleur).fontSize(10)
         .font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(label, 55, y)
         .text(`${montant.toLocaleString('fr-FR')} Ar`, 400, y, { width: 140, align: 'right' });
      y += 18;
    };

    ligneSalaire('Salaire de base',            calcul.salaire_base);
    ligneSalaire(`Primes missions (${calcul.nb_missions} × ${calcul.total_primes / (calcul.nb_missions || 1)} Ar)`, calcul.total_primes);
    if (calcul.km_bonus > 0) ligneSalaire(`Bonus kilométrage (${calcul.total_km} km)`, calcul.km_bonus);

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    y += 6;
    ligneSalaire('Total brut', calcul.total_brut, true);
    ligneSalaire('CNAPS salarié (1%)', -calcul.cnaps, false, '#dc2626');

    doc.fillColor('#1e3a8a').rect(50, y + 2, 495, 24).fill();
    doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
       .text('NET À PAYER', 55, y + 7)
       .text(`${calcul.net_a_payer.toLocaleString('fr-FR')} Ar`, 400, y + 7, { width: 140, align: 'right' });
    y += 40;

    // Pied de page
    doc.fillColor('#9ca3af').fontSize(8).font('Helvetica')
       .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} — CamionApp ERP Madagascar`, 50, y + 20, { align: 'center', width: 495 });

    doc.end();
  } catch (err) {
    console.error('Erreur getBulletinPDF :', err);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur génération PDF' });
  }
};

module.exports = { getMensuelle, getChauffeurMensuel, updateSalaire, getBulletinPDF };
