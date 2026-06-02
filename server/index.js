// Point d'entrée du serveur Express — Système de gestion de flotte
const express   = require('express');
const cors      = require('cors');
const http      = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('ERREUR : JWT_SECRET manquant dans .env');
  process.exit(1);
}

const app    = express();
const server = http.createServer(app);

// Configuration Socket.io pour la communication temps réel
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware CORS — autorise uniquement le client React
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));

// Parsing du corps des requêtes en JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Injection de Socket.io dans chaque requête pour les événements temps réel
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// Rend io accessible depuis les routes (ex: simulation)
app.set('io', io);

// Montage des routes de l'API
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/vehicules',     require('./routes/vehicules'));
app.use('/api/chauffeurs',    require('./routes/chauffeurs'));
app.use('/api/missions',      require('./routes/missions'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/simulation',    require('./routes/simulation'));
app.use('/api/documents',     require('./routes/documents'));
app.use('/api/carburant',     require('./routes/carburant'));
app.use('/api/depenses',      require('./routes/depenses'));
app.use('/api/maintenances',  require('./routes/maintenances'));
app.use('/api/clients',       require('./routes/clients'));
app.use('/api/paie',          require('./routes/paie'));
app.use('/api/notifications', require('./routes/notifications'));

// Serveur les fichiers uploadés (documents, etc.)
const path = require('path');
app.use('/uploads', require('./middleware/authMiddleware').verifierToken,
  require('express').static(path.join(__dirname, 'uploads'))
);

// Route de santé : permet de vérifier que le serveur tourne
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Serveur flotte opérationnel' });
});

// Gestion des routes inexistantes
app.use((_req, res) => {
  res.status(404).json({ message: 'Route introuvable' });
});

// Gestion globale des erreurs Express
app.use((err, _req, res, _next) => {
  console.error('Erreur serveur :', err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

// Événements Socket.io
io.on('connection', (socket) => {
  console.log(`[Socket] Client connecté : ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket] Client déconnecté : ${socket.id}`);
  });
});

// Vérification périodique des alertes (documents + maintenances)
const { verifierAlertesPeriodiques } = require('./controllers/notificationsController');
setTimeout(() => verifierAlertesPeriodiques(io), 5000);          // 5s après démarrage
setInterval(() => verifierAlertesPeriodiques(io), 24 * 3600000); // Toutes les 24h

// Démarrage du serveur — migrations automatiques d'abord
const { appliquerMigrations } = require('./config/migrations');
const PORT = process.env.PORT || 5000;

appliquerMigrations().then(() => {
  server.listen(PORT, () => {
    console.log(`\nCamionApp — Serveur démarré`);
    console.log(`   API disponible sur : http://localhost:${PORT}/api`);
    console.log(`   Environnement      : ${process.env.NODE_ENV || 'development'}\n`);
  });
}).catch((err) => {
  console.error('Erreur migrations au démarrage :', err);
  process.exit(1);
});
