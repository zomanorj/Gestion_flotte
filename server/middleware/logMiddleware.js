/**
 * logMiddleware.js
 * Utilitaire de journalisation des activités — TransiFlow.
 *
 * La fonction logActivite est conçue pour être appelée SANS await
 * (fire & forget) dans les contrôleurs, afin de ne pas bloquer
 * le flux principal en cas d'erreur de journalisation.
 */

const activiteModel = require('../models/activiteModel')

/**
 * logActivite
 * Enregistre une action dans le journal d'activité de manière asynchrone.
 * Les erreurs sont silencieuses : le journal ne doit jamais faire échouer une opération.
 *
 * @param {object} options
 * @param {number}  options.userId        - ID de l'utilisateur ayant effectué l'action
 * @param {string}  options.action        - Type d'action (connexion, creation, modification, suppression, etc.)
 * @param {string}  [options.entite]      - Entité concernée (vehicles, drivers, missions, clients, users)
 * @param {number}  [options.entiteId]    - ID de l'entité concernée
 * @param {string}  options.description   - Description lisible de l'action
 * @param {object}  [options.donneesAvant]  - État avant modification (pour l'audit)
 * @param {object}  [options.donneesApres]  - État après modification (pour l'audit)
 * @param {object}  [options.req]           - Objet request Express (pour extraire l'IP)
 */
function logActivite({ userId, action, entite, entiteId, description, donneesAvant = null, donneesApres = null, req = null }) {
  activiteModel.log({
    user_id:       userId,
    action,
    entite,
    entite_id:     entiteId,
    description,
    donnees_avant: donneesAvant,
    donnees_apres: donneesApres,
    ip_address:    req?.ip || null,
  }).catch(err => console.error('Erreur log activité:', err.message))
}

module.exports = { logActivite }
