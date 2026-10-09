-- ============================================================
-- Migration Phase 3 — Modules ERP : Utilisateurs, Paie,
--                     Upload, Pagination, Notifications
-- Exécuter : mysql -u root -p flotte_db < migrate_phase3.sql
-- ============================================================

USE flotte_db;

-- ── Procédures utilitaires ───────────────────────────────────────────────────
-- La syntaxe « ADD COLUMN IF NOT EXISTS » / « CREATE INDEX IF NOT EXISTS »
-- n'existe que sous MariaDB : ces procédures font la même chose sur MySQL 5.7 et 8.
DROP PROCEDURE IF EXISTS ajouter_colonne;
DROP PROCEDURE IF EXISTS ajouter_index;

DELIMITER //
CREATE PROCEDURE ajouter_colonne(IN p_table VARCHAR(64), IN p_colonne VARCHAR(64), IN p_definition VARCHAR(255))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_colonne
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_colonne, '` ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

CREATE PROCEDURE ajouter_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_colonnes VARCHAR(255))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @ddl = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '`(', p_colonnes, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- ── Utilisateurs : ajout is_active ───────────────────────────────────────────
CALL ajouter_colonne('users', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER role');

-- ── Chauffeurs : salaire_base et prime_mission (si migrate_v2 pas appliqué) ──
CALL ajouter_colonne('chauffeurs', 'salaire_base',  'DECIMAL(10,2) DEFAULT 800000 AFTER statut');
CALL ajouter_colonne('chauffeurs', 'prime_mission', 'DECIMAL(10,2) DEFAULT 50000 AFTER salaire_base');

-- ── Missions : client_id (si migrate_clients pas appliqué) ───────────────────
CALL ajouter_colonne('missions', 'client_id', 'INT NULL AFTER chauffeur_id');

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
CALL ajouter_colonne('documents', 'fichier_nom', 'VARCHAR(255) NULL AFTER notes');
CALL ajouter_colonne('documents', 'fichier_url', 'VARCHAR(500) NULL AFTER fichier_nom');

-- ── Notifications : ajout user_id pour ciblage ────────────────────────────────
-- Table créée dans migrate_v2.sql — on ajoute user_id si absent
CALL ajouter_colonne('notifications', 'user_id', 'INT NULL AFTER vehicule_id');

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
CALL ajouter_index('missions', 'idx_missions_statut', 'statut');
CALL ajouter_index('missions', 'idx_missions_date', 'date_depart');
CALL ajouter_index('missions', 'idx_missions_client', 'client_id');
CALL ajouter_index('carburant', 'idx_carburant_date', 'date_plein');
CALL ajouter_index('carburant', 'idx_carburant_vehicule', 'vehicule_id');
CALL ajouter_index('depenses', 'idx_depenses_date', 'date_depense');
CALL ajouter_index('depenses', 'idx_depenses_vehicule', 'vehicule_id');
CALL ajouter_index('documents', 'idx_documents_expiration', 'date_expiration');
CALL ajouter_index('maintenances_planifiees', 'idx_maintenances_date', 'date_prevue');
CALL ajouter_index('maintenances_planifiees', 'idx_maintenances_vehicule', 'vehicule_id');

DROP PROCEDURE ajouter_colonne;
DROP PROCEDURE ajouter_index;

SELECT 'Migration Phase 3 appliquée avec succès' AS resultat;
