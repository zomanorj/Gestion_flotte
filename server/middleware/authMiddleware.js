// Middleware d'authentification par token JWT
const jwt = require('jsonwebtoken');

/**
 * Vérifie le token JWT dans le header Authorization.
 * Format attendu : "Bearer <token>"
 * Si le token est valide, injecte req.user et passe au middleware suivant.
 */
const verifierToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou mal formaté' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'flotte_secret_jwt_2024');
    req.user = decoded; // { id, nom, email, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
    }
    return res.status(401).json({ message: 'Token invalide' });
  }
};

/**
 * Vérifie que l'utilisateur authentifié possède l'un des rôles autorisés.
 * Doit être utilisé APRÈS verifierToken.
 * @param {...string} roles - Les rôles autorisés (ex: 'admin', 'gestionnaire')
 */
const verifierRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Non authentifié' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Accès refusé. Rôles autorisés : ${roles.join(', ')}`
      });
    }
    next();
  };
};

module.exports = { verifierToken, verifierRole };
