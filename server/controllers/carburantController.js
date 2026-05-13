// Contrôleur carburant — suivi des pleins et statistiques de consommation
const db = require('../config/db');

/**
 * GET /api/carburant
 * Retourne tous les pleins avec filtres optionnels :
 * ?vehicule_id=1&debut=2025-01-01&fin=2025-12-31
 */
const getAll = async (req, res) => {
  try {
    const { vehicule_id, debut, fin } = req.query;
    let query = `
      SELECT c.*, v.immatriculation, v.marque, v.modele
      FROM carburant c
      JOIN vehicules v ON c.vehicule_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (vehicule_id) { query += ' AND c.vehicule_id = ?'; params.push(vehicule_id); }
    if (debut)       { query += ' AND c.date_plein >= ?'; params.push(debut); }
    if (fin)         { query += ' AND c.date_plein <= ?'; params.push(fin); }

    query += ' ORDER BY c.date_plein DESC';
    const [rows] = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error('Erreur getAll carburant :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/carburant/stats
 * Agrège les statistiques de consommation : totaux, répartition par véhicule,
 * et évolution mensuelle sur les 6 derniers mois.
 */
const getStats = async (req, res) => {
  try {
    // Totaux globaux
    const [totaux] = await db.query(`
      SELECT
        IFNULL(SUM(litres), 0)               AS totalLitres,
        IFNULL(SUM(cout_total), 0)            AS coutTotal,
        IFNULL(AVG(consommation_reelle), 0)   AS consommationMoyenne,
        IFNULL(SUM(cout_total) / NULLIF(MAX(kilometrage_au_plein), 0), 0) AS coutParKm
      FROM carburant
    `);

    // Totaux du mois courant
    const [moisActuel] = await db.query(`
      SELECT IFNULL(SUM(cout_total), 0) AS coutMois
      FROM carburant
      WHERE YEAR(date_plein) = YEAR(CURDATE())
        AND MONTH(date_plein) = MONTH(CURDATE())
    `);

    // Répartition par véhicule (pour graphique Doughnut)
    const [parVehicule] = await db.query(`
      SELECT v.immatriculation, v.marque,
        SUM(c.litres) AS litres,
        SUM(c.cout_total) AS cout
      FROM carburant c
      JOIN vehicules v ON c.vehicule_id = v.id
      GROUP BY c.vehicule_id, v.immatriculation, v.marque
      ORDER BY cout DESC
    `);

    // Évolution mensuelle sur 6 mois (pour graphique Bar)
    const [evolutionMensuelle] = await db.query(`
      SELECT
        DATE_FORMAT(date_plein, '%Y-%m')        AS mois,
        MIN(DATE_FORMAT(date_plein, '%b %Y'))   AS label,
        SUM(litres)     AS litres,
        SUM(cout_total) AS cout
      FROM carburant
      WHERE date_plein >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(date_plein, '%Y-%m')
      ORDER BY mois ASC
    `);

    return res.json({
      totalLitres:         parseFloat(totaux[0].totalLitres)         || 0,
      coutTotal:           parseFloat(totaux[0].coutTotal)           || 0,
      consommationMoyenne: parseFloat(totaux[0].consommationMoyenne) || 0,
      coutMois:            parseFloat(moisActuel[0].coutMois)        || 0,
      parVehicule,
      evolutionMensuelle
    });
  } catch (err) {
    console.error('Erreur getStats carburant :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/carburant
 * Enregistre un plein. Le coût total est calculé automatiquement (litres × prix_litre).
 */
const create = async (req, res) => {
  try {
    const {
      vehicule_id, mission_id, date_plein, litres, prix_litre,
      kilometrage_au_plein, consommation_reelle, station, ville, type_carburant, notes
    } = req.body;

    if (!vehicule_id || !date_plein || !litres || !prix_litre) {
      return res.status(400).json({ message: 'Champs obligatoires : vehicule_id, date_plein, litres, prix_litre' });
    }

    const cout_total = parseFloat(litres) * parseFloat(prix_litre);

    const [result] = await db.query(
      `INSERT INTO carburant
        (vehicule_id, mission_id, date_plein, litres, prix_litre, cout_total,
         kilometrage_au_plein, consommation_reelle, station, ville, type_carburant, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vehicule_id, mission_id || null, date_plein, litres, prix_litre, cout_total,
       kilometrage_au_plein || null, consommation_reelle || null,
       station || null, ville || null, type_carburant || 'diesel', notes || null]
    );

    const [nouveau] = await db.query(
      `SELECT c.*, v.immatriculation, v.marque
       FROM carburant c JOIN vehicules v ON c.vehicule_id = v.id WHERE c.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(nouveau[0]);
  } catch (err) {
    console.error('Erreur create carburant :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/carburant/:id
 * Met à jour un plein. Recalcule automatiquement le coût total.
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vehicule_id, mission_id, date_plein, litres, prix_litre,
      kilometrage_au_plein, consommation_reelle, station, ville, type_carburant, notes
    } = req.body;

    const [existing] = await db.query('SELECT id FROM carburant WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Plein introuvable' });

    const cout_total = parseFloat(litres) * parseFloat(prix_litre);

    await db.query(
      `UPDATE carburant
       SET vehicule_id=?, mission_id=?, date_plein=?, litres=?, prix_litre=?, cout_total=?,
           kilometrage_au_plein=?, consommation_reelle=?, station=?, ville=?, type_carburant=?, notes=?
       WHERE id=?`,
      [vehicule_id, mission_id || null, date_plein, litres, prix_litre, cout_total,
       kilometrage_au_plein || null, consommation_reelle || null,
       station || null, ville || null, type_carburant || 'diesel', notes || null, id]
    );

    const [mis_a_jour] = await db.query(
      `SELECT c.*, v.immatriculation, v.marque
       FROM carburant c JOIN vehicules v ON c.vehicule_id = v.id WHERE c.id = ?`,
      [id]
    );

    return res.json(mis_a_jour[0]);
  } catch (err) {
    console.error('Erreur update carburant :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/carburant/:id
 * Supprime un enregistrement de plein.
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM carburant WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Plein introuvable' });

    await db.query('DELETE FROM carburant WHERE id = ?', [id]);
    return res.json({ message: 'Plein supprimé' });
  } catch (err) {
    console.error('Erreur remove carburant :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getAll, getStats, create, update, remove };
