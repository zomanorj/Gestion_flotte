-- =============================================================================
-- export_schema.sql
-- Schéma complet de la base de données TransiFlow — version production.
--
-- Usage : coller dans l'éditeur SQL de Neon.tech (ou psql) pour initialiser
--         la BDD de production. Toutes les instructions sont idempotentes.
--
-- Généré depuis : schema.sql + migrations 001-016
--
-- ORDRE STRICT :
--   1. CREATE TABLE  (dans l'ordre des dépendances FK)
--   2. ALTER TABLE   (colonnes ajoutées par migrations)
--   3. CREATE INDEX
--   4. CREATE OR REPLACE VIEW
--   5. INSERT        (données de test)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CREATE TABLE — ordre respectant les dépendances FK
-- ─────────────────────────────────────────────────────────────────────────────

-- users (aucune FK)
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL       PRIMARY KEY,
  nom          VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  role         VARCHAR(50)  NOT NULL DEFAULT 'gestionnaire'
               CHECK (role IN ('admin', 'gestionnaire', 'chauffeur')),
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- vehicles (aucune FK)
CREATE TABLE IF NOT EXISTS vehicles (
  id                    SERIAL       PRIMARY KEY,
  immatriculation       VARCHAR(20)  NOT NULL UNIQUE,
  type                  VARCHAR(50)  NOT NULL,
  capacite              INT          NOT NULL CHECK (capacite > 0),
  statut                VARCHAR(30)  NOT NULL DEFAULT 'actif'
                        CHECK (statut IN ('actif', 'en_revision', 'archive')),
  date_assurance        DATE,
  date_visite_technique DATE,
  kilometrage           INT          NOT NULL DEFAULT 0 CHECK (kilometrage >= 0),
  notes                 TEXT,
  created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- drivers (FK → users)
CREATE TABLE IF NOT EXISTS drivers (
  id                     SERIAL       PRIMARY KEY,
  user_id                INT          REFERENCES users(id) ON DELETE SET NULL,
  nom                    VARCHAR(100) NOT NULL,
  prenom                 VARCHAR(100) NOT NULL,
  telephone              VARCHAR(20),
  numero_permis          VARCHAR(50)  NOT NULL UNIQUE,
  date_expiration_permis DATE         NOT NULL,
  statut                 VARCHAR(30)  NOT NULL DEFAULT 'actif'
                         CHECK (statut IN ('actif', 'en_conge', 'inactif')),
  photo_url              VARCHAR(255),
  date_embauche          DATE,
  notes                  TEXT,
  created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- clients (aucune FK)
CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL        PRIMARY KEY,
  type_client   VARCHAR(20)   DEFAULT 'entreprise',
  nom           VARCHAR(255)  NOT NULL,
  nom_contact   VARCHAR(255),
  telephone     VARCHAR(50),
  telephone2    VARCHAR(50),
  email         VARCHAR(255),
  adresse       TEXT,
  ville         VARCHAR(100),
  nif           VARCHAR(100),
  stat          VARCHAR(100),
  notes         TEXT,
  statut        VARCHAR(20)   DEFAULT 'actif',
  solde_credit  DECIMAL(15,2) DEFAULT 0.00,
  created_at    TIMESTAMP     DEFAULT NOW(),
  updated_at    TIMESTAMP     DEFAULT NOW()
);

-- missions (FK → vehicles, drivers, users, clients)
CREATE TABLE IF NOT EXISTS missions (
  id                   SERIAL        PRIMARY KEY,
  vehicle_id           INT           NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_id            INT           NOT NULL REFERENCES drivers(id)  ON DELETE RESTRICT,
  client_id            INTEGER       REFERENCES clients(id),
  lieu_depart          VARCHAR(255)  NOT NULL,
  lieu_arrivee         VARCHAR(255)  NOT NULL,
  date_mission         DATE          NOT NULL,
  heure_depart         TIME,
  heure_arrivee_prevue TIME,
  chargement           TEXT,
  poids_tonne          DECIMAL(8,2),
  distance_km          NUMERIC(8,1)  CHECK (distance_km >= 0),
  statut               VARCHAR(30)   NOT NULL DEFAULT 'brouillon'
                       CHECK (statut IN ('brouillon','planifiee','en_cours','terminee','annulee')),
  notes                TEXT,
  created_by           INT           REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- tracking (FK → missions)
CREATE TABLE IF NOT EXISTS tracking (
  id          SERIAL         PRIMARY KEY,
  mission_id  INT            NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  latitude    DECIMAL(10, 8) NOT NULL,
  longitude   DECIMAL(11, 8) NOT NULL,
  vitesse     INT            DEFAULT 0 CHECK (vitesse >= 0),
  horodatage  TIMESTAMP      DEFAULT NOW(),
  created_at  TIMESTAMP      DEFAULT NOW()
);

-- depenses (FK → missions, vehicles, users)
CREATE TABLE IF NOT EXISTS depenses (
  id               SERIAL        PRIMARY KEY,
  mission_id       INTEGER       REFERENCES missions(id) ON DELETE SET NULL,
  vehicle_id       INTEGER       REFERENCES vehicles(id) ON DELETE SET NULL,
  categorie        VARCHAR(50)   NOT NULL
                   CHECK (categorie IN ('carburant','peage','salaire','maintenance','autre')),
  montant          DECIMAL(12,2) NOT NULL CHECK (montant > 0),
  devise           VARCHAR(10)   DEFAULT 'MGA',
  description      TEXT,
  date_depense     DATE          NOT NULL DEFAULT CURRENT_DATE,
  justificatif_url TEXT,
  created_by       INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP     DEFAULT NOW()
);

-- budgets (FK → vehicles)
CREATE TABLE IF NOT EXISTS budgets (
  id                  SERIAL        PRIMARY KEY,
  vehicle_id          INTEGER       REFERENCES vehicles(id) ON DELETE CASCADE,
  mois                INTEGER       NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee               INTEGER       NOT NULL CHECK (annee >= 2020),
  budget_carburant    DECIMAL(12,2) DEFAULT 0,
  budget_maintenance  DECIMAL(12,2) DEFAULT 0,
  budget_total        DECIMAL(12,2) DEFAULT 0,
  created_at          TIMESTAMP     DEFAULT NOW(),
  UNIQUE (vehicle_id, mois, annee)
);

-- maintenances (FK → vehicles, users)
CREATE TABLE IF NOT EXISTS maintenances (
  id                         SERIAL        PRIMARY KEY,
  vehicle_id                 INTEGER       NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type_maintenance           VARCHAR(50)   NOT NULL
                             CHECK (type_maintenance IN
                               ('revision','vidange','pneus','freins','courroie','filtres','autre')),
  statut                     VARCHAR(20)   DEFAULT 'planifiee'
                             CHECK (statut IN ('planifiee','en_cours','terminee','annulee')),
  date_planifiee             DATE,
  date_realisee              DATE,
  kilometrage_planifie       INTEGER,
  kilometrage_realise        INTEGER,
  cout                       DECIMAL(12,2),
  garage                     TEXT,
  description                TEXT,
  pieces_changees            TEXT,
  prochaine_maintenance_km   INTEGER,
  prochaine_maintenance_date DATE,
  created_by                 INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at                 TIMESTAMP     DEFAULT NOW(),
  updated_at                 TIMESTAMP     DEFAULT NOW()
);

-- alertes_maintenance (FK → vehicles)
CREATE TABLE IF NOT EXISTS alertes_maintenance (
  id             SERIAL      PRIMARY KEY,
  vehicle_id     INTEGER     NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type_alerte    VARCHAR(50) NOT NULL,
  message        TEXT        NOT NULL,
  km_restants    INTEGER,
  jours_restants INTEGER,
  is_read        BOOLEAN     DEFAULT FALSE,
  created_at     TIMESTAMP   DEFAULT NOW()
);

-- incidents (FK → missions, vehicles, drivers, users)
CREATE TABLE IF NOT EXISTS incidents (
  id              SERIAL         PRIMARY KEY,
  mission_id      INTEGER        REFERENCES missions(id) ON DELETE SET NULL,
  vehicle_id      INTEGER        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id       INTEGER        REFERENCES drivers(id) ON DELETE SET NULL,
  type_incident   VARCHAR(50)    NOT NULL
                  CHECK (type_incident IN ('panne','accident','vol','infraction','retard','autre')),
  gravite         VARCHAR(20)    DEFAULT 'moyen'
                  CHECK (gravite IN ('faible','moyen','grave','critique')),
  statut          VARCHAR(20)    DEFAULT 'ouvert'
                  CHECK (statut IN ('ouvert','en_traitement','resolu','clos')),
  titre           VARCHAR(255)   NOT NULL,
  description     TEXT,
  lieu            TEXT,
  latitude        DECIMAL(10,8),
  longitude       DECIMAL(11,8),
  date_incident   TIMESTAMP      NOT NULL DEFAULT NOW(),
  date_resolution TIMESTAMP,
  actions_prises  TEXT,
  cout_reparation DECIMAL(12,2),
  numero_sinistre VARCHAR(100),
  photos_urls     TEXT,
  declared_by     INTEGER        REFERENCES users(id) ON DELETE SET NULL,
  resolved_by     INTEGER        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP      DEFAULT NOW(),
  updated_at      TIMESTAMP      DEFAULT NOW()
);

-- factures (FK → clients, missions, users)
CREATE TABLE IF NOT EXISTS factures (
  id                  SERIAL        PRIMARY KEY,
  numero              VARCHAR(50)   UNIQUE NOT NULL,
  client_id           INTEGER       NOT NULL REFERENCES clients(id),
  mission_id          INTEGER       REFERENCES missions(id),
  statut              VARCHAR(20)   DEFAULT 'brouillon',
  date_emission       DATE          DEFAULT CURRENT_DATE,
  date_echeance       DATE,
  montant_ht          DECIMAL(12,2) NOT NULL,
  taux_tva            DECIMAL(5,2)  DEFAULT 20.00,
  montant_tva         DECIMAL(12,2),
  montant_ttc         DECIMAL(12,2),
  description         TEXT,
  conditions_paiement TEXT,
  date_paiement       DATE,
  mode_paiement       VARCHAR(50),
  notes               TEXT,
  created_by          INTEGER       REFERENCES users(id),
  created_at          TIMESTAMP     DEFAULT NOW(),
  updated_at          TIMESTAMP     DEFAULT NOW()
);

-- paiements (FK → factures, users)
CREATE TABLE IF NOT EXISTS paiements (
  id             SERIAL        PRIMARY KEY,
  facture_id     INTEGER       NOT NULL REFERENCES factures(id),
  montant        DECIMAL(12,2) NOT NULL,
  date_paiement  DATE          NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement  VARCHAR(50)   NOT NULL,
  reference      VARCHAR(100),
  notes          TEXT,
  created_by     INTEGER       REFERENCES users(id),
  created_at     TIMESTAMP     DEFAULT NOW()
);

-- client_transactions (FK → clients, factures)
CREATE TABLE IF NOT EXISTS client_transactions (
  id               SERIAL        PRIMARY KEY,
  client_id        INT           NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  facture_id       INT           REFERENCES factures(id) ON DELETE SET NULL,
  type_transaction VARCHAR(20)   NOT NULL,
  montant          DECIMAL(15,2) NOT NULL,
  description      TEXT,
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- salaires (FK → drivers, missions)
CREATE TABLE IF NOT EXISTS salaires (
  id            SERIAL        PRIMARY KEY,
  driver_id     INTEGER       NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  mission_id    INTEGER       REFERENCES missions(id) ON DELETE SET NULL,
  type_salaire  VARCHAR(20)   DEFAULT 'mission',
  montant       NUMERIC(15,2) NOT NULL,
  date_paiement DATE,
  statut        VARCHAR(20)   DEFAULT 'en_attente',
  mois_concerne VARCHAR(10),
  notes         TEXT,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- journal_activite (FK → users)
CREATE TABLE IF NOT EXISTS journal_activite (
  id            SERIAL       PRIMARY KEY,
  user_id       INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  entite        VARCHAR(50),
  entite_id     INTEGER,
  description   TEXT         NOT NULL,
  donnees_avant JSONB,
  donnees_apres JSONB,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMP    DEFAULT NOW()
);

-- contrats (FK → clients, users)
CREATE TABLE IF NOT EXISTS contrats (
  id                        SERIAL        PRIMARY KEY,
  client_id                 INTEGER       NOT NULL REFERENCES clients(id),
  numero                    VARCHAR(50)   UNIQUE NOT NULL,
  titre                     VARCHAR(255)  NOT NULL,
  statut                    VARCHAR(20)   DEFAULT 'actif',
  date_debut                DATE          NOT NULL,
  date_fin                  DATE,
  tarif_km                  DECIMAL(10,2),
  tarif_mission             DECIMAL(12,2),
  conditions_paiement       TEXT,
  delai_paiement_jours      INTEGER       DEFAULT 30,
  remise_pourcentage        DECIMAL(5,2)  DEFAULT 0,
  notes                     TEXT,
  renouvellement_auto       BOOLEAN       DEFAULT FALSE,
  duree_renouvellement_mois INTEGER       DEFAULT 12,
  created_by                INTEGER       REFERENCES users(id),
  created_at                TIMESTAMP     DEFAULT NOW(),
  updated_at                TIMESTAMP     DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ALTER TABLE — colonnes ajoutées par les migrations
--    Toutes les tables existent à ce stade → aucune FK ne manque
-- ─────────────────────────────────────────────────────────────────────────────

-- Coordonnées GPS sur missions (migration 004)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS depart_lat    DECIMAL(10,8);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS depart_lng    DECIMAL(11,8);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS arrivee_lat   DECIMAL(10,8);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS arrivee_lng   DECIMAL(11,8);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS trajet_points TEXT;

-- Contrainte statut missions (idempotent)
DO $$ BEGIN
  ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_statut_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE missions ADD CONSTRAINT missions_statut_check
  CHECK (statut IN ('brouillon','planifiee','en_cours','terminee','annulee'));

-- Salaire de base et prime sur drivers (migration 010)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS salaire_base  NUMERIC(15,2) DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS prime_mission NUMERIC(15,2) DEFAULT 0;

-- Soft-delete : colonne deleted_at sur toutes les tables concernées (migration 011)
ALTER TABLE users     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE vehicles  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE drivers   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE missions  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE clients   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE factures  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE salaires  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Traçabilité corbeille : colonne deleted_by (migration 014)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE drivers  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- Profil utilisateur étendu (migration 014)
ALTER TABLE users ADD COLUMN IF NOT EXISTS statut            VARCHAR(20)  DEFAULT 'actif';
ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_id         INTEGER      REFERENCES drivers(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telephone         VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP    DEFAULT NOW();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CREATE INDEX
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_missions_vehicle_id    ON missions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_missions_driver_id     ON missions(driver_id);
CREATE INDEX IF NOT EXISTS idx_missions_date          ON missions(date_mission);
CREATE INDEX IF NOT EXISTS idx_missions_statut        ON missions(statut);
CREATE INDEX IF NOT EXISTS idx_missions_client_id     ON missions(client_id);
CREATE INDEX IF NOT EXISTS idx_drivers_statut         ON drivers(statut);
CREATE INDEX IF NOT EXISTS idx_vehicles_statut        ON vehicles(statut);
CREATE INDEX IF NOT EXISTS idx_tracking_mission_id    ON tracking(mission_id);
CREATE INDEX IF NOT EXISTS idx_tracking_horodatage    ON tracking(horodatage);
CREATE INDEX IF NOT EXISTS idx_tracking_mission_time  ON tracking(mission_id, horodatage DESC);
CREATE INDEX IF NOT EXISTS idx_depenses_mission_id    ON depenses(mission_id);
CREATE INDEX IF NOT EXISTS idx_depenses_vehicle_id    ON depenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_depenses_date          ON depenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_depenses_categorie     ON depenses(categorie);
CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle   ON maintenances(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_statut    ON maintenances(statut);
CREATE INDEX IF NOT EXISTS idx_maintenances_date      ON maintenances(date_planifiee);
CREATE INDEX IF NOT EXISTS idx_incidents_vehicle_id   ON incidents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_incidents_statut       ON incidents(statut);
CREATE INDEX IF NOT EXISTS idx_incidents_gravite      ON incidents(gravite);
CREATE INDEX IF NOT EXISTS idx_incidents_date         ON incidents(date_incident);
CREATE INDEX IF NOT EXISTS idx_factures_client_id     ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut        ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_factures_date_emission ON factures(date_emission);
CREATE INDEX IF NOT EXISTS idx_paiements_facture_id   ON paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_salaires_driver_id     ON salaires(driver_id);
CREATE INDEX IF NOT EXISTS idx_salaires_mission_id    ON salaires(mission_id);
CREATE INDEX IF NOT EXISTS idx_salaires_mois_concerne ON salaires(mois_concerne);
CREATE INDEX IF NOT EXISTS idx_journal_user_id        ON journal_activite(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entite         ON journal_activite(entite, entite_id);
CREATE INDEX IF NOT EXISTS idx_journal_created_at     ON journal_activite(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contrats_client        ON contrats(client_id);
CREATE INDEX IF NOT EXISTS idx_contrats_statut        ON contrats(statut);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CREATE OR REPLACE VIEW
--    (toutes les tables et colonnes requises existent à ce stade)
-- ─────────────────────────────────────────────────────────────────────────────

-- Vue solde restant par facture (basée sur les paiements progressifs)
CREATE OR REPLACE VIEW factures_solde AS
SELECT
  f.id,
  f.numero,
  f.montant_ttc,
  COALESCE(SUM(p.montant), 0)                             AS montant_paye,
  f.montant_ttc - COALESCE(SUM(p.montant), 0)             AS solde_restant,
  CASE
    WHEN COALESCE(SUM(p.montant), 0) = 0              THEN 'non_paye'
    WHEN COALESCE(SUM(p.montant), 0) >= f.montant_ttc THEN 'paye'
    ELSE                                                   'partiel'
  END AS etat_paiement
FROM factures f
LEFT JOIN paiements p ON p.facture_id = f.id
GROUP BY f.id, f.numero, f.montant_ttc;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INSERT — données initiales (comptes de test)
--    Mots de passe hashés bcrypt coût 10 :
--      admin@transiflow.app        → Admin123!
--      gestionnaire@transiflow.app → Gest123!
--      chauffeur@transiflow.app    → Chauf123!
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO users (nom, email, mot_de_passe, role, statut)
VALUES
  ('Administrateur',
   'admin@transiflow.app',
   '$2b$10$CXpLuxqdCmOHCl0OYnHCvO1YXtmkK.ATJ0Ht.OCVymjfrM4uk0gge',
   'admin',        'actif'),
  ('Gestionnaire',
   'gestionnaire@transiflow.app',
   '$2b$10$WD41ULnjf2QDPjs/hNqJzuA9kbTLc7TFnkWsCkSBC1A9961zx9H46',
   'gestionnaire', 'actif'),
  ('Chauffeur Test',
   'chauffeur@transiflow.app',
   '$2b$10$65pbJE.3NqXu4VNPLuQVy.P7GVUCWhKLdRkpHPDpPK2iQVhxk670O',
   'chauffeur',    'actif')
ON CONFLICT (email) DO NOTHING;
