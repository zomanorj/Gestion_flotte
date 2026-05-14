/**
 * roleMiddleware.js
 * Middleware de contrôle d'accès basé sur les rôles (RBAC).
 *
 * Ce middleware est utilisé APRÈS authMiddleware (qui injecte req.user).
 * Il vérifie que le rôle de l'utilisateur connecté fait partie
 * des rôles autorisés pour accéder à la route.
 *
 * Exemple d'utilisation dans une route :
 *   router.delete('/users/:id', verifierToken, verifierRole('admin'), supprimerUtilisateur)
 *   router.get('/rapports',     verifierToken, verifierRole('admin', 'gestionnaire'), voirRapports)
 */

/**
 * verifierRole
 * Factory qui retourne un middleware vérifiant le rôle de l'utilisateur.
 *
 * @param  {...string} rolesAutorises - Liste des rôles ayant accès à la route
 * @returns {import('express').RequestHandler} Middleware Express
 *
 * @example
 *   verifierRole('admin')                     // admin seulement
 *   verifierRole('admin', 'gestionnaire')     // admin ou gestionnaire
 */
const verifierRole = (...rolesAutorises) => {
  return (req, res, next) => {
    // Sécurité : authMiddleware doit avoir été appelé avant ce middleware
    if (!req.user) {
      return res.status(401).json({
        message: 'Non authentifié : appelez verifierToken avant verifierRole',
      })
    }

    const roleUtilisateur = req.user.role

    // Vérification si le rôle de l'utilisateur est dans la liste des rôles autorisés
    if (!rolesAutorises.includes(roleUtilisateur)) {
      return res.status(403).json({
        message: `Accès interdit : le rôle '${roleUtilisateur}' n'est pas autorisé pour cette action`,
        rolesRequis: rolesAutorises,
      })
    }

    // Rôle valide, on continue
    next()
  }
}

module.exports = { verifierRole }
