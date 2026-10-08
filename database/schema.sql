-- ============================================================
-- Système de Gestion de Flotte de Camions — Madagascar
-- Script de création de la base de données (structure uniquement)
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

-- Les données de démonstration sont dans seed_demo.sql (à ne pas exécuter en production).
