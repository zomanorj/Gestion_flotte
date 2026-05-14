/**
 * authMiddleware.js
 * Middleware Express de vérification du token JWT (JSON Web Token).
 *
 * Ce middleware est placé devant les routes protégées.
 * Il extrait le token du header HTTP "Authorization",
 * le vérifie avec la clé secrète, et injecte les données
 * de l'utilisateur dans req.user pour les contrôleurs suivants.
 *
 * Format attendu du header : "Authorization: Bearer <token>"
 */

const jwt = require('jsonwebtoken')

/**
 * verifierToken
 * Middleware qui protège une route en exigeant un JWT valide.
 *
 * @param {import('express').Request}  req  - Requête Express
 * @param {import('express').Response} res  - Réponse Express
 * @param {import('express').NextFunction} next - Passe au middleware suivant
 */
const verifierToken = (req, res, next) => {
  // Récupération du header Authorization
  const headerAuthorization = req.headers['authorization']

  // Le format attendu est "Bearer <token>" — on extrait la 2e partie
  const tokenJWT = headerAuthorization && headerAuthorization.split(' ')[1]

  // Si aucun token n'est fourni, accès refusé
  if (!tokenJWT) {
    return res.status(401).json({
      message: 'Accès refusé : aucun token fourni',
    })
  }

  try {
    // Vérification et décodage du token avec la clé secrète
    // jwt.verify lève une exception si le token est invalide ou expiré
    const donneesToken = jwt.verify(tokenJWT, process.env.JWT_SECRET)

    // Injection des données utilisateur dans la requête pour les contrôleurs
    // donneesToken contient : { id, email, role, iat, exp }
    req.user = {
      id:    donneesToken.id,
      email: donneesToken.email,
      role:  donneesToken.role,
    }

    // Passage au middleware ou contrôleur suivant
    next()
  } catch (erreur) {
    // JsonWebTokenError : token malformé ou signature incorrecte
    // TokenExpiredError  : token expiré
    return res.status(401).json({
      message: 'Token invalide ou expiré, veuillez vous reconnecter',
    })
  }
}

module.exports = { verifierToken }
