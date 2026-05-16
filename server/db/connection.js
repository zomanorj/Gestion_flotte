/**
 * connection.js
 * Gestion de la connexion à la base de données PostgreSQL via un pool de connexions.
 *
 * Un "pool" maintient plusieurs connexions ouvertes en permanence pour éviter
 * d'en ouvrir une nouvelle à chaque requête SQL (coûteux). pg.Pool gère cela automatiquement.
 *
 * Ce module exporte directement le pool pour être importé dans les contrôleurs.
 */

const { Pool } = require('pg')

// Création du pool avec l'URL complète stockée dans .env
// Format attendu : postgresql://utilisateur:motdepasse@hote:port/nom_base
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // En production, activer SSL pour chiffrer la connexion avec la BDD distante
  // En développement local, on désactive pour simplifier la configuration
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,

  // Nombre maximum de clients dans le pool (défaut pg : 10)
  max: 10,

  // Délai avant qu'une connexion inutilisée soit fermée (30 secondes)
  idleTimeoutMillis: 30_000,

  // Délai maximum pour obtenir une connexion du pool (5 secondes)
  connectionTimeoutMillis: 5_000,
})

// Vérification de la connexion au démarrage du serveur
// On emprunte une connexion, on la teste, puis on la remet dans le pool
pool.connect((erreurConnexion, client, relacherConnexion) => {
  if (erreurConnexion) {
    console.error('❌ Impossible de se connecter à PostgreSQL :', erreurConnexion.message)
    console.error('   → Vérifiez DATABASE_URL dans votre fichier .env')
    return
  }

  /* Message positif réservé au hors-production (audit : réduire le bruit en prod) */
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Connexion PostgreSQL établie avec succès')
  }
  // Important : relâcher la connexion pour la remettre dans le pool
  relacherConnexion()
})

// Écoute les erreurs sur les connexions inactives du pool
pool.on('error', (erreur) => {
  console.error('❌ Erreur inattendue sur le pool PostgreSQL :', erreur.message)
})

module.exports = pool
