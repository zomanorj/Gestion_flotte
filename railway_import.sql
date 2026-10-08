-- ============================================================
-- Import initial Railway : structure uniquement (aucune donnée de démonstration).
-- Fichier généré à partir des scripts de database/, sans création ni sélection de base
-- (Railway fournit la sienne).
-- Le premier administrateur est créé au démarrage de l'API via ADMIN_EMAIL / ADMIN_PASSWORD.
-- ============================================================

-- ========== schema.sql ==========
-- ============================================================
-- Système de Gestion de Flotte de Camions — Madagascar
-- Script de création de la base de données (structure uniquement)
-- Auteur : Manoa — L3 Informatique, Antananarivo
-- ============================================================



-- ============================================================
-- TABLE : users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('admin','gestionnaire','chauffeur') NOT NULL DEFAULT 'chauffeur',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : vehicules (camions lourds)
-- Colonnes spécifiques aux camions :
--   tonnage        — capacité de charge en tonnes
--   type_camion    — catégorie du camion
--   numero_chassis — numéro de châssis constructeur (VIN)
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicules (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  immatriculation          VARCHAR(20)    NOT NULL UNIQUE,
  marque                   VARCHAR(50)    NOT NULL,
  modele                   VARCHAR(80)    NOT NULL,
  annee                    YEAR           NOT NULL,
  kilometrage              INT            NOT NULL DEFAULT 0,
  consommation_litre_km    DECIMAL(4,2)   NOT NULL DEFAULT 0.30,
  statut                   ENUM('disponible','en_mission','en_panne','maintenance') NOT NULL DEFAULT 'disponible',
  date_derniere_vidange    DATE,
  date_prochain_ct         DATE,
  tonnage                  DECIMAL(6,2)   NULL,
  type_camion              ENUM('porteur','tracteur','benne','frigorifique','citerne') NOT NULL DEFAULT 'porteur',
  numero_chassis           VARCHAR(50)    NULL,
  created_at               DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : chauffeurs
-- ============================================================
CREATE TABLE IF NOT EXISTS chauffeurs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT           NULL,
  nom              VARCHAR(80)   NOT NULL,
  prenom           VARCHAR(80)   NOT NULL,
  telephone        VARCHAR(20)   NOT NULL,
  numero_permis    VARCHAR(50)   NOT NULL UNIQUE,
  categorie_permis VARCHAR(10)   NOT NULL DEFAULT 'C',
  statut           ENUM('disponible','en_mission','conge') NOT NULL DEFAULT 'disponible',
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chauffeur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : missions
-- poids_charge — tonnage effectivement chargé lors du transport
-- ============================================================
CREATE TABLE IF NOT EXISTS missions (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  titre               VARCHAR(150)    NOT NULL,
  vehicule_id         INT             NOT NULL,
  chauffeur_id        INT             NOT NULL,
  lieu_depart         VARCHAR(150)    NOT NULL,
  lieu_destination    VARCHAR(150)    NOT NULL,
  distance_km         DECIMAL(8,2)    NOT NULL DEFAULT 0,
  date_depart         DATETIME        NOT NULL,
  date_retour_prevue  DATETIME        NOT NULL,
  date_retour_reelle  DATETIME,
  statut              ENUM('planifiee','en_cours','terminee','annulee') NOT NULL DEFAULT 'planifiee',
  cout_carburant      DECIMAL(10,2),
  poids_charge        DECIMAL(8,2)    NULL,
  notes               TEXT,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mission_vehicule  FOREIGN KEY (vehicule_id)  REFERENCES vehicules(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mission_chauffeur FOREIGN KEY (chauffeur_id) REFERENCES chauffeurs(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : maintenances
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenances (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  vehicule_id             INT           NOT NULL,
  type                    VARCHAR(80)   NOT NULL,
  description             TEXT,
  date_maintenance        DATE          NOT NULL,
  cout                    DECIMAL(10,2) NOT NULL DEFAULT 0,
  kilometrage_au_moment   INT           NOT NULL DEFAULT 0,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_vehicule FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : alertes
-- ============================================================
CREATE TABLE IF NOT EXISTS alertes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  vehicule_id INT           NOT NULL,
  type        VARCHAR(80)   NOT NULL,
  message     TEXT          NOT NULL,
  est_lue     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alerte_vehicule FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Les données de démonstration sont dans seed_demo.sql (à ne pas exécuter en production).

-- ========== migrate_modules.sql ==========
-- Migration modules : documents, carburant, dépenses
-- À exécuter une seule fois : cmd /c "mysql -u root -pmanoa1105 flotte_db < migrate_modules.sql"

-- ─────────────────────────────────────────────
-- MODULE 1 : Documents administratifs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  vehicule_id       INT NOT NULL,
  type              ENUM('carte_grise','assurance','vignette','visite_technique','autorisation_transport') NOT NULL,
  numero            VARCHAR(100),
  date_emission     DATE NOT NULL,
  date_expiration   DATE NOT NULL,
  fichier_nom       VARCHAR(255),
  fichier_url       VARCHAR(500),
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE
);


-- ─────────────────────────────────────────────
-- MODULE 2 : Gestion du carburant
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carburant (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  vehicule_id          INT NOT NULL,
  mission_id           INT,
  date_plein           DATE NOT NULL,
  litres               DECIMAL(8,2) NOT NULL,
  prix_litre           DECIMAL(8,2) NOT NULL DEFAULT 5200,
  cout_total           DECIMAL(12,2) NOT NULL,
  kilometrage_au_plein INT,
  consommation_reelle  DECIMAL(5,2),
  station              VARCHAR(100),
  ville                VARCHAR(100),
  type_carburant       ENUM('diesel','essence','gasoil') NOT NULL DEFAULT 'diesel',
  notes                TEXT,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id)  REFERENCES missions(id)  ON DELETE SET NULL
);


-- ─────────────────────────────────────────────
-- MODULE 3 : Gestion des dépenses
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS depenses (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  vehicule_id      INT NOT NULL,
  mission_id       INT,
  categorie        ENUM('peage','amende','lavage','pneu','pieces_detachees','main_oeuvre','parking','divers') NOT NULL,
  montant          DECIMAL(12,2) NOT NULL,
  date_depense     DATE NOT NULL,
  description      TEXT,
  justificatif_url VARCHAR(500),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id)  REFERENCES missions(id)  ON DELETE SET NULL
);

-- ========== migrate_maintenances.sql ==========
-- Migration module maintenances planifiées
-- Exécuter : mysql -u root -pmanoa1105 flotte_db < migrate_maintenances.sql

CREATE TABLE IF NOT EXISTS maintenances_planifiees (
  id                      INT PRIMARY KEY AUTO_INCREMENT,
  vehicule_id             INT NOT NULL,
  type                    ENUM('vidange','freins','pneus','courroie','filtres','revision_generale','autre') NOT NULL,
  description             TEXT,
  kilometrage_declencheur INT,
  date_prevue             DATE,
  date_realisee           DATE,
  cout_estime             DECIMAL(10,2),
  cout_reel               DECIMAL(10,2),
  garage                  VARCHAR(200),
  statut                  ENUM('planifiee','en_cours','terminee','annulee') DEFAULT 'planifiee',
  priorite                ENUM('faible','normale','haute','urgente') DEFAULT 'normale',
  notes                   TEXT,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE
);

-- ========== migrate_clients.sql ==========
-- Migration module clients
-- Exécuter : mysql -u root -pmanoa1105 flotte_db < migrate_clients.sql

CREATE TABLE IF NOT EXISTS clients (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  nom         VARCHAR(200) NOT NULL,
  type        ENUM('entreprise','particulier') DEFAULT 'entreprise',
  contact_nom VARCHAR(100),
  telephone   VARCHAR(20),
  email       VARCHAR(150),
  adresse     TEXT,
  ville       VARCHAR(100),
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajout colonne client_id dans missions
ALTER TABLE missions ADD COLUMN client_id INT REFERENCES clients(id);

-- ========== migrate_v2.sql ==========
-- Migration FlotteCamion v2 — schéma complet
-- mysql -u root -pmanoa1105 flotte_db < migrate_v2.sql

-- ── Nouveaux champs missions ──────────────────────────────────────────────────
ALTER TABLE missions ADD COLUMN salaire_mission     DECIMAL(10,2) DEFAULT 0;
ALTER TABLE missions ADD COLUMN produits_transportes TEXT;
ALTER TABLE missions ADD COLUMN poids_total          DECIMAL(8,2);
ALTER TABLE missions ADD COLUMN valeur_marchandise   DECIMAL(12,2);

-- ── Nouveaux champs chauffeurs ────────────────────────────────────────────────
ALTER TABLE chauffeurs ADD COLUMN salaire_base  DECIMAL(10,2) DEFAULT 800000;
ALTER TABLE chauffeurs ADD COLUMN prime_mission DECIMAL(10,2) DEFAULT 50000;

-- ── Salaires par mission ──────────────────────────────────────────────────────
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

-- ── Historique modifications carburant ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carburant_historique (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  carburant_id    INT NOT NULL,
  champ_modifie   VARCHAR(50),
  ancienne_valeur VARCHAR(200),
  nouvelle_valeur VARCHAR(200),
  modifie_par     INT,
  modifie_par_nom VARCHAR(100),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (carburant_id) REFERENCES carburant(id) ON DELETE CASCADE
);

-- ── Événements mission stockés en base ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_evenements (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  mission_id   INT NOT NULL,
  type         VARCHAR(50),
  label        VARCHAR(200),
  description  TEXT,
  duree_min    INT,
  position_lat DECIMAL(10,7),
  position_lng DECIMAL(10,7),
  km_au_moment DECIMAL(8,2),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

-- ── Champs notifications ──────────────────────────────────────────────────────
-- Crée la table si elle n'existe pas encore
CREATE TABLE IF NOT EXISTS notifications (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  type        VARCHAR(50),
  titre       VARCHAR(200),
  message     TEXT,
  est_lue     BOOLEAN DEFAULT FALSE,
  vehicule_id INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notifications ADD COLUMN regle         BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN regle_par     INT;
ALTER TABLE notifications ADD COLUMN regle_par_nom VARCHAR(100);
ALTER TABLE notifications ADD COLUMN regle_le      TIMESTAMP NULL;

-- ── Champs clients enrichis ───────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN nif           VARCHAR(50);
ALTER TABLE clients ADD COLUMN stat_num      VARCHAR(50);
ALTER TABLE clients ADD COLUMN site_web      VARCHAR(200);
ALTER TABLE clients ADD COLUMN secteur       VARCHAR(100);
ALTER TABLE clients ADD COLUMN limite_credit DECIMAL(12,2) DEFAULT 0;

-- ========== migrate_phase3.sql ==========
-- ============================================================
-- Migration Phase 3 — Modules ERP : Utilisateurs, Paie,
--                     Upload, Pagination, Notifications
-- Exécuter : mysql -u root -p flotte_db < migrate_phase3.sql
-- ============================================================


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

