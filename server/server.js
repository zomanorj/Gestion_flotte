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
const helmet  = require('helmet')
const dotenv  = require('dotenv')

// Chargement des variables d'environnement EN PREMIER
// (doit précéder tout import utilisant process.env)
dotenv.config()

// Initialisation de la connexion au pool PostgreSQL
// L'import déclenche le pool.connect() de vérification dans connection.js
const pool = require('./db/connection')
const fs = require('fs')
const path = require('path')

// Import des routeurs métier
const authRoutes        = require('./routes/authRoutes')
const vehicleRoutes     = require('./routes/vehicleRoutes')
const driverRoutes      = require('./routes/driverRoutes')
const missionRoutes     = require('./routes/missionRoutes')
const trackingRoutes    = require('./routes/trackingRoutes')
const documentRoutes    = require('./routes/documentRoutes')
const statsRoutes       = require('./routes/statsRoutes')
const exportRoutes      = require('./routes/exportRoutes')
// Sprints 7+ : finance, maintenance, incidents
const financeRoutes     = require('./routes/financeRoutes')
const maintenanceRoutes = require('./routes/maintenanceRoutes')
const incidentRoutes    = require('./routes/incidentRoutes')
const clientRoutes      = require('./routes/clientRoutes')
const factureRoutes     = require('./routes/factureRoutes')
const paiementRoutes    = require('./routes/paiementRoutes')
const salaireRoutes     = require('./routes/salaireRoutes')
// Sprint 9 : utilisateurs, activité, corbeille, contrats, rapports avancés
const utilisateurRoutes = require('./routes/utilisateurRoutes')
const activiteRoutes    = require('./routes/activiteRoutes')
const corbeilleRoutes   = require('./routes/corbeilleRoutes')
const contratRoutes     = require('./routes/contratRoutes')
const rapportRoutes     = require('./routes/rapportRoutes')
/* Alias audit : même middleware JWT que verifierToken dans authMiddleware.js */
const { verifierToken: authMiddleware } = require('./middleware/authMiddleware')

const app  = express()
const PORT = process.env.PORT || 5000

/* Protection des headers HTTP */
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}))
// crossOriginEmbedderPolicy false → nécessaire pour Leaflet
// contentSecurityPolicy false → à configurer finement en prod

// ─────────────────────────────────────────────────────────────────────────────
// Middlewares globaux
// ─────────────────────────────────────────────────────────────────────────────

// CORS : autorise les requêtes depuis l'application React
// En développement : ports Vite locaux
// En production    : CLIENT_URL + toutes les preview URLs Vercel (*.vercel.app)
const originesAutorisees = [
  process.env.CLIENT_URL,           // URL Vercel de production (variable d'env Render)
  'http://localhost:5173',
  'http://localhost:3000',
  /https:\/\/.*\.vercel\.app$/,     // Toutes les previews Vercel (branches, PRs, etc.)
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (curl, Postman, mobile)
    if (!origin) return callback(null, true)
    const autorise = originesAutorisees.some(o =>
      typeof o === 'string'
        ? o === origin
        : o.test(origin)
    )
    if (autorise) callback(null, true)
    else callback(new Error('CORS non autorisé : ' + origin))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// Parsing automatique du corps des requêtes JSON
// Limite relevée à 5 Mo : trajet_points (géométrie OSRM) peut dépasser le défaut de 100 ko
app.use(express.json({ limit: '5mb' }))

/* Logger les requêtes HTTP en développement seulement */
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const horodatage = new Date().toISOString()
    console.log(`[${horodatage}] ${req.method} ${req.path}`)
    next()
  })
}

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

// Routes gestion financière : /api/finance
app.use('/api/finance', financeRoutes)

// Routes maintenance préventive : /api/maintenances
app.use('/api/maintenances', maintenanceRoutes)

// Routes incidents : /api/incidents
app.use('/api/incidents', incidentRoutes)

