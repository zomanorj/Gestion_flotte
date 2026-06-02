// Contrôleur notifications — lecture, marquage et création interne
const db = require('../config/db');

/**
 * Crée une notification en base ET l'émet via Socket.io.
 * Appelée depuis d'autres controllers (maintenances, documents, missions...).
 * @param {Object} io   - instance Socket.io
 * @param {Object} data - { type, titre, message, vehicule_id? }
 */
const creerNotification = async (io, data) => {
  try {
    const { type, titre, message, vehicule_id = null } = data;
    const [result] = await db.query(
      'INSERT INTO notifications (type, titre, message, vehicule_id) VALUES (?, ?, ?, ?)',
      [type, titre, message, vehicule_id]
    );

    const notif = {
      id: result.insertId,
      type, titre, message, vehicule_id,
      est_lue: false,
      created_at: new Date().toISOString()
    };

    if (io) io.emit('notification:nouvelle', notif);
    return notif;
  } catch (err) {
    console.error('Erreur creerNotification :', err);
  }
};

/**
 * GET /api/notifications
 * Retourne les 50 dernières notifications, non lues en premier.
 * Query: ?non_lues=true pour filtrer uniquement les non lues.
 */
const getAll = async (req, res) => {
  try {
    const { non_lues } = req.query;
    let query = `
      SELECT n.*, v.immatriculation
      FROM notifications n
      LEFT JOIN vehicules v ON v.id = n.vehicule_id
      WHERE 1=1
    `;
    const params = [];

    if (non_lues === 'true') {
      query += ' AND n.est_lue = 0';
    }

    query += ' ORDER BY n.est_lue ASC, n.created_at DESC LIMIT 50';
    const [rows] = await db.query(query, params);

    const [count] = await db.query('SELECT COUNT(*) AS total FROM notifications WHERE est_lue = 0');
    return res.json({ notifications: rows, non_lues: count[0].total });
  } catch (err) {
    console.error('Erreur getAll notifications :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Marque une notification comme lue.
 */
const marquerLue = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE notifications SET est_lue=1 WHERE id=?', [id]);
    return res.json({ message: 'Notification marquée comme lue' });
  } catch (err) {
    console.error('Erreur marquerLue :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Marque toutes les notifications comme lues.
 */
const marquerToutesLues = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET est_lue=1 WHERE est_lue=0');
    return res.json({ message: 'Toutes les notifications marquées comme lues' });
  } catch (err) {
    console.error('Erreur marquerToutesLues :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/notifications/:id
 * Supprime une notification.
 */
const remove = async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE id=?', [req.params.id]);
    return res.json({ message: 'Notification supprimée' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * Vérifie les documents et maintenances expirant bientôt et crée des notifications.
 * À appeler au démarrage du serveur puis toutes les 24h.
 */
const verifierAlertesPeriodiques = async (io) => {
  try {
    // Documents expirant dans 30 jours ou déjà expirés (pas encore notifiés aujourd'hui)
    const [docs] = await db.query(`
      SELECT d.id, d.type, d.date_expiration, v.immatriculation,
             DATEDIFF(d.date_expiration, CURDATE()) AS jours
      FROM documents d
      JOIN vehicules v ON v.id = d.vehicule_id
      WHERE d.date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.vehicule_id = d.vehicule_id
            AND n.type = 'document_expiration'
            AND DATE(n.created_at) = CURDATE()
            AND n.titre LIKE CONCAT('%', d.type, '%')
        )
    `);

    for (const doc of docs) {
      const jours = parseInt(doc.jours);
      const msg   = jours < 0
        ? `Document expiré depuis ${Math.abs(jours)} jour(s)`
        : `Document expire dans ${jours} jour(s)`;
      await creerNotification(io, {
        type:        'document_expiration',
        titre:       `${doc.type} — ${doc.immatriculation}`,
        message:     msg,
        vehicule_id: null
      });
    }

    // Maintenances urgentes non résolues
    const [maints] = await db.query(`
      SELECT m.id, m.type, m.date_prevue, v.immatriculation
      FROM maintenances_planifiees m
      JOIN vehicules v ON v.id = m.vehicule_id
      WHERE m.priorite IN ('urgente','haute')
        AND m.statut NOT IN ('terminee','annulee')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'maintenance_urgente'
            AND DATE(n.created_at) = CURDATE()
            AND n.titre LIKE CONCAT('%', v.immatriculation, '%')
        )
    `);

    for (const m of maints) {
      await creerNotification(io, {
        type:    'maintenance_urgente',
        titre:   `Maintenance ${m.type} — ${m.immatriculation}`,
        message: `Maintenance urgente à traiter${m.date_prevue ? ` avant le ${new Date(m.date_prevue).toLocaleDateString('fr-FR')}` : ''}`
      });
    }

    console.log(`[Notifications] ${docs.length} docs + ${maints.length} maintenances vérifiés`);
  } catch (err) {
    console.error('Erreur verifierAlertesPeriodiques :', err);
  }
};

module.exports = { getAll, marquerLue, marquerToutesLues, remove, creerNotification, verifierAlertesPeriodiques };
