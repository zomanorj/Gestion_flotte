-- ============================================================
-- Migration Phase 3 — Modules ERP : Utilisateurs, Paie,
--                     Upload, Pagination, Notifications
-- Exécuter : mysql -u root -p flotte_db < migrate_phase3.sql
-- ============================================================

USE flotte_db;

-- ── Utilisateurs : ajout is_active ───────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role;

-- ── Chauffeurs : salaire_base et prime_mission (si migrate_v2 pas appliqué) ──
ALTER TABLE chauffeurs
  ADD COLUMN IF NOT EXISTS salaire_base  DECIMAL(10,2) DEFAULT 800000 AFTER statut,
  ADD COLUMN IF NOT EXISTS prime_mission DECIMAL(10,2) DEFAULT 50000  AFTER salaire_base;

-- ── Missions : salaire_mission (si migrate_v2 pas appliqué) ──────────────────
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS client_id  INT NULL AFTER chauffeur_id;

-- Recréer FK client si elle n'existe pas
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'missions'
    AND CONSTRAINT_NAME = 'fk_mission_client'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE missions ADD CONSTRAINT fk_mission_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── Documents : colonnes fichier (si absentes) ────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS fichier_nom VARCHAR(255) NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS fichier_url VARCHAR(500) NULL AFTER fichier_nom;

-- ── Notifications : ajout user_id pour ciblage ────────────────────────────────
-- Table créée dans migrate_v2.sql — on ajoute user_id si absent
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER vehicule_id;

-- ── mission_salaires (si migrate_v2 pas appliqué) ────────────────────────────
CREATE TABLE IF NOT EXISTS mission_salaires (
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
);

-- ── clients (si absente) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(150) NOT NULL,
  type        ENUM('entreprise','particulier') NOT NULL DEFAULT 'entreprise',
  contact_nom VARCHAR(150),
  telephone   VARCHAR(20),
  email       VARCHAR(150),
  adresse     TEXT,
  ville       VARCHAR(100),
  nif         VARCHAR(50),
  stat_num    VARCHAR(50),
  site_web    VARCHAR(200),
  secteur     VARCHAR(100),
  limite_credit DECIMAL(12,2) DEFAULT 0,
  notes       TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Indexes de performance ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_missions_statut       ON missions(statut);
CREATE INDEX IF NOT EXISTS idx_missions_date         ON missions(date_depart);
CREATE INDEX IF NOT EXISTS idx_missions_client       ON missions(client_id);
CREATE INDEX IF NOT EXISTS idx_carburant_date        ON carburant(date_plein);
CREATE INDEX IF NOT EXISTS idx_carburant_vehicule    ON carburant(vehicule_id);
CREATE INDEX IF NOT EXISTS idx_depenses_date         ON depenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_depenses_vehicule     ON depenses(vehicule_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiration  ON documents(date_expiration);
CREATE INDEX IF NOT EXISTS idx_maintenances_date     ON maintenances_planifiees(date_prevue);
CREATE INDEX IF NOT EXISTS idx_maintenances_vehicule ON maintenances_planifiees(vehicule_id);

SELECT 'Migration Phase 3 appliquée avec succès' AS resultat;
