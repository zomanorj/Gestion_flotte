// Auto-migration au démarrage — compatible MySQL 5.7+
const db = require('./db');

/** Vérifie si une colonne existe dans une table */
const colonneExiste = async (table, colonne) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS nb FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, colonne]
  );
  return rows[0].nb > 0;
};

/** Vérifie si un index existe */
const indexExiste = async (table, index) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS nb FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows[0].nb > 0;
};

/** Vérifie si une table existe */
const tableExiste = async (table) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS nb FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].nb > 0;
};

const appliquerMigrations = async () => {
  let ok = 0;

  const ajouterColonne = async (table, colonne, definition) => {
    if (!(await colonneExiste(table, colonne))) {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${definition}`);
      console.log(`[Migration] + ${table}.${colonne}`);
      ok++;
    }
  };

  const ajouterIndex = async (table, index, colonnes) => {
    if (!(await indexExiste(table, index))) {
      await db.query(`CREATE INDEX ${index} ON ${table}(${colonnes})`);
      ok++;
    }
  };

  try {
    // ── Colonnes users ──────────────────────────────────────────────────────
    await ajouterColonne('users', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER role');

    // ── Colonnes chauffeurs ─────────────────────────────────────────────────
    await ajouterColonne('chauffeurs', 'salaire_base',  'DECIMAL(10,2) DEFAULT 800000 AFTER statut');
    await ajouterColonne('chauffeurs', 'prime_mission', 'DECIMAL(10,2) DEFAULT 50000  AFTER salaire_base');

    // ── Colonnes documents ──────────────────────────────────────────────────
    await ajouterColonne('documents', 'fichier_nom', 'VARCHAR(255) NULL');
    await ajouterColonne('documents', 'fichier_url', 'VARCHAR(500) NULL');

    // ── Colonne missions.client_id ──────────────────────────────────────────
    await ajouterColonne('missions', 'client_id', 'INT NULL AFTER chauffeur_id');

    // ── Table notifications ──────────────────────────────────────────────────
    if (!(await tableExiste('notifications'))) {
      await db.query(`
        CREATE TABLE notifications (
          id          INT PRIMARY KEY AUTO_INCREMENT,
          type        VARCHAR(50),
          titre       VARCHAR(200),
          message     TEXT,
          est_lue     BOOLEAN DEFAULT FALSE,
          vehicule_id INT NULL,
          user_id     INT NULL,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);
      console.log('[Migration] + table notifications');
      ok++;
    } else {
      // Table existe — ajouter user_id si absent
      await ajouterColonne('notifications', 'user_id', 'INT NULL AFTER vehicule_id');
    }

    // ── Table mission_salaires ───────────────────────────────────────────────
    if (!(await tableExiste('mission_salaires'))) {
      await db.query(`
        CREATE TABLE mission_salaires (
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
        ) ENGINE=InnoDB
      `);
      console.log('[Migration] + table mission_salaires');
      ok++;
    }

    // ── Indexes de performance ───────────────────────────────────────────────
    await ajouterIndex('missions',              'idx_missions_statut',    'statut');
    await ajouterIndex('missions',              'idx_missions_date',      'date_depart');
    await ajouterIndex('carburant',             'idx_carburant_date',     'date_plein');
    await ajouterIndex('depenses',              'idx_depenses_date',      'date_depense');
    await ajouterIndex('documents',             'idx_documents_exp',      'date_expiration');
    await ajouterIndex('maintenances_planifiees','idx_maintenances_date', 'date_prevue');

    console.log(`[Migration] ✅ ${ok} changement(s) appliqué(s)`);
  } catch (err) {
    console.error('[Migration] ❌ Erreur :', err.message);
    throw err;
  }
};

module.exports = { appliquerMigrations };
