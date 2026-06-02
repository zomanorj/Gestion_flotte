// Contrôleur clients — CRUD et historique des missions par client
const db      = require('../config/db');
const paginer = require('../utils/paginer');

/**
 * GET /api/clients
 * Retourne tous les clients avec le nombre de missions associées.
 */
const getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*,
        COUNT(m.id) AS nb_missions,
        IFNULL(SUM(m.cout_carburant), 0) AS chiffre_affaires
      FROM clients c
      LEFT JOIN missions m ON m.client_id = c.id
      GROUP BY c.id
      ORDER BY c.nom ASC
    `);

    const pg = paginer(req);
    if (pg.actif) {
      const [count] = await db.query('SELECT COUNT(*) AS total FROM clients');
      const limited  = rows.slice(pg.offset, pg.offset + pg.limit);
      return res.json(pg.reponse(limited, count[0].total));
    }

    return res.json(rows);
  } catch (err) {
    console.error('Erreur getAll clients :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/clients/:id/missions
 * Retourne l'historique des missions d'un client donné.
 */
const getMissions = async (req, res) => {
  try {
    const { id } = req.params;

    const [client] = await db.query('SELECT id, nom FROM clients WHERE id = ?', [id]);
    if (!client.length) return res.status(404).json({ message: 'Client introuvable' });

    const [missions] = await db.query(`
      SELECT m.*, v.immatriculation, v.marque,
        c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
      FROM missions m
      JOIN vehicules  v ON m.vehicule_id  = v.id
      JOIN chauffeurs c ON m.chauffeur_id = c.id
      WHERE m.client_id = ?
      ORDER BY m.date_depart DESC
    `, [id]);

    return res.json({ client: client[0], missions });
  } catch (err) {
    console.error('Erreur getMissions client :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/clients
 * Crée un nouveau client.
 */
const create = async (req, res) => {
  try {
    const { nom, type, contact_nom, telephone, email, adresse, ville, notes } = req.body;

    if (!nom) return res.status(400).json({ message: 'Le nom du client est obligatoire' });

    const [result] = await db.query(
      `INSERT INTO clients (nom, type, contact_nom, telephone, email, adresse, ville, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nom, type || 'entreprise', contact_nom || null, telephone || null,
       email || null, adresse || null, ville || null, notes || null]
    );

    const [nouveau] = await db.query('SELECT * FROM clients WHERE id = ?', [result.insertId]);
    return res.status(201).json(nouveau[0]);
  } catch (err) {
    console.error('Erreur create client :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/clients/:id
 * Met à jour un client existant.
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, type, contact_nom, telephone, email, adresse, ville, notes } = req.body;

    const [existing] = await db.query('SELECT id FROM clients WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Client introuvable' });

    await db.query(
      `UPDATE clients SET nom=?, type=?, contact_nom=?, telephone=?,
        email=?, adresse=?, ville=?, notes=? WHERE id=?`,
      [nom, type || 'entreprise', contact_nom || null, telephone || null,
       email || null, adresse || null, ville || null, notes || null, id]
    );

    const [mis_a_jour] = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
    return res.json(mis_a_jour[0]);
  } catch (err) {
    console.error('Erreur update client :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/clients/:id
 * Supprime un client (les missions liées gardent client_id = NULL).
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM clients WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Client introuvable' });

    // Détache les missions liées avant suppression
    await db.query('UPDATE missions SET client_id = NULL WHERE client_id = ?', [id]);
    await db.query('DELETE FROM clients WHERE id = ?', [id]);

    return res.json({ message: 'Client supprimé' });
  } catch (err) {
    console.error('Erreur remove client :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getAll, getMissions, create, update, remove };
