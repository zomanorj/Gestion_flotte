// Contrôleur chauffeurs — CRUD et historique de missions
const db      = require('../config/db');
const paginer = require('../utils/paginer');

/**
 * GET /api/chauffeurs
 * Retourne tous les chauffeurs, avec filtre optionnel par statut.
 */
const getAll = async (req, res) => {
  try {
    const { statut, search } = req.query;
    let query  = 'SELECT * FROM chauffeurs WHERE 1=1';
    const params = [];

    if (statut) {
      query += ' AND statut = ?';
      params.push(statut);
    }

    if (search) {
      query += ' AND (nom LIKE ? OR prenom LIKE ? OR numero_permis LIKE ?)';
      const motif = `%${search}%`;
      params.push(motif, motif, motif);
    }

    query += ' ORDER BY nom ASC, prenom ASC';

    const pg = paginer(req);
    if (pg.actif) {
      const countWhere = ' WHERE 1=1' +
        (statut ? ' AND statut = ?' : '') +
        (search ? ' AND (nom LIKE ? OR prenom LIKE ? OR numero_permis LIKE ?)' : '');
      const [count] = await db.query(
        'SELECT COUNT(*) AS total FROM chauffeurs' + countWhere,
        params.slice()
      );
      query += ' LIMIT ? OFFSET ?';
      params.push(pg.limit, pg.offset);
      const [rows] = await db.query(query, params);
      return res.json(pg.reponse(rows, count[0].total));
    }

    const [rows] = await db.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error('Erreur getAll chauffeurs :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/chauffeurs/:id
 * Retourne un chauffeur avec le nombre total de missions effectuées.
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query('SELECT * FROM chauffeurs WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Chauffeur introuvable' });
    }

    // Statistiques du chauffeur
    const [stats] = await db.query(`
      SELECT
        COUNT(*) AS total_missions,
        SUM(distance_km) AS total_km,
        SUM(CASE WHEN statut = 'terminee' THEN 1 ELSE 0 END) AS missions_terminees
      FROM missions
      WHERE chauffeur_id = ?
    `, [id]);

    return res.json({ ...rows[0], stats: stats[0] });

  } catch (err) {
    console.error('Erreur getById chauffeur :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/chauffeurs/:id/missions
 * Retourne l'historique complet des missions d'un chauffeur.
 */
const getMissions = async (req, res) => {
  try {
    const { id } = req.params;

    const [chauffeur] = await db.query('SELECT id FROM chauffeurs WHERE id = ?', [id]);
    if (chauffeur.length === 0) {
      return res.status(404).json({ message: 'Chauffeur introuvable' });
    }

    const [missions] = await db.query(`
      SELECT
        m.*,
        v.immatriculation,
        v.marque,
        v.modele
      FROM missions m
      JOIN vehicules v ON m.vehicule_id = v.id
      WHERE m.chauffeur_id = ?
      ORDER BY m.date_depart DESC
    `, [id]);

    return res.json(missions);

  } catch (err) {
    console.error('Erreur getMissions chauffeur :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/chauffeurs
 * Crée un nouveau chauffeur. Vérifie l'unicité du numéro de permis.
 */
const create = async (req, res) => {
  try {
    const { nom, prenom, telephone, numero_permis, categorie_permis, statut, user_id } = req.body;

    if (!nom || !prenom || !telephone || !numero_permis) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    // Vérification de l'unicité du permis
    const [existant] = await db.query(
      'SELECT id FROM chauffeurs WHERE numero_permis = ?', [numero_permis]
    );
    if (existant.length > 0) {
      return res.status(409).json({ message: 'Ce numéro de permis est déjà enregistré' });
    }

    const [result] = await db.query(
      `INSERT INTO chauffeurs (user_id, nom, prenom, telephone, numero_permis, categorie_permis, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id || null, nom, prenom, telephone, numero_permis,
        categorie_permis || 'B',
        statut || 'disponible'
      ]
    );

    const [nouveau] = await db.query('SELECT * FROM chauffeurs WHERE id = ?', [result.insertId]);
    return res.status(201).json(nouveau[0]);

  } catch (err) {
    console.error('Erreur create chauffeur :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/chauffeurs/:id
 * Met à jour les informations d'un chauffeur.
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, telephone, numero_permis, categorie_permis, statut } = req.body;

    const [existant] = await db.query('SELECT id FROM chauffeurs WHERE id = ?', [id]);
    if (existant.length === 0) {
      return res.status(404).json({ message: 'Chauffeur introuvable' });
    }

    await db.query(
      `UPDATE chauffeurs SET
        nom              = COALESCE(?, nom),
        prenom           = COALESCE(?, prenom),
        telephone        = COALESCE(?, telephone),
        numero_permis    = COALESCE(?, numero_permis),
        categorie_permis = COALESCE(?, categorie_permis),
        statut           = COALESCE(?, statut)
       WHERE id = ?`,
      [nom || null, prenom || null, telephone || null,
       numero_permis || null, categorie_permis || null, statut || null, id]
    );

    const [mis_a_jour] = await db.query('SELECT * FROM chauffeurs WHERE id = ?', [id]);
    return res.json(mis_a_jour[0]);

  } catch (err) {
    console.error('Erreur update chauffeur :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/chauffeurs/:id
 * Supprime un chauffeur uniquement s'il n'a aucune mission (active ou historique).
 * Un chauffeur avec un historique de missions doit être archivé, pas supprimé.
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existant] = await db.query(
      'SELECT id, nom, prenom FROM chauffeurs WHERE id = ?', [id]
    );
    if (existant.length === 0) {
      return res.status(404).json({ message: 'Chauffeur introuvable' });
    }

    const nom = `${existant[0].prenom} ${existant[0].nom}`;

    // Compte toutes les missions (actives + historique)
    const [toutesMissions] = await db.query(
      'SELECT COUNT(*) AS nb, SUM(statut IN ("planifiee","en_cours")) AS actives FROM missions WHERE chauffeur_id = ?',
      [id]
    );

    if (toutesMissions[0].actives > 0) {
      return res.status(409).json({
        message: `Impossible de supprimer : ${nom} a des missions en cours ou planifiées`
      });
    }

    if (toutesMissions[0].nb > 0) {
      return res.status(409).json({
        message: `Impossible de supprimer : ${nom} a un historique de ${toutesMissions[0].nb} mission(s). Passez-le en statut "congé" à la place.`
      });
    }

    await db.query('DELETE FROM chauffeurs WHERE id = ?', [id]);
    return res.json({ message: 'Chauffeur supprimé avec succès' });

  } catch (err) {
    console.error('Erreur remove chauffeur :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getAll, getById, getMissions, create, update, remove };
