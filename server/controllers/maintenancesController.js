// Contrôleur maintenances planifiées — suivi et alertes
const db = require('../config/db');

/**
 * GET /api/maintenances
 * Retourne toutes les maintenances avec infos véhicule.
 * Filtres : ?statut=&priorite=&vehicule_id=
 * Ajoute le flag "depassee" si date_prevue < aujourd'hui et statut != terminee
 */
const getAll = async (req, res) => {
  try {
    const { statut, priorite, vehicule_id } = req.query;
    let query = `
      SELECT mp.*, v.immatriculation, v.marque, v.modele, v.kilometrage,
        (mp.date_prevue < CURDATE() AND mp.statut NOT IN ('terminee','annulee')) AS depassee
      FROM maintenances_planifiees mp
      JOIN vehicules v ON mp.vehicule_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (statut)      { query += ' AND mp.statut = ?';    params.push(statut); }
    if (priorite)    { query += ' AND mp.priorite = ?';  params.push(priorite); }
    if (vehicule_id) { query += ' AND mp.vehicule_id = ?'; params.push(vehicule_id); }

    query += ' ORDER BY mp.date_prevue ASC';
    const [rows] = await db.query(query, params);

    return res.json(rows.map(r => ({ ...r, depassee: !!r.depassee })));
  } catch (err) {
    console.error('Erreur getAll maintenances :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/maintenances/alertes
 * Retourne les maintenances urgentes :
 * - date_prevue dans les 7 prochains jours ou dépassée
 * - OU priorite = 'urgente'
 * - OU kilométrage véhicule >= kilometrage_declencheur
 */
const getAlertes = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT mp.*, v.immatriculation, v.marque, v.modele, v.kilometrage,
        (mp.date_prevue < CURDATE()) AS depassee
      FROM maintenances_planifiees mp
      JOIN vehicules v ON mp.vehicule_id = v.id
      WHERE mp.statut NOT IN ('terminee','annulee')
        AND (
          mp.date_prevue <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
          OR mp.priorite = 'urgente'
          OR (mp.kilometrage_declencheur IS NOT NULL AND v.kilometrage >= mp.kilometrage_declencheur)
        )
      ORDER BY mp.priorite DESC, mp.date_prevue ASC
    `);

    return res.json(rows.map(r => ({ ...r, depassee: !!r.depassee })));
  } catch (err) {
    console.error('Erreur getAlertes maintenances :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/maintenances
 * Planifie une nouvelle maintenance.
 */
const create = async (req, res) => {
  try {
    const {
      vehicule_id, type, description, kilometrage_declencheur,
      date_prevue, cout_estime, garage, priorite
    } = req.body;

    if (!vehicule_id || !type) {
      return res.status(400).json({ message: 'vehicule_id et type sont obligatoires' });
    }

    const [result] = await db.query(
      `INSERT INTO maintenances_planifiees
        (vehicule_id, type, description, kilometrage_declencheur,
         date_prevue, cout_estime, garage, priorite)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [vehicule_id, type, description || null, kilometrage_declencheur || null,
       date_prevue || null, cout_estime || null, garage || null, priorite || 'normale']
    );

    const [nouvelle] = await db.query(
      `SELECT mp.*, v.immatriculation, v.marque
       FROM maintenances_planifiees mp JOIN vehicules v ON mp.vehicule_id = v.id
       WHERE mp.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(nouvelle[0]);
  } catch (err) {
    console.error('Erreur create maintenance :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/maintenances/:id
 * Met à jour une maintenance planifiée.
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vehicule_id, type, description, kilometrage_declencheur,
      date_prevue, cout_estime, garage, statut, priorite, notes
    } = req.body;

    const [existing] = await db.query('SELECT id FROM maintenances_planifiees WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Maintenance introuvable' });

    await db.query(
      `UPDATE maintenances_planifiees
       SET vehicule_id=?, type=?, description=?, kilometrage_declencheur=?,
           date_prevue=?, cout_estime=?, garage=?, statut=?, priorite=?, notes=?
       WHERE id=?`,
      [vehicule_id, type, description || null, kilometrage_declencheur || null,
       date_prevue || null, cout_estime || null, garage || null,
       statut || 'planifiee', priorite || 'normale', notes || null, id]
    );

    const [mis_a_jour] = await db.query(
      `SELECT mp.*, v.immatriculation, v.marque
       FROM maintenances_planifiees mp JOIN vehicules v ON mp.vehicule_id = v.id
       WHERE mp.id = ?`,
      [id]
    );

    return res.json(mis_a_jour[0]);
  } catch (err) {
    console.error('Erreur update maintenance :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/maintenances/:id/terminer
 * Clôture une maintenance avec date réelle, coût réel et notes.
 */
const terminer = async (req, res) => {
  try {
    const { id } = req.params;
    const { date_realisee, cout_reel, notes } = req.body;

    const [existing] = await db.query('SELECT id FROM maintenances_planifiees WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Maintenance introuvable' });

    await db.query(
      `UPDATE maintenances_planifiees
       SET statut='terminee', date_realisee=?, cout_reel=?, notes=?
       WHERE id=?`,
      [date_realisee || new Date().toISOString().slice(0, 10), cout_reel || null, notes || null, id]
    );

    const [mis_a_jour] = await db.query(
      `SELECT mp.*, v.immatriculation, v.marque
       FROM maintenances_planifiees mp JOIN vehicules v ON mp.vehicule_id = v.id
       WHERE mp.id = ?`,
      [id]
    );

    return res.json(mis_a_jour[0]);
  } catch (err) {
    console.error('Erreur terminer maintenance :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/maintenances/:id
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM maintenances_planifiees WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Maintenance introuvable' });

    await db.query('DELETE FROM maintenances_planifiees WHERE id = ?', [id]);
    return res.json({ message: 'Maintenance supprimée' });
  } catch (err) {
    console.error('Erreur remove maintenance :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getAll, getAlertes, create, update, terminer, remove };
