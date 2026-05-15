/**
 * server.js
 * Point d'entrée principal du serveur Express — TransiFlow.
 *
 * Responsabilités :
 *  1. Charger les variables d'environnement (.env)
 *  2. Initialiser la connexion PostgreSQL
 *  3. Configurer les middlewares globaux (CORS, JSON, logs)
 *  4. Monter les routeurs métier sur /api/*
 *  5. Démarrer le serveur HTTP sur le port configuré
 */

const express = require('express')
const cors    = require('cors')
const dotenv  = require('dotenv')

// Chargement des variables d'environnement EN PREMIER
// (doit précéder tout import utilisant process.env)
dotenv.config()

// Initialisation de la connexion au pool PostgreSQL
// L'import déclenche le pool.connect() de vérification dans connection.js
require('./db/connection')

// Import des routeurs métier
const authRoutes     = require('./routes/authRoutes')
const vehicleRoutes  = require('./routes/vehicleRoutes')
const driverRoutes   = require('./routes/driverRoutes')
const missionRoutes  = require('./routes/missionRoutes')
const trackingRoutes = require('./routes/trackingRoutes')
const documentRoutes = require('./routes/documentRoutes')
const statsRoutes    = require('./routes/statsRoutes')
const exportRoutes   = require('./routes/exportRoutes')

const app  = express()
const PORT = process.env.PORT || 5000

// ─────────────────────────────────────────────────────────────────────────────
// Middlewares globaux
// ─────────────────────────────────────────────────────────────────────────────

// CORS : autorise les requêtes depuis l'application React
// On liste tous les ports Vite possibles en développement (5173, 5174, 5175…)
const originesAutoriseesDevLocal = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
]

app.use(cors({
  origin:      originesAutoriseesDevLocal,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// Parsing automatique du corps des requêtes JSON
app.use(express.json())

// Log minimaliste de chaque requête reçue (utile en développement)
app.use((req, _res, next) => {
  const horodatage = new Date().toLocaleTimeString('fr-FR')
  console.log(`[${horodatage}] ${req.method} ${req.path}`)
  next()
})

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// Routes d'authentification : /api/auth/register, /api/auth/login, /api/auth/me
app.use('/api/auth', authRoutes)

// Routes de gestion des véhicules : /api/vehicles
app.use('/api/vehicles', vehicleRoutes)

// Routes de gestion des chauffeurs : /api/drivers
app.use('/api/drivers', driverRoutes)

// Routes de gestion des missions : /api/missions
app.use('/api/missions', missionRoutes)

// Routes de suivi GPS : /api/tracking
app.use('/api/tracking', trackingRoutes)

// Routes de génération de documents : /api/documents
app.use('/api/documents', documentRoutes)

// Routes de statistiques : /api/stats
app.use('/api/stats', statsRoutes)

// Routes d'export Excel : /api/export
app.use('/api/export', exportRoutes)

// Route de santé : vérifier que le serveur est opérationnel
app.get('/api/health', (_req, res) => {
  res.json({
    statut:      'ok',
    message:     'Serveur TransiFlow opérationnel',
    environnement: process.env.NODE_ENV || 'development',
    horodatage:  new Date().toISOString(),
  })
})

// Route générique pour les endpoints non trouvés
app.use((_req, res) => {
  res.status(404).json({ message: 'Route introuvable' })
})

// ─────────────────────────────────────────────────────────────────────────────
// Démarrage
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('')
  console.log('┌─────────────────────────────────────────┐')
  console.log('│       🚌 Serveur TransiFlow          │')
  console.log('├─────────────────────────────────────────┤')
  console.log(`│  Port      : ${PORT}                        │`)
  console.log(`│  Env       : ${(process.env.NODE_ENV || 'development').padEnd(27)}│`)
console.log('├─────────────────────────────────────────┤')
console.log(`│  Health    : http://localhost:${PORT}/api/health  │`)
console.log(`│  Auth      : http://localhost:${PORT}/api/auth    │`)
console.log(`│  Vehicles  : http://localhost:${PORT}/api/vehicles│`)
console.log(`│  Drivers   : http://localhost:${PORT}/api/drivers │`)
console.log(`│  Missions  : http://localhost:${PORT}/api/missions│`)
console.log(`│  Tracking  : http://localhost:${PORT}/api/tracking│`)
console.log(`│  Documents : http://localhost:${PORT}/api/documents│`)
console.log(`│  Stats     : http://localhost:${PORT}/api/stats   │`)
console.log(`│  Export    : http://localhost:${PORT}/api/export  │`)
console.log('└─────────────────────────────────────────┘')
  console.log('')
})