// Routes clients : /api/clients
app.use('/api/clients', clientRoutes)

// Routes factures : /api/factures
app.use('/api/factures', factureRoutes)

// Routes paiements progressifs : /api/factures/:id/paiements
app.use('/api/factures/:id/paiements', paiementRoutes)

// Routes salaires : /api/salaires (JWT obligatoire)
app.use('/api/salaires', authMiddleware, salaireRoutes)

// Routes utilisateurs : /api/utilisateurs (Sprint 9)
app.use('/api/utilisateurs', utilisateurRoutes)

// Routes profil : /api/profil (Sprint 9 — accessible à tous les rôles)
app.use('/api/profil', utilisateurRoutes.profilRouter)

// Routes journal d'activité : /api/activite (Sprint 9)
app.use('/api/activite', activiteRoutes)

// Routes corbeille : /api/corbeille (Sprint 9)
app.use('/api/corbeille', corbeilleRoutes)

// Routes contrats clients : /api/contrats (Sprint 9)
app.use('/api/contrats', contratRoutes)

// Routes rapports avancés : /api/rapports (Sprint 9)
app.use('/api/rapports', rapportRoutes)

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

// Au démarrage du serveur, appliquer les migrations dans l'ordre
async function runMigrations() {
  const migrations = [
    '001_update_vehicles.sql',
    '002_update_missions.sql',
    '003_add_tracking.sql',
    '004_add_coords.sql',
    '005_finance.sql',
    '006_maintenance.sql',
    '007_incidents.sql',
    '008_clients.sql',
    '009_paiements.sql',
    '010_salaires.sql',
    '011_corbeille.sql',
    '012_credit_client.sql',
    '013_indexes.sql',
    '014_utilisateurs.sql',
    '015_activite.sql',
    '016_contrats.sql',
  ]

  for (const fichier of migrations) {
    const migrationPath = path.join(__dirname, 'db/migrations', fichier)
    if (fs.existsSync(migrationPath)) {
      try {
        const sql = fs.readFileSync(migrationPath, 'utf8')
        await pool.query(sql)
        /* Traces migrations : développement / staging uniquement */
        if (process.env.NODE_ENV !== 'production') {
          console.log(`✅ Migration ${fichier} appliquée`)
        }
      } catch (err) {
        // On log l'erreur mais on continue (idempotent)
        console.error(`⚠️  Migration ${fichier} :`, err.message)
      }
    }
  }
}

app.listen(PORT, async () => {
  await runMigrations()
  /* Bandeau de démarrage : bruit évité en production */
  if (process.env.NODE_ENV !== 'production') {
    console.log('')
    console.log('┌─────────────────────────────────────────┐')
    console.log('│       🚌 Serveur TransiFlow               │')
    console.log('├─────────────────────────────────────────┤')
    console.log(`│  Port      : ${String(PORT).padEnd(30)} │`)
    console.log(`│  Env       : ${(process.env.NODE_ENV || 'development').padEnd(30)} │`)
    console.log('├─────────────────────────────────────────┤')
    console.log(`│  Health    : http://localhost:${PORT}/api/health   │`)
    console.log(`│  Auth      : http://localhost:${PORT}/api/auth     │`)
    console.log(`│  Vehicles  : http://localhost:${PORT}/api/vehicles│`)
    console.log(`│  Drivers   : http://localhost:${PORT}/api/drivers  │`)
    console.log(`│  Missions  : http://localhost:${PORT}/api/missions │`)
    console.log(`│  Tracking  : http://localhost:${PORT}/api/tracking│`)
    console.log(`│  Documents : http://localhost:${PORT}/api/documents│`)
    console.log(`│  Stats     : http://localhost:${PORT}/api/stats    │`)
    console.log(`│  Export    : http://localhost:${PORT}/api/export   │`)
    console.log('└─────────────────────────────────────────┘')
    console.log('')
  }
})
