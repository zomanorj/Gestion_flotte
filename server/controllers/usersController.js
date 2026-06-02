// Contrôleur utilisateurs — CRUD complet (admin uniquement)
const bcrypt = require('bcrypt');
const db     = require('../config/db');

/**
 * GET /api/users
 * Liste tous les comptes utilisateurs (sans hash de mot de passe).
 */
const getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.nom, u.email, u.role, u.is_active, u.created_at,
             c.id AS chauffeur_id, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
      FROM users u
      LEFT JOIN chauffeurs c ON c.user_id = u.id
      ORDER BY u.role ASC, u.nom ASC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('Erreur getAll users :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/users
 * Crée un nouveau compte utilisateur.
 * Champs requis : nom, email, password, role
 */
const create = async (req, res) => {
  try {
    const { nom, email, password, role } = req.body;

    if (!nom || !email || !password || !role) {
      return res.status(400).json({ message: 'Champs obligatoires : nom, email, password, role' });
    }

    const rolesValides = ['admin', 'gestionnaire', 'chauffeur'];
    if (!rolesValides.includes(role)) {
      return res.status(400).json({ message: `Rôle invalide. Valeurs acceptées : ${rolesValides.join(', ')}` });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit faire au moins 6 caractères' });
    }

    // Vérification unicité email
    const [existant] = await db.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existant.length > 0) {
      return res.status(409).json({ message: 'Un compte avec cet email existe déjà' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (nom, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [nom.trim(), email.trim().toLowerCase(), hash, role]
    );

    const [nouveau] = await db.query(
      'SELECT id, nom, email, role, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json(nouveau[0]);
  } catch (err) {
    console.error('Erreur create user :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/users/:id
 * Met à jour nom, email, rôle et statut actif d'un utilisateur.
 * Un admin ne peut pas se rétrograder lui-même.
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, email, role, is_active } = req.body;

    const [existant] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existant.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Empêche un admin de se rétrograder lui-même
    if (parseInt(id) === req.user.id && role && role !== 'admin') {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier votre propre rôle' });
    }

    if (email && email !== existant[0].email) {
      const [doublon] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (doublon.length > 0) {
        return res.status(409).json({ message: 'Cet email est déjà utilisé' });
      }
    }

    const nouveauNom      = nom       !== undefined ? nom.trim()                       : existant[0].nom;
    const nouveauEmail    = email     !== undefined ? email.trim().toLowerCase()        : existant[0].email;
    const nouveauRole     = role      !== undefined ? role                              : existant[0].role;
    const nouveauActif    = is_active !== undefined ? (is_active ? 1 : 0)              : existant[0].is_active;

    await db.query(
      'UPDATE users SET nom=?, email=?, role=?, is_active=? WHERE id=?',
      [nouveauNom, nouveauEmail, nouveauRole, nouveauActif, id]
    );

    const [mis_a_jour] = await db.query(
      'SELECT id, nom, email, role, is_active, created_at FROM users WHERE id=?',
      [id]
    );
    return res.json(mis_a_jour[0]);
  } catch (err) {
    console.error('Erreur update user :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PATCH /api/users/:id/password
 * Réinitialise le mot de passe d'un utilisateur (admin) ou change le sien (own).
 */
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, password_actuel } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
    }

    const [existant] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existant.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Si l'utilisateur change son propre mot de passe, vérifier l'ancien
    if (parseInt(id) === req.user.id && req.user.role !== 'admin') {
      if (!password_actuel) {
        return res.status(400).json({ message: 'Mot de passe actuel requis' });
      }
      const valide = await bcrypt.compare(password_actuel, existant[0].password_hash);
      if (!valide) {
        return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password_hash=? WHERE id=?', [hash, id]);

    return res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (err) {
    console.error('Erreur changePassword :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/users/:id
 * Désactive un compte (soft delete via is_active=0).
 * Un admin ne peut pas se désactiver lui-même.
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(403).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const [existant] = await db.query('SELECT id, nom FROM users WHERE id=?', [id]);
    if (existant.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    await db.query('UPDATE users SET is_active=0 WHERE id=?', [id]);
    return res.json({ message: `Compte de ${existant[0].nom} désactivé` });
  } catch (err) {
    console.error('Erreur remove user :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { getAll, create, update, changePassword, remove };
