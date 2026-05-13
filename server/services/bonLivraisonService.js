// Service de génération de bon de livraison PDF avec PDFKit
const PDFDocument = require('pdfkit');

/**
 * Génère un bon de livraison PDF et l'envoie directement en réponse HTTP.
 * @param {Object} mission - Données de la mission avec camion et chauffeur
 * @param {Object} res     - Objet response Express
 */
async function genererBonLivraison(mission, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // En-têtes HTTP pour déclencher le téléchargement dans le navigateur
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=bon-livraison-${mission.id}.pdf`
  );
  doc.pipe(res);

  const BLEU  = '#1e3a5f';
  const GRIS  = '#6b7280';
  const LIGNE = '#e5e7eb';

  // ── En-tête ──────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 90).fill(BLEU);

  doc.fillColor('white')
     .fontSize(22).font('Helvetica-Bold')
     .text('BON DE LIVRAISON', 50, 25, { align: 'left' });

  doc.fontSize(11).font('Helvetica')
     .text(`N° BL-${String(mission.id).padStart(5, '0')}`, 50, 52);

  doc.fontSize(10)
     .text(
       `Émis le ${new Date().toLocaleDateString('fr-FR')}`,
       0, 52, { align: 'right', width: doc.page.width - 50 }
     );

  doc.fontSize(9).fillColor('rgba(255,255,255,0.7)')
     .text('FlotteCamion — Gestion de flotte Madagascar', 50, 70);

  // ── Corps ─────────────────────────────────────────────────────────────
  doc.fillColor('#111827').y = 110;

  const sectionTitre = (texte) => {
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(BLEU)
       .text(texte.toUpperCase(), { characterSpacing: 1 });
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor(BLEU).lineWidth(1).stroke();
    doc.moveDown(0.4);
  };

  const ligne = (label, valeur) => {
    const y = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(GRIS)
       .text(label, 50, y, { width: 160, continued: false });
    doc.fontSize(10).font('Helvetica').fillColor('#111827')
       .text(valeur || '—', 215, y);
    doc.moveDown(0.25);
  };

  // ── Informations mission ──
  sectionTitre('Informations mission');
  ligne('Référence mission :', mission.titre);
  ligne('Date de départ :',    new Date(mission.date_depart).toLocaleDateString('fr-FR'));
  ligne('Retour prévu :',      new Date(mission.date_retour_prevue).toLocaleDateString('fr-FR'));
  if (mission.poids_charge) ligne('Poids chargé :', `${mission.poids_charge} tonnes`);

  // ── Trajet ──
  sectionTitre('Trajet');
  ligne('Lieu de départ :',     mission.lieu_depart);
  ligne('Destination :',        mission.lieu_destination);
  ligne('Distance :',           `${mission.distance_km} km`);

  // ── Camion ──
  sectionTitre('Véhicule');
  ligne('Immatriculation :',    mission.immatriculation);
  ligne('Marque / Modèle :',   `${mission.marque} ${mission.modele}`);

  // ── Chauffeur ──
  sectionTitre('Chauffeur');
  ligne('Nom complet :',        `${mission.chauffeur_prenom} ${mission.chauffeur_nom}`);
  if (mission.numero_permis) ligne('N° Permis :', mission.numero_permis);

  // ── Client ──
  if (mission.client_nom) {
    sectionTitre('Client');
    ligne('Client :',           mission.client_nom);
    if (mission.client_contact) ligne('Contact :',  mission.client_contact);
    if (mission.client_tel)     ligne('Téléphone :', mission.client_tel);
  }

  // ── Marchandises ──
  sectionTitre('Marchandises transportées');
  doc.fontSize(10).font('Helvetica').fillColor('#111827')
     .text(mission.notes || 'Non spécifiées', { width: 495 });

  // ── Zone signatures ──
  doc.moveDown(2);
  const ySign = Math.max(doc.y, 580);

  doc.moveTo(50, ySign).lineTo(545, ySign).strokeColor(LIGNE).lineWidth(0.5).stroke();
  doc.moveDown(0.8);

  doc.fontSize(10).font('Helvetica-Bold').fillColor(GRIS);
  doc.text('Signature expéditeur',  50,  ySign + 15, { width: 200, align: 'center' });
  doc.text('Signature destinataire', 295, ySign + 15, { width: 200, align: 'center' });

  doc.fontSize(9).font('Helvetica').fillColor('#9ca3af');
  doc.text('Nom : _______________________', 50,  ySign + 35, { width: 200 });
  doc.text('Nom : _______________________', 295, ySign + 35, { width: 200 });
  doc.text('Date : ____/____/________',    50,  ySign + 55, { width: 200 });
  doc.text('Date : ____/____/________',    295, ySign + 55, { width: 200 });

  // Zone signature
  doc.rect(50,  ySign + 70, 200, 60).strokeColor(LIGNE).lineWidth(0.5).stroke();
  doc.rect(295, ySign + 70, 200, 60).strokeColor(LIGNE).lineWidth(0.5).stroke();

  // ── Pied de page ──
  doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
     .text(
       'FlotteCamion — Système de gestion de flotte — Madagascar',
       50, doc.page.height - 30,
       { align: 'center', width: doc.page.width - 100 }
     );

  doc.end();
}

module.exports = { genererBonLivraison };
