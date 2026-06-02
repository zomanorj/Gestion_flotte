// Auto-migration au démarrage — applique les colonnes manquantes sans perdre les données
const db = require('./db');

const migrations = [
  // Phase 3 : colonne is_active sur users
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role`,

  // Phase 3 : salaire chauffeurs (si migrate_v2 n'a pas été appliqué)
  `ALTER TABLE chauffeurs ADD COLUMN IF NOT EXISTS salaire_base  DECIMAL(10,2) DEFAULT 800000 AFTER statut`,
  `ALTER TABLE chauffeurs ADD COLUMN IF NOT EXISTS prime_mission DECIMAL(10,2) DEFAULT 50000  AFTER salaire_base`,

  // Phase 3 : fichiers sur documents
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS fichier_nom VARCHAR(255) NULL`,
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS fichier_url VARCHAR(500) NULL`,

  // Phase 3 : table mission_salaires
  `CREATE TABLE IF NOT EXISTS mission_salaires (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    mission_id    INT NOT NULL,
    chauffeur_id  INT NOT NULL,
    salaire_base  DECIMAL(10,2) DEFAULT 0,
    prime_mission DECIMAL(10,2) DEFAULT 0,
    bonus         DECIMAL(10,2) DEFAULT 0,
    total_paye    DECIMAL(10,2) DEFAULT 0,
    date_paiement DATE,
    statut        ENUM('en_attente','paye') DEFAULT 'en_attente',
    notes         TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id)   REFERENCES missions(id)   ON DELETE CASCADE,
    FOREIGN KEY (chauffeur_id) REFERENCES chauffeurs(id)
  ) ENGINE=InnoDB`,

  // Phase 3 : table notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    type        VARCHAR(50),
    titre       VARCHAR(200),
    message     TEXT,
    est_lue     BOOLEAN DEFAULT FALSE,
    vehicule_id INT NULL,
    user_id     INT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,

  // Phase 3 : colonnes supplémentaires notifications (si table déjà créée sans elles)
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER vehicule_id`,

  // Phase 3 : client_id sur missions
  `ALTER TABLE missions ADD COLUMN IF NOT EXISTS client_id INT NULL AFTER chauffeur_id`,

  // Indexes de performance
  `CREATE INDEX IF NOT EXISTS idx_missions_statut    ON missions(statut)`,
  `CREATE INDEX IF NOT EXISTS idx_missions_date      ON missions(date_depart)`,
  `CREATE INDEX IF NOT EXISTS idx_carburant_date     ON carburant(date_plein)`,
  `CREATE INDEX IF NOT EXISTS idx_depenses_date      ON depenses(date_depense)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_exp      ON documents(date_expiration)`,
];

const appliquerMigrations = async () => {
  let ok = 0;
  let err = 0;
  for (const sql of migrations) {
    try {
      await db.query(sql);
      ok++;
    } catch (e) {
      // Ignore "Duplicate key name" pour les indexes qui existent déjà
      if (!e.message.includes('Duplicate key name') && !e.message.includes('already exists')) {
        console.warn(`[Migration] ⚠️  ${e.message.slice(0, 80)}`);
        err++;
      }
    }
  }
  console.log(`[Migration] ✅ ${ok} migration(s) OK${err ? `, ${err} ignorée(s)` : ''}`);
};

module.exports = { appliquerMigrations };
