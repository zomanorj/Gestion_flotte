-- ============================================================
-- Système de Gestion de Flotte de Camions — Madagascar
-- Script de création de la base de données et données de test
-- Auteur : Manoa — L3 Informatique, Antananarivo
-- ============================================================

CREATE DATABASE IF NOT EXISTS flotte_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE flotte_db;

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
