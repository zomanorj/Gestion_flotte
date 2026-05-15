-- =============================================================================
-- migrations/005_finance.sql
-- Création des tables pour la gestion financière — TransiFlow.
--
-- Tables créées :
--   depenses  — dépenses liées aux missions et véhicules
--   budgets   — budgets mensuels par véhicule
--
-- Idempotent : CREATE TABLE IF NOT EXISTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS depenses (
  id               SERIAL          PRIMARY KEY,
  mission_id       INTEGER         REFERENCES missions(id) ON DELETE SET NULL,
  vehicle_id       INTEGER         REFERENCES vehicles(id) ON DELETE SET NULL,
  categorie        VARCHAR(50)     NOT NULL
                   CHECK (categorie IN ('carburant','peage','salaire','maintenance','autre')),
  montant          DECIMAL(12,2)   NOT NULL CHECK (montant > 0),
  devise           VARCHAR(10)     DEFAULT 'MGA',
  description      TEXT,
  date_depense     DATE            NOT NULL DEFAULT CURRENT_DATE,
  justificatif_url TEXT,
  created_by       INTEGER         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP       DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_depenses_mission_id   ON depenses(mission_id);
CREATE INDEX IF NOT EXISTS idx_depenses_vehicle_id   ON depenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_depenses_date         ON depenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_depenses_categorie    ON depenses(categorie);
