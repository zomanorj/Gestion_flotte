// Contrôleur d'authentification — login et récupération du profil
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

/**
 * POST /api/auth/login
 * Vérifie email + mot de passe, retourne un token JWT si valide.
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  try {
    // Recherche de l'utilisateur par email
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    const user = rows[0];

    // Comparaison du mot de passe avec le hash stocké
    const passwordValide = await bcrypt.compare(password, user.password_hash);
    if (!passwordValide) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    // Génération du token JWT avec les informations essentielles
    const token = jwt.sign(
      { id: user.id, nom: user.nom, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'flotte_secret_jwt_2024',
      { expiresIn: '24h' }
    );

    // Retour du token et des infos utilisateur (sans le hash du mot de passe)
    const { password_hash, ...userSansHash } = user;
    return res.json({ token, user: userSansHash });

  } catch (err) {
    console.error('Erreur login :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * GET /api/auth/me
 * Retourne les informations du compte connecté (nécessite verifierToken).
 */
const getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nom, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erreur getMe :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

module.exports = { login, getMe };
