-- =============================================================================
-- migrations/006_maintenance.sql
-- Création des tables pour la maintenance préventive — TransiFlow.
-- =============================================================================

CREATE TABLE IF NOT EXISTS maintenances (
  id                        SERIAL        PRIMARY KEY,
  vehicle_id                INTEGER       NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type_maintenance          VARCHAR(50)   NOT NULL
                            CHECK (type_maintenance IN
                              ('revision','vidange','pneus','freins','courroie','filtres','autre')),
  statut                    VARCHAR(20)   DEFAULT 'planifiee'
                            CHECK (statut IN ('planifiee','en_cours','terminee','annulee')),
  date_planifiee            DATE,
  date_realisee             DATE,
  kilometrage_planifie      INTEGER,
  kilometrage_realise       INTEGER,
  cout                      DECIMAL(12,2),
  garage                    TEXT,
  description               TEXT,
  pieces_changees           TEXT,
  prochaine_maintenance_km  INTEGER,
  prochaine_maintenance_date DATE,
  created_by                INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at                TIMESTAMP     DEFAULT NOW(),
  updated_at                TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alertes_maintenance (
  id           SERIAL       PRIMARY KEY,
  vehicle_id   INTEGER      NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type_alerte  VARCHAR(50)  NOT NULL,
  message      TEXT         NOT NULL,
  km_restants  INTEGER,
  jours_restants INTEGER,
  is_read      BOOLEAN      DEFAULT FALSE,
  created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle_id    ON maintenances(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_statut        ON maintenances(statut);
CREATE INDEX IF NOT EXISTS idx_maintenances_date          ON maintenances(date_planifiee);
CREATE INDEX IF NOT EXISTS idx_alertes_maint_vehicle_id   ON alertes_maintenance(vehicle_id);
