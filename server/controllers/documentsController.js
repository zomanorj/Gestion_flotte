// Contrôleur documents — gestion des documents administratifs des véhicules
const db = require('../config/db');

// Calcule le statut d'un document à partir de jours_restants (valeur SQL DATEDIFF)
const statutDepuisJours = (jours) => {
  if (jours < 0)  return 'expire';
  if (jours <= 30) return 'expire_bientot';
  return 'valide';
};

/**
 * GET /api/documents/alertes
 * Retourne les documents expirés ou expirant dans les 30 prochains jours,
 * triés par urgence (les plus proches de l'expiration en premier).
 */
const getAlertes = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.*, v.immatriculation, v.marque, v.modele,
        DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
      FROM documents d
      JOIN vehicules v ON d.vehicule_id = v.id
      WHERE d.date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY d.date_expiration ASC
    `);

    const alertes = rows.map((r) => ({
      ...r,
      jours_restants: parseInt(r.jours_restants),
      statut: statutDepuisJours(parseInt(r.jours_restants))
    }));

    return res.json(alertes);
  } catch (err) {
    console.error('Erreur getAlertes documents :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/documents
 * Retourne tous les documents avec filtres optionnels :
 * ?vehicule_id=1&type=assurance
 */
const getAll = async (req, res) => {
  try {
    const { vehicule_id, type } = req.query;
    let query = `
      SELECT d.*, v.immatriculation, v.marque, v.modele,
        DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
      FROM documents d
      JOIN vehicules v ON d.vehicule_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (vehicule_id) { query += ' AND d.vehicule_id = ?'; params.push(vehicule_id); }
    if (type)        { query += ' AND d.type = ?';        params.push(type); }

    query += ' ORDER BY d.date_expiration ASC';
    const [rows] = await db.query(query, params);

    const docs = rows.map((r) => ({
      ...r,
      jours_restants: parseInt(r.jours_restants),
      statut: statutDepuisJours(parseInt(r.jours_restants))
    }));

    return res.json(docs);
  } catch (err) {
    console.error('Erreur getAll documents :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/documents
 * Crée un nouveau document pour un véhicule.
 */
const create = async (req, res) => {
  try {
    const { vehicule_id, type, numero, date_emission, date_expiration, fichier_nom, fichier_url, notes } = req.body;

    if (!vehicule_id || !type || !date_emission || !date_expiration) {
      return res.status(400).json({ message: 'Champs obligatoires : vehicule_id, type, date_emission, date_expiration' });
    }

    const [result] = await db.query(
      `INSERT INTO documents (vehicule_id, type, numero, date_emission, date_expiration, fichier_nom, fichier_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [vehicule_id, type, numero || null, date_emission, date_expiration,
       fichier_nom || null, fichier_url || null, notes || null]
    );

    const [nouveau] = await db.query(
      `SELECT d.*, v.immatriculation, v.marque, DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
       FROM documents d JOIN vehicules v ON d.vehicule_id = v.id WHERE d.id = ?`,
      [result.insertId]
    );

    const doc = nouveau[0];
    doc.jours_restants = parseInt(doc.jours_restants);
    doc.statut = statutDepuisJours(doc.jours_restants);

    return res.status(201).json(doc);
  } catch (err) {
    console.error('Erreur create document :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/documents/:id
 * Met à jour un document existant.
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicule_id, type, numero, date_emission, date_expiration, fichier_nom, fichier_url, notes } = req.body;

    const [existing] = await db.query('SELECT id FROM documents WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Document introuvable' });

    await db.query(
      `UPDATE documents
       SET vehicule_id=?, type=?, numero=?, date_emission=?, date_expiration=?, fichier_nom=?, fichier_url=?, notes=?
       WHERE id=?`,
      [vehicule_id, type, numero || null, date_emission, date_expiration,
       fichier_nom || null, fichier_url || null, notes || null, id]
    );

    const [mis_a_jour] = await db.query(
      `SELECT d.*, v.immatriculation, v.marque, DATEDIFF(d.date_expiration, CURDATE()) AS jours_restants
       FROM documents d JOIN vehicules v ON d.vehicule_id = v.id WHERE d.id = ?`,
      [id]
    );

    const doc = mis_a_jour[0];
    doc.jours_restants = parseInt(doc.jours_restants);
    doc.statut = statutDepuisJours(doc.jours_restants);

    return res.json(doc);
  } catch (err) {
    console.error('Erreur update document :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/documents/:id
 * Supprime un document.
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM documents WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Document introuvable' });

    await db.query('DELETE FROM documents WHERE id = ?', [id]);
    return res.json({ message: 'Document supprimé' });
  } catch (err) {
    console.error('Erreur remove document :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getAll, getAlertes, create, update, remove };
