-- =============================================================================
-- schema.sql
-- Schéma de la base de données PostgreSQL pour le système TransiFlow.
--
-- Ce fichier crée toutes les tables nécessaires à la gestion de flotte :
--   - users      : comptes utilisateurs et administrateurs
--   - vehicles   : véhicules de la flotte
--   - drivers    : profils des chauffeurs
--   - missions   : planification et suivi des missions de transport
--
-- Exécution : psql -U postgres -d transiflow_db -f schema.sql
-- =============================================================================

-- On supprime les tables si elles existent déjà (pour faciliter les re-créations en dev)
-- ATTENTION : en production, utiliser des migrations plutôt que DROP/CREATE
DROP TABLE IF EXISTS tracking  CASCADE;
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

COMMENT ON TABLE  users              IS 'Comptes utilisateurs du système TransiFlow';
COMMENT ON COLUMN users.role         IS 'admin = accès total | gestionnaire = flotte + missions | chauffeur = lecture seule';
COMMENT ON COLUMN users.mot_de_passe IS 'Toujours hashé avec bcrypt avant insertion';


-- =============================================================================
-- TABLE : vehicles
-- Inventaire des véhicules de la flotte TransiFlow.
-- =============================================================================
CREATE TABLE vehicles (
    id                     SERIAL       PRIMARY KEY,
    immatriculation        VARCHAR(20)  NOT NULL UNIQUE, -- Ex: MG-1234-TA
    type                   VARCHAR(50)  NOT NULL,         -- Ex: camion, citerne, pickup, autre
    capacite               INT          NOT NULL CHECK (capacite > 0),  -- Nombre de places ou charge max (tonnes)
    statut                 VARCHAR(30)  NOT NULL DEFAULT 'actif'
                                  CHECK (statut IN ('actif', 'en_revision', 'archive')),
    date_assurance         DATE,                          -- Date d'expiration de l'assurance
    date_visite_technique  DATE,                          -- Date de la visite technique
    kilometrage            INT          NOT NULL DEFAULT 0 CHECK (kilometrage >= 0),
    notes                  TEXT,                          -- Notes libres sur le véhicule
    created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  vehicles              IS 'Inventaire des véhicules de la flotte TransiFlow';
COMMENT ON COLUMN vehicles.capacite     IS 'Nombre de passagers ou charge utile en tonnes selon le type de véhicule';
COMMENT ON COLUMN vehicles.statut       IS 'actif = en service | en_revision = en maintenance | archive = hors service';


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
    statut                  VARCHAR(30)  NOT NULL DEFAULT 'actif'
                                         CHECK (statut IN ('actif', 'en_conge', 'inactif')),
    photo_url               VARCHAR(255),                    -- URL de la photo du chauffeur
    date_embauche           DATE,                            -- Date d'embauche
    notes                   TEXT,                            -- Notes libres sur le chauffeur
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  drivers                     IS 'Profils des chauffeurs de la flotte TransiFlow';
COMMENT ON COLUMN drivers.user_id             IS 'Référence optionnelle vers le compte utilisateur du chauffeur';
COMMENT ON COLUMN drivers.date_expiration_permis IS 'Une alerte devra être envoyée avant expiration du permis';


-- =============================================================================
-- TABLE : missions
-- Planification et suivi des missions de transport.
-- =============================================================================
CREATE TABLE missions (
    id                    SERIAL        PRIMARY KEY,
    vehicle_id            INT           NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id             INT           NOT NULL REFERENCES drivers(id)  ON DELETE RESTRICT,
    lieu_depart           VARCHAR(255)  NOT NULL,  -- Adresse ou nom du lieu de départ
    lieu_arrivee          VARCHAR(255)  NOT NULL,  -- Adresse ou nom de la destination
    date_mission          DATE          NOT NULL,  -- Date prévue de la mission
    heure_depart          TIME,                     -- Heure prévue de départ
    heure_arrivee_prevue  TIME,                     -- Heure prévue d'arrivée
    chargement            TEXT,                     -- Description du chargement ou des passagers
    poids_tonne           DECIMAL(8,2),             -- Poids du chargement en tonnes
    distance_km           INT           CHECK (distance_km >= 0),  -- Distance en kilomètres
    statut                VARCHAR(30)   NOT NULL DEFAULT 'brouillon'
                                  CHECK (statut IN ('brouillon', 'planifiee', 'en_cours', 'terminee', 'annulee')),
    notes                 TEXT,                     -- Notes libres sur la mission
    created_by            INT           REFERENCES users(id) ON DELETE SET NULL,  -- Utilisateur ayant créé la mission
    created_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP     NOT NULL DEFAULT NOW()
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


-- =============================================================================
-- TABLE : tracking
-- Suivi GPS des positions des véhicules pendant les missions.
-- =============================================================================

CREATE TABLE tracking (
    id          SERIAL           PRIMARY KEY,
    mission_id  INT              NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    latitude    DECIMAL(10, 8)   NOT NULL,
    longitude   DECIMAL(11, 8)   NOT NULL,
    vitesse     INT              DEFAULT 0 CHECK (vitesse >= 0),  -- Vitesse en km/h
    horodatage  TIMESTAMP        DEFAULT NOW(),                   -- Horodatage de la position
    created_at  TIMESTAMP        DEFAULT NOW()
);

COMMENT ON TABLE  tracking              IS 'Suivi GPS des positions des véhicules pendant les missions';
COMMENT ON COLUMN tracking.mission_id   IS 'Référence à la mission en cours';
COMMENT ON COLUMN tracking.vitesse      IS 'Vitesse du véhicule en km/h au moment du relevé';
COMMENT ON COLUMN tracking.horodatage   IS 'Horodatage de la position GPS (peut différer de created_at)';

-- Index pour les requêtes fréquentes
CREATE INDEX idx_tracking_mission_id    ON tracking(mission_id);
CREATE INDEX idx_tracking_horodatage    ON tracking(horodatage);
CREATE INDEX idx_tracking_mission_time  ON tracking(mission_id, horodatage DESC);
