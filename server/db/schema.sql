-- =============================================================================
-- schema.sql
-- Schéma de la base de données PostgreSQL pour le système Transport STTA.
--
-- Ce fichier crée toutes les tables nécessaires à la gestion de flotte :
--   - users      : comptes utilisateurs et administrateurs
--   - vehicles   : véhicules de la flotte
--   - drivers    : profils des chauffeurs
--   - missions   : planification et suivi des missions de transport
--
-- Exécution : psql -U postgres -d transport_stta -f schema.sql
-- =============================================================================

-- On supprime les tables si elles existent déjà (pour faciliter les re-créations en dev)
-- ATTENTION : en production, utiliser des migrations plutôt que DROP/CREATE
DROP TABLE IF EXISTS missions  CASCADE;
DROP TABLE IF EXISTS drivers   CASCADE;
DROP TABLE IF EXISTS vehicles  CASCADE;
DROP TABLE IF EXISTS users     CASCADE;

-- Extension pour générer des UUID (optionnel, on utilise SERIAL ici)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- TABLE : users
-- Stocke les comptes des utilisateurs du système (admins, gestionnaires, etc.)
-- =============================================================================
CREATE TABLE users (
    id           SERIAL       PRIMARY KEY,
    nom          VARCHAR(100) NOT NULL,
    email        VARCHAR(150) NOT NULL UNIQUE,
    mot_de_passe VARCHAR(255) NOT NULL,           -- Stocké hashé avec bcrypt
    role         VARCHAR(50)  NOT NULL DEFAULT 'gestionnaire'
                              CHECK (role IN ('admin', 'gestionnaire', 'chauffeur')),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users              IS 'Comptes utilisateurs du système Transport STTA';
COMMENT ON COLUMN users.role         IS 'admin = accès total | gestionnaire = flotte + missions | chauffeur = lecture seule';
COMMENT ON COLUMN users.mot_de_passe IS 'Toujours hashé avec bcrypt avant insertion';


-- =============================================================================
-- TABLE : vehicles
-- Inventaire des véhicules de la flotte STTA.
-- =============================================================================
CREATE TABLE vehicles (
    id               SERIAL       PRIMARY KEY,
    immatriculation  VARCHAR(20)  NOT NULL UNIQUE, -- Ex: MG-1234-TA
    type             VARCHAR(50)  NOT NULL,         -- Ex: Minibus, Camionnette, Berline
    capacite         INT          NOT NULL CHECK (capacite > 0),  -- Nombre de places ou charge max (kg)
    statut           VARCHAR(30)  NOT NULL DEFAULT 'disponible'
                                  CHECK (statut IN ('disponible', 'en_mission', 'en_maintenance', 'hors_service')),
    date_assurance   DATE,                          -- Date d'expiration de l'assurance
    kilometrage      INT          NOT NULL DEFAULT 0 CHECK (kilometrage >= 0),
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  vehicles              IS 'Inventaire des véhicules de la flotte STTA';
COMMENT ON COLUMN vehicles.capacite     IS 'Nombre de passagers ou charge utile en kg selon le type de véhicule';
COMMENT ON COLUMN vehicles.statut       IS 'disponible | en_mission | en_maintenance | hors_service';


-- =============================================================================
-- TABLE : drivers
-- Profils des chauffeurs, liés à un compte utilisateur (users.id).
-- =============================================================================
CREATE TABLE drivers (
    id                      SERIAL       PRIMARY KEY,
    user_id                 INT          REFERENCES users(id) ON DELETE SET NULL,  -- Compte de connexion associé
    nom                     VARCHAR(100) NOT NULL,
    prenom                  VARCHAR(100) NOT NULL,
    telephone               VARCHAR(20),
    numero_permis           VARCHAR(50)  NOT NULL UNIQUE,   -- Numéro de permis de conduire
    date_expiration_permis  DATE         NOT NULL,           -- Date d'expiration du permis
    statut                  VARCHAR(30)  NOT NULL DEFAULT 'disponible'
                                         CHECK (statut IN ('disponible', 'en_mission', 'en_conge', 'inactif')),
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  drivers                     IS 'Profils des chauffeurs de la flotte STTA';
COMMENT ON COLUMN drivers.user_id             IS 'Référence optionnelle vers le compte utilisateur du chauffeur';
COMMENT ON COLUMN drivers.date_expiration_permis IS 'Une alerte devra être envoyée avant expiration du permis';


-- =============================================================================
-- TABLE : missions
-- Planification et suivi des missions de transport.
-- =============================================================================
CREATE TABLE missions (
    id            SERIAL       PRIMARY KEY,
    vehicle_id    INT          NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id     INT          NOT NULL REFERENCES drivers(id)  ON DELETE RESTRICT,
    lieu_depart   VARCHAR(255) NOT NULL,  -- Adresse ou nom du lieu de départ
    lieu_arrivee  VARCHAR(255) NOT NULL,  -- Adresse ou nom de la destination
    date_mission  TIMESTAMP    NOT NULL,  -- Date et heure prévues de départ
    chargement    TEXT,                   -- Description du chargement ou des passagers
    statut        VARCHAR(30)  NOT NULL DEFAULT 'planifiee'
                               CHECK (statut IN ('planifiee', 'en_cours', 'terminee', 'annulee')),
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  missions           IS 'Missions de transport planifiées ou réalisées';
COMMENT ON COLUMN missions.chargement IS 'Description libre : passagers, marchandises, matériel, etc.';
COMMENT ON COLUMN missions.statut    IS 'planifiee | en_cours | terminee | annulee';


-- =============================================================================
-- Index pour améliorer les performances des requêtes fréquentes
-- =============================================================================

-- Recherche de missions par véhicule ou par chauffeur
CREATE INDEX idx_missions_vehicle_id ON missions(vehicle_id);
CREATE INDEX idx_missions_driver_id  ON missions(driver_id);

-- Filtrage des missions par date
CREATE INDEX idx_missions_date       ON missions(date_mission);

-- Recherche de chauffeurs par statut
CREATE INDEX idx_drivers_statut      ON drivers(statut);

-- Recherche de véhicules par statut
CREATE INDEX idx_vehicles_statut     ON vehicles(statut);
