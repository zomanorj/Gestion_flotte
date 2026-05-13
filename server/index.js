// Point d'entrée du serveur Express — Système de gestion de flotte
const express   = require('express');
const cors      = require('cors');
const http      = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

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
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/vehicules',  require('./routes/vehicules'));
app.use('/api/chauffeurs', require('./routes/chauffeurs'));
app.use('/api/missions',   require('./routes/missions'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/simulation', require('./routes/simulation'));
app.use('/api/documents',  require('./routes/documents'));
app.use('/api/carburant',  require('./routes/carburant'));
app.use('/api/depenses',   require('./routes/depenses'));

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

// Démarrage du serveur
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\nCamionApp — Serveur démarré`);
  console.log(`   API disponible sur : http://localhost:${PORT}/api`);
  console.log(`   Environnement      : ${process.env.NODE_ENV || 'development'}\n`);
});
