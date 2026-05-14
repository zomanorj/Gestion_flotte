/**
 * server.js
 * Point d'entrée principal du serveur Express pour l'API Transport STTA.
 *
 * Ce fichier :
 *  - charge les variables d'environnement depuis le fichier .env
 *  - configure les middlewares globaux (CORS, JSON)
 *  - définit une route de test pour vérifier que le serveur fonctionne
 *  - lance le serveur sur le port configuré
 *
 * À faire dans les prochains sprints : importer et brancher les routeurs métier
 * (utilisateurs, véhicules, chauffeurs, missions).
 */

const express = require('express')
const cors    = require('cors')
const dotenv  = require('dotenv')

// Chargement des variables d'environnement depuis .env
dotenv.config()

const app  = express()
const PORT = process.env.PORT || 5000

// ----- Middlewares globaux -----

// Autorise les requêtes cross-origin depuis le client React (port 5173 en dev)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))

// Parse automatiquement le corps des requêtes en JSON
app.use(express.json())

// ----- Routes -----

/**
 * GET /api/health
 * Route de test pour vérifier que le serveur est opérationnel.
 * Utile pour les health checks en production.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    statut:  'ok',
    message: 'Serveur Transport STTA opérationnel',
    horodatage: new Date().toISOString(),
  })
})

// TODO Sprint 1 : brancher les routeurs ici
// app.use('/api/auth',      require('./routes/auth'))
// app.use('/api/vehicules', require('./routes/vehicules'))
// app.use('/api/chauffeurs', require('./routes/chauffeurs'))
// app.use('/api/missions',  require('./routes/missions'))

// ----- Démarrage du serveur -----
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`)
  console.log(`   → Health check : http://localhost:${PORT}/api/health`)
})
