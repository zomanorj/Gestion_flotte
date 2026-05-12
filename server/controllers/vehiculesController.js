// Contrôleur camions — CRUD et alertes de maintenance
const db = require('../config/db');

/**
 * GET /api/vehicules
 * Retourne tous les véhicules avec filtres optionnels.
 * Query params : ?statut=disponible&search=toyota
 */
const getAll = async (req, res) => {
  try {
    const { statut, search } = req.query;
    let query  = 'SELECT * FROM vehicules WHERE 1=1';
    const params = [];

    if (statut) {
      query += ' AND statut = ?';
      params.push(statut);
    }

    if (search) {
      query += ' AND (immatriculation LIKE ? OR marque LIKE ? OR modele LIKE ?)';
      const motif = `%${search}%`;
      params.push(motif, motif, motif);
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error('Erreur getAll véhicules :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/vehicules/alertes
 * Retourne les véhicules nécessitant une attention :
 * - CT à moins de 30 jours
 * - Kilométrage > 10 000 km depuis la dernière vidange
 */
const getAlertes = async (req, res) => {
  try {
    const query = `
      SELECT
        v.*,
        DATEDIFF(v.date_prochain_ct, CURDATE()) AS jours_avant_ct,
        (v.kilometrage - IFNULL(
          (SELECT m.kilometrage_au_moment
           FROM maintenances m
           WHERE m.vehicule_id = v.id AND m.type = 'Vidange'
           ORDER BY m.date_maintenance DESC LIMIT 1), 0
        )) AS km_depuis_vidange
      FROM vehicules v
      WHERE
        (v.date_prochain_ct IS NOT NULL AND v.date_prochain_ct <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
        OR
        (v.kilometrage - IFNULL(
          (SELECT m2.kilometrage_au_moment
           FROM maintenances m2
           WHERE m2.vehicule_id = v.id AND m2.type = 'Vidange'
           ORDER BY m2.date_maintenance DESC LIMIT 1), 0
        ) > 10000)
      ORDER BY v.date_prochain_ct ASC
    `;
    const [rows] = await db.query(query);
    return res.json(rows);

  } catch (err) {
    console.error('Erreur getAlertes :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/vehicules/:id
 * Retourne un véhicule avec ses 5 dernières missions et ses maintenances.
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    // Récupération du véhicule
    const [vehicule] = await db.query('SELECT * FROM vehicules WHERE id = ?', [id]);
    if (vehicule.length === 0) {
      return res.status(404).json({ message: 'Véhicule introuvable' });
    }

    // 5 dernières missions de ce véhicule
    const [missions] = await db.query(`
      SELECT m.*, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
      FROM missions m
      JOIN chauffeurs c ON m.chauffeur_id = c.id
      WHERE m.vehicule_id = ?
      ORDER BY m.date_depart DESC
      LIMIT 5
    `, [id]);

    // Toutes les maintenances de ce véhicule
    const [maintenances] = await db.query(
      'SELECT * FROM maintenances WHERE vehicule_id = ? ORDER BY date_maintenance DESC',
      [id]
    );

    return res.json({ ...vehicule[0], missions, maintenances });

  } catch (err) {
    console.error('Erreur getById véhicule :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/vehicules
 * Crée un nouveau camion. Vérifie l'unicité de l'immatriculation.
 * Champs spécifiques camions : tonnage, type_camion, numero_chassis
 */
const create = async (req, res) => {
  try {
    const {
      immatriculation, marque, modele, annee, kilometrage,
      consommation_litre_km, statut, date_derniere_vidange, date_prochain_ct,
      tonnage, type_camion, numero_chassis
    } = req.body;

    if (!immatriculation || !marque || !modele || !annee) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    // Vérification de l'unicité de l'immatriculation
    const [existant] = await db.query(
      'SELECT id FROM vehicules WHERE immatriculation = ?', [immatriculation]
    );
    if (existant.length > 0) {
      return res.status(409).json({ message: 'Cette immatriculation existe déjà' });
    }

    const [result] = await db.query(
      `INSERT INTO vehicules
        (immatriculation, marque, modele, annee, kilometrage, consommation_litre_km,
         statut, date_derniere_vidange, date_prochain_ct,
         tonnage, type_camion, numero_chassis)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        immatriculation.toUpperCase(), marque, modele, annee,
        kilometrage || 0,
        consommation_litre_km || 0.30,
        statut || 'disponible',
        date_derniere_vidange || null,
        date_prochain_ct || null,
        tonnage || null,
        type_camion || 'porteur',
        numero_chassis || null
      ]
    );

    const [nouveau] = await db.query('SELECT * FROM vehicules WHERE id = ?', [result.insertId]);
    return res.status(201).json(nouveau[0]);

  } catch (err) {
    console.error('Erreur create véhicule :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/vehicules/:id
 * Met à jour les champs fournis d'un camion (inclut tonnage, type et châssis).
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      immatriculation, marque, modele, annee, kilometrage,
      consommation_litre_km, statut, date_derniere_vidange, date_prochain_ct,
      tonnage, type_camion, numero_chassis
    } = req.body;

    const [existant] = await db.query('SELECT id FROM vehicules WHERE id = ?', [id]);
    if (existant.length === 0) {
      return res.status(404).json({ message: 'Camion introuvable' });
    }

    await db.query(
      `UPDATE vehicules SET
        immatriculation       = COALESCE(?, immatriculation),
        marque                = COALESCE(?, marque),
        modele                = COALESCE(?, modele),
        annee                 = COALESCE(?, annee),
        kilometrage           = COALESCE(?, kilometrage),
        consommation_litre_km = COALESCE(?, consommation_litre_km),
        statut                = COALESCE(?, statut),
        date_derniere_vidange = COALESCE(?, date_derniere_vidange),
        date_prochain_ct      = COALESCE(?, date_prochain_ct),
        tonnage               = COALESCE(?, tonnage),
        type_camion           = COALESCE(?, type_camion),
        numero_chassis        = COALESCE(?, numero_chassis)
       WHERE id = ?`,
      [
        immatriculation ? immatriculation.toUpperCase() : null,
        marque || null, modele || null, annee || null,
        kilometrage || null, consommation_litre_km || null,
        statut || null, date_derniere_vidange || null,
        date_prochain_ct || null,
        tonnage || null, type_camion || null, numero_chassis || null,
        id
      ]
    );

    const [mis_a_jour] = await db.query('SELECT * FROM vehicules WHERE id = ?', [id]);
    return res.json(mis_a_jour[0]);

  } catch (err) {
    console.error('Erreur update véhicule :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/vehicules/:id
 * Supprime un camion uniquement s'il n'a aucune mission (active ou historique).
 * Un camion avec des missions terminées ne peut pas être supprimé :
 * l'historique de transport doit être conservé.
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existant] = await db.query('SELECT id, immatriculation FROM vehicules WHERE id = ?', [id]);
    if (existant.length === 0) {
      return res.status(404).json({ message: 'Camion introuvable' });
    }

    // Compte toutes les missions liées à ce camion (tous statuts confondus)
    const [toutesMissions] = await db.query(
      'SELECT COUNT(*) AS nb, SUM(statut IN ("planifiee","en_cours")) AS actives FROM missions WHERE vehicule_id = ?',
      [id]
    );

    if (toutesMissions[0].actives > 0) {
      return res.status(409).json({
        message: `Impossible de supprimer : le camion ${existant[0].immatriculation} a des missions en cours ou planifiées`
      });
    }

    if (toutesMissions[0].nb > 0) {
      return res.status(409).json({
        message: `Impossible de supprimer : le camion ${existant[0].immatriculation} a un historique de ${toutesMissions[0].nb} mission(s). Modifiez son statut à la place.`
      });
    }

    await db.query('DELETE FROM vehicules WHERE id = ?', [id]);
    return res.json({ message: 'Camion supprimé avec succès' });

  } catch (err) {
    console.error('Erreur remove véhicule :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getAll, getById, getAlertes, create, update, remove };
