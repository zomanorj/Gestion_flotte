-- ========== schema.sql ==========
-- ============================================================
-- Système de Gestion de Flotte de Camions — Madagascar
-- Script de création de la base de données et données de test
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

-- ============================================================
-- DONNÉES DE TEST
-- ============================================================

-- Utilisateurs
-- Mot de passe "password123" : régénérer le hash avec bcrypt si nécessaire
-- node -e "require('bcrypt').hash('password123',10).then(console.log)"
INSERT INTO users (nom, email, password_hash, role) VALUES
  ('Rakoto Jean',  'admin@flotte.mg',        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
  ('Rabe Marie',   'gestionnaire@flotte.mg', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'gestionnaire'),
  ('Randria Paul', 'chauffeur@flotte.mg',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'chauffeur');

-- Camions lourds (immatriculations malgaches)
INSERT INTO vehicules
  (immatriculation, marque, modele, annee, kilometrage, consommation_litre_km,
   statut, date_derniere_vidange, date_prochain_ct,
   tonnage, type_camion, numero_chassis)
VALUES
  ('MAD-001-24', 'Mercedes', 'Actros',  2022, 145000, 0.30,
   'disponible',  '2024-02-15', '2025-03-01',
   32.50, 'tracteur',     'WDB9340321L123456'),

  ('MAD-002-24', 'Volvo',    'FH16',    2021, 189000, 0.32,
   'en_mission',  '2024-01-20', '2024-12-15',
   36.00, 'tracteur',     'YV2RGA0C0LB123789'),

  ('MAD-003-24', 'MAN',      'TGX',     2023,  67000, 0.28,
   'maintenance', '2024-03-10', '2026-04-20',
   28.00, 'porteur',      'WMAH065ZXNM654321'),

  ('MAD-004-24', 'Scania',   'R500',    2020, 234000, 0.35,
   'disponible',  '2023-11-05', '2024-08-30',
   40.00, 'benne',        'YS2R4X20005123654'),

  ('MAD-005-24', 'Renault',  'T520',    2022,  98000, 0.29,
   'disponible',  '2024-04-01', '2027-01-15',
   30.00, 'frigorifique', 'VF612GGA0LN987654');

-- Chauffeurs (permis catégorie C/CE pour poids lourds)
INSERT INTO chauffeurs (user_id, nom, prenom, telephone, numero_permis, categorie_permis, statut) VALUES
  (3, 'Randria',       'Paul',   '+261 34 12 345 67', 'MG-PL-2018-00123', 'CE', 'en_mission'),
  (NULL, 'Rakotondrabe', 'Hery',   '+261 33 87 654 32', 'MG-PL-2019-00456', 'CE', 'disponible'),
  (NULL, 'Andriantsoa',  'Lanto',  '+261 34 56 789 01', 'MG-PL-2020-00789', 'C',  'disponible'),
  (NULL, 'Razafimahefa', 'Tahiry', '+261 32 11 223 44', 'MG-PL-2017-00321', 'CE', 'conge');

-- Missions de transport de marchandises
INSERT INTO missions
  (titre, vehicule_id, chauffeur_id,
   lieu_depart, lieu_destination, distance_km,
   date_depart, date_retour_prevue, date_retour_reelle,
   statut, cout_carburant, poids_charge, notes)
VALUES
  (
    'Transport ciment Toamasina',
    2, 1,
    'Antananarivo', 'Toamasina', 260.00,
    '2024-05-10 06:00:00', '2024-05-11 18:00:00', NULL,
    'en_cours', NULL, 35.00,
    'Ciment Portland — 35 tonnes pour le chantier CHU Toamasina'
  ),
  (
    'Livraison riz Antsirabe',
    1, 2,
    'Antananarivo', 'Antsirabe', 170.00,
    '2024-05-15 07:00:00', '2024-05-15 20:00:00', NULL,
    'planifiee', NULL, 20.00,
    'Riz blanc décortiqué — 20 tonnes, coopérative Antsirabe-Sud'
  ),
  (
    'Transport carburant Fianarantsoa',
    3, 3,
    'Antananarivo', 'Fianarantsoa', 405.00,
    '2024-04-20 05:00:00', '2024-04-22 18:00:00', '2024-04-22 16:30:00',
    'terminee', ROUND(405 * 0.28 * 5200, 2), 22.50,
    'Carburant diesel — 25 000 litres pour la station JOVENNA'
  );

-- Maintenances
INSERT INTO maintenances (vehicule_id, type, description, date_maintenance, cout, kilometrage_au_moment) VALUES
  (3, 'Vidange',    'Vidange huile moteur 15W40 + filtre à huile',         '2024-03-10', 220000,  66500),
  (2, 'Vidange',    'Vidange huile + filtre air + filtre carburant',        '2024-01-20', 220000, 188000),
  (1, 'Vidange',    'Vidange préventive 15 000 km',                        '2024-02-15', 220000, 144000),
  (4, 'Freins',     'Remplacement garnitures de frein + disques avant',    '2024-01-10', 850000, 232000),
  (3, 'CT',         'Contrôle technique poids lourd — résultat : OK',      '2024-03-10', 180000,  66800);

-- Alertes
INSERT INTO alertes (vehicule_id, type, message, est_lue) VALUES
  (4, 'Contrôle technique', 'Le contrôle technique du camion MAD-004-24 (Scania R500) expire le 30/08/2024.', FALSE),
  (2, 'Contrôle technique', 'Le contrôle technique du camion MAD-002-24 (Volvo FH16) expire le 15/12/2024.', FALSE),
  (4, 'Kilométrage vidange', 'Le camion MAD-004-24 dépasse 10 000 km depuis la dernière vidange.', FALSE);

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

INSERT INTO documents (vehicule_id, type, numero, date_emission, date_expiration, notes) VALUES
(1, 'carte_grise',          'CG-2024-001',      '2024-01-15', '2027-01-15', 'Carte grise principale'),
(1, 'assurance',            'ASS-2024-MCR-001', '2024-03-01', '2025-03-01', 'Assurance tout risques expirée'),
(2, 'vignette',             'VGT-2025-002',     '2025-01-01', '2025-12-31', 'Vignette annuelle'),
(2, 'visite_technique',     'VT-2024-002',      '2024-06-15', '2026-06-15', 'Visite technique valide'),
(3, 'assurance',            'ASS-2025-003',     '2025-01-01', DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Assurance expire dans 15 jours');

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

INSERT INTO carburant (vehicule_id, date_plein, litres, prix_litre, cout_total, kilometrage_au_plein, consommation_reelle, station, ville, type_carburant) VALUES
(1, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 120.50, 5200, 626600, 45320, 0.32, 'Total',   'Antananarivo', 'diesel'),
(2, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 95.00,  5200, 494000, 38150, 0.28, 'Galana',  'Toamasina',   'diesel'),
(1, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 110.00, 5200, 572000, 45680, 0.31, 'Total',   'Antananarivo', 'diesel'),
(3, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  130.00, 5200, 676000, 22100, 0.35, 'Jovenna', 'Fianarantsoa', 'diesel');

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

INSERT INTO depenses (vehicule_id, categorie, montant, date_depense, description) VALUES
(1, 'peage',             15000,  DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Péage RN2 Antananarivo-Toamasina'),
(2, 'pneu',             450000,  DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Remplacement 2 pneus avant'),
(3, 'lavage',            25000,  DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Lavage complet + désinfection'),
(1, 'pieces_detachees', 180000,  DATE_SUB(CURDATE(), INTERVAL 8 DAY),  'Filtre à huile + filtre air'),
(4, 'amende',            50000,  DATE_SUB(CURDATE(), INTERVAL 3 DAY),  'Amende surcharge RN7');

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

INSERT INTO maintenances_planifiees
  (vehicule_id, type, description, kilometrage_declencheur, date_prevue, cout_estime, garage, statut, priorite)
VALUES
(1,'vidange',           'Vidange huile moteur + filtre',  50000, '2024-12-20', 85000,  'Garage Rakoto Tana',    'planifiee','haute'),
(2,'freins',            'Remplacement plaquettes avant',  65000, '2024-12-15', 150000, 'MécaAuto Antsirabe',    'planifiee','urgente'),
(3,'revision_generale', 'Révision 20 000 km',             20000, '2025-01-10', 350000, 'Toyota Madagascar',     'planifiee','normale'),
(1,'pneus',             'Remplacement 4 pneus',           55000, '2025-01-20', 800000, 'Garage Rakoto Tana',    'planifiee','normale');

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

INSERT INTO clients (nom, type, contact_nom, telephone, ville) VALUES
('COLAS Madagascar',    'entreprise', 'Rakoto Fils',  '034 11 111 11', 'Antananarivo'),
('Jirama',              'entreprise', 'Rabe Pierre',  '033 22 222 22', 'Toamasina'),
('Shoprite Madagascar', 'entreprise', 'Randria Jean', '032 33 333 33', 'Antananarivo'),
('Holcim Madagascar',   'entreprise', 'Razafy Marc',  '034 44 444 44', 'Mahajanga');

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

-- ── Nettoyage des données de test ─────────────────────────────────────────────
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE mission_evenements;
TRUNCATE TABLE mission_salaires;
TRUNCATE TABLE carburant_historique;
TRUNCATE TABLE carburant;
TRUNCATE TABLE depenses;
TRUNCATE TABLE documents;
TRUNCATE TABLE maintenances_planifiees;
TRUNCATE TABLE alertes;
TRUNCATE TABLE notifications;
TRUNCATE TABLE missions;
TRUNCATE TABLE chauffeurs;
TRUNCATE TABLE vehicules;
TRUNCATE TABLE clients;
SET FOREIGN_KEY_CHECKS = 1;

-- ── Garde uniquement l'admin ──────────────────────────────────────────────────
DELETE FROM users WHERE role != 'admin';
UPDATE users SET nom = 'Administrateur', email = 'admin@flotte.mg' WHERE role = 'admin';

-- ========== migrate_phase3.sql ==========
-- ============================================================
-- Migration Phase 3 — Modules ERP : Utilisateurs, Paie,
--                     Upload, Pagination, Notifications
-- Exécuter : mysql -u root -p flotte_db < migrate_phase3.sql
-- ============================================================


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

