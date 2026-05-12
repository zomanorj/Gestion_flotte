-- ============================================================
-- Système de Gestion de Flotte — Madagascar
-- Script de création de la base de données et données de test
-- Auteur : Manoa — L3 Informatique, Antananarivo
-- ============================================================

-- Création et sélection de la base
CREATE DATABASE IF NOT EXISTS flotte_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE flotte_db;

-- ============================================================
-- TABLE : users
-- Stocke les comptes utilisateurs de l'application
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
-- TABLE : vehicules
-- Informations sur chaque véhicule de la flotte
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicules (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  immatriculation          VARCHAR(20)    NOT NULL UNIQUE,
  marque                   VARCHAR(50)    NOT NULL,
  modele                   VARCHAR(80)    NOT NULL,
  annee                    YEAR           NOT NULL,
  kilometrage              INT            NOT NULL DEFAULT 0,
  consommation_litre_km    DECIMAL(4,2)   NOT NULL DEFAULT 0.08,
  statut                   ENUM('disponible','en_mission','en_panne','maintenance') NOT NULL DEFAULT 'disponible',
  date_derniere_vidange    DATE,
  date_prochain_ct         DATE,
  created_at               DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : chauffeurs
-- Profils des chauffeurs liés à un compte utilisateur
-- ============================================================
CREATE TABLE IF NOT EXISTS chauffeurs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT           NULL,
  nom              VARCHAR(80)   NOT NULL,
  prenom           VARCHAR(80)   NOT NULL,
  telephone        VARCHAR(20)   NOT NULL,
  numero_permis    VARCHAR(50)   NOT NULL UNIQUE,
  categorie_permis VARCHAR(10)   NOT NULL DEFAULT 'B',
  statut           ENUM('disponible','en_mission','conge') NOT NULL DEFAULT 'disponible',
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chauffeur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : missions
-- Chaque déplacement planifié ou effectué
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
  notes               TEXT,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mission_vehicule  FOREIGN KEY (vehicule_id)  REFERENCES vehicules(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mission_chauffeur FOREIGN KEY (chauffeur_id) REFERENCES chauffeurs(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : maintenances
-- Historique des entretiens pour chaque véhicule
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
-- Notifications de maintenance ou anomalies véhicules
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
-- Mot de passe "password123" hashé avec bcrypt (10 rounds)
INSERT INTO users (nom, email, password_hash, role) VALUES
  ('Rakoto Jean',   'admin@flotte.mg',        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
  ('Rabe Marie',    'gestionnaire@flotte.mg', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'gestionnaire'),
  ('Randria Paul',  'chauffeur@flotte.mg',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'chauffeur');

-- Note : le hash ci-dessus correspond à "password" (utilisé par bcrypt.js pour les tests).
-- Pour régénérer avec "password123", exécuter : node -e "const b=require('bcrypt');b.hash('password123',10).then(console.log)"
-- et remplacer les hashs ci-dessus.

-- Véhicules (immatriculations format malgache)
INSERT INTO vehicules (immatriculation, marque, modele, annee, kilometrage, consommation_litre_km, statut, date_derniere_vidange, date_prochain_ct) VALUES
  ('MAD-001-24', 'Toyota',    'HiLux',        2022, 45200, 0.10, 'disponible',  '2024-02-15', '2025-03-01'),
  ('MAD-002-24', 'Mitsubishi','L200',          2021, 78500, 0.09, 'en_mission',  '2024-01-20', '2024-12-15'),
  ('MAD-003-23', 'Ford',      'Ranger',        2023,  9800, 0.08, 'disponible',  '2024-03-10', '2026-04-20'),
  ('MAD-004-22', 'Nissan',    'Navara',        2020, 123000, 0.11,'maintenance', '2023-11-05', '2024-08-30'),
  ('MAD-005-24', 'Peugeot',   'Partner',       2024,  3200, 0.07, 'disponible',  '2024-04-01', '2027-01-15');

-- Chauffeurs
INSERT INTO chauffeurs (user_id, nom, prenom, telephone, numero_permis, categorie_permis, statut) VALUES
  (3, 'Randria', 'Paul',      '+261 34 12 345 67', 'MG-P-2018-00123', 'B',  'en_mission'),
  (NULL, 'Rakotondrabe', 'Hery',   '+261 33 87 654 32', 'MG-P-2019-00456', 'BC', 'disponible'),
  (NULL, 'Andriantsoa',  'Lanto',  '+261 34 56 789 01', 'MG-P-2020-00789', 'B',  'disponible'),
  (NULL, 'Razafimahefa', 'Tahiry', '+261 32 11 223 44', 'MG-P-2017-00321', 'BCE','conge');

-- Missions
INSERT INTO missions (titre, vehicule_id, chauffeur_id, lieu_depart, lieu_destination, distance_km, date_depart, date_retour_prevue, date_retour_reelle, statut, cout_carburant, notes) VALUES
  (
    'Livraison matériel médical — Toamasina',
    2, 1,
    'Antananarivo', 'Toamasina',
    260.00,
    '2024-05-10 06:00:00', '2024-05-11 18:00:00', NULL,
    'en_cours',
    NULL,
    'Transport de médicaments urgents pour CHU Toamasina.'
  ),
  (
    'Inspection terrain — Antsirabe',
    1, 2,
    'Antananarivo', 'Antsirabe',
    170.00,
    '2024-05-15 07:00:00', '2024-05-15 20:00:00', NULL,
    'planifiee',
    NULL,
    'Visite de chantier avec le directeur régional.'
  ),
  (
    'Approvisionnement Fianarantsoa',
    3, 3,
    'Antananarivo', 'Fianarantsoa',
    405.00,
    '2024-04-20 05:00:00', '2024-04-22 18:00:00', '2024-04-22 16:30:00',
    'terminee',
    ROUND(405 * 0.08 * 5200, 2),
    'Mission complète sans incident.'
  );

-- Maintenances
INSERT INTO maintenances (vehicule_id, type, description, date_maintenance, cout, kilometrage_au_moment) VALUES
  (4, 'Vidange', 'Vidange huile moteur + filtre à huile',       '2023-11-05', 85000,  120000),
  (4, 'Freins',  'Remplacement plaquettes de freins avant',     '2024-01-10', 220000, 121500),
  (2, 'Vidange', 'Vidange huile + filtre air',                  '2024-01-20', 85000,  77000),
  (1, 'Vidange', 'Vidange préventive 5000 km',                  '2024-02-15', 85000,  44500),
  (3, 'CT',      'Contrôle technique annuel — résultat : OK',   '2024-03-10', 55000,   9200);

-- Alertes
INSERT INTO alertes (vehicule_id, type, message, est_lue) VALUES
  (4, 'Contrôle technique', 'Le contrôle technique du véhicule MAD-004-22 expire le 30/08/2024.', FALSE),
  (2, 'Contrôle technique', 'Le contrôle technique du véhicule MAD-002-24 expire le 15/12/2024.', FALSE),
  (4, 'Kilométrage vidange', 'Le véhicule MAD-004-22 dépasse 10 000 km depuis la dernière vidange.', FALSE);
