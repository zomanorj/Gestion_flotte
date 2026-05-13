// Contrôleur dépenses — suivi des dépenses opérationnelles par catégorie
const db = require('../config/db');

/**
 * GET /api/depenses
 * Retourne toutes les dépenses avec filtres optionnels :
 * ?vehicule_id=1&categorie=peage&debut=2025-01-01&fin=2025-12-31
 */
const getAll = async (req, res) => {
  try {
    const { vehicule_id, categorie, debut, fin } = req.query;
    let query = `
      SELECT d.*, v.immatriculation, v.marque, v.modele
      FROM depenses d
      JOIN vehicules v ON d.vehicule_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (vehicule_id) { query += ' AND d.vehicule_id = ?'; params.push(vehicule_id); }
    if (categorie)   { query += ' AND d.categorie = ?';   params.push(categorie); }
    if (debut)       { query += ' AND d.date_depense >= ?'; params.push(debut); }
    if (fin)         { query += ' AND d.date_depense <= ?'; params.push(fin); }

    query += ' ORDER BY d.date_depense DESC';
    const [rows] = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error('Erreur getAll dépenses :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/depenses/stats
 * Agrège les statistiques : totaux mois/année, répartition par catégorie et par véhicule,
 * et évolution mensuelle sur les 6 derniers mois.
 */
const getStats = async (req, res) => {
  try {
    // Totaux mois et année courants
    const [totaux] = await db.query(`
      SELECT
        IFNULL(SUM(CASE WHEN YEAR(date_depense) = YEAR(CURDATE())
                         AND MONTH(date_depense) = MONTH(CURDATE())
                    THEN montant ELSE 0 END), 0) AS totalMois,
        IFNULL(SUM(CASE WHEN YEAR(date_depense) = YEAR(CURDATE())
                    THEN montant ELSE 0 END), 0) AS totalAnnee,
        COUNT(*) AS nbDepenses
      FROM depenses
    `);

    // Répartition par catégorie (pour graphique Doughnut)
    const [parCategorie] = await db.query(`
      SELECT categorie, SUM(montant) AS total, COUNT(*) AS nb
      FROM depenses
      WHERE YEAR(date_depense) = YEAR(CURDATE())
      GROUP BY categorie
      ORDER BY total DESC
    `);

    // Répartition par véhicule
    const [parVehicule] = await db.query(`
      SELECT v.immatriculation, v.marque, SUM(d.montant) AS total
      FROM depenses d
      JOIN vehicules v ON d.vehicule_id = v.id
      WHERE YEAR(d.date_depense) = YEAR(CURDATE())
      GROUP BY d.vehicule_id, v.immatriculation, v.marque
      ORDER BY total DESC
    `);

    // Évolution mensuelle sur 6 mois (pour graphique Bar)
    const [evolutionMensuelle] = await db.query(`
      SELECT
        DATE_FORMAT(date_depense, '%Y-%m') AS mois,
        DATE_FORMAT(date_depense, '%b %Y') AS label,
        SUM(montant) AS total
      FROM depenses
      WHERE date_depense >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(date_depense, '%Y-%m')
      ORDER BY mois ASC
    `);

    return res.json({
      totalMois:         parseFloat(totaux[0].totalMois)    || 0,
      totalAnnee:        parseFloat(totaux[0].totalAnnee)   || 0,
      nbDepenses:        parseInt(totaux[0].nbDepenses)     || 0,
      parCategorie,
      parVehicule,
      evolutionMensuelle
    });
  } catch (err) {
    console.error('Erreur getStats dépenses :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/depenses
 * Enregistre une nouvelle dépense.
 */
const create = async (req, res) => {
  try {
    const { vehicule_id, mission_id, categorie, montant, date_depense, description, justificatif_url } = req.body;

    if (!vehicule_id || !categorie || !montant || !date_depense) {
      return res.status(400).json({ message: 'Champs obligatoires : vehicule_id, categorie, montant, date_depense' });
    }

    const [result] = await db.query(
      `INSERT INTO depenses (vehicule_id, mission_id, categorie, montant, date_depense, description, justificatif_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vehicule_id, mission_id || null, categorie, montant, date_depense,
       description || null, justificatif_url || null]
    );

    const [nouveau] = await db.query(
      `SELECT d.*, v.immatriculation, v.marque
       FROM depenses d JOIN vehicules v ON d.vehicule_id = v.id WHERE d.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(nouveau[0]);
  } catch (err) {
    console.error('Erreur create dépense :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/depenses/:id
 * Met à jour une dépense existante.
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicule_id, mission_id, categorie, montant, date_depense, description, justificatif_url } = req.body;

    const [existing] = await db.query('SELECT id FROM depenses WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Dépense introuvable' });

    await db.query(
      `UPDATE depenses
       SET vehicule_id=?, mission_id=?, categorie=?, montant=?, date_depense=?, description=?, justificatif_url=?
       WHERE id=?`,
      [vehicule_id, mission_id || null, categorie, montant, date_depense,
       description || null, justificatif_url || null, id]
    );

    const [mis_a_jour] = await db.query(
      `SELECT d.*, v.immatriculation, v.marque
       FROM depenses d JOIN vehicules v ON d.vehicule_id = v.id WHERE d.id = ?`,
      [id]
    );

    return res.json(mis_a_jour[0]);
  } catch (err) {
    console.error('Erreur update dépense :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/depenses/:id
 * Supprime une dépense.
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM depenses WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Dépense introuvable' });

    await db.query('DELETE FROM depenses WHERE id = ?', [id]);
    return res.json({ message: 'Dépense supprimée' });
  } catch (err) {
    console.error('Erreur remove dépense :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getAll, getStats, create, update, remove };
