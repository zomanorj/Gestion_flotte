// Configuration et pool de connexions MySQL
const mysql = require('mysql2');
require('dotenv').config();

// Création d'un pool pour réutiliser les connexions
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'flotte_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4'
});

// Vérification de la connexion au démarrage
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Impossible de se connecter à MySQL :', err.message);
    console.error('   Vérifiez vos paramètres dans server/.env');
    process.exit(1);
  }
  console.log('✅ Connexion MySQL établie');
  connection.release();
});

// Export du pool avec l'interface promise (async/await)
module.exports = pool.promise();
