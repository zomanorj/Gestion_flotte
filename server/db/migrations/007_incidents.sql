-- =============================================================================
-- migrations/007_incidents.sql
-- Création de la table incidents — TransiFlow.
-- =============================================================================

CREATE TABLE IF NOT EXISTS incidents (
  id               SERIAL         PRIMARY KEY,
  mission_id       INTEGER        REFERENCES missions(id) ON DELETE SET NULL,
  vehicle_id       INTEGER        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id        INTEGER        REFERENCES drivers(id) ON DELETE SET NULL,
  type_incident    VARCHAR(50)    NOT NULL
                   CHECK (type_incident IN ('panne','accident','vol','infraction','retard','autre')),
  gravite          VARCHAR(20)    DEFAULT 'moyen'
                   CHECK (gravite IN ('faible','moyen','grave','critique')),
  statut           VARCHAR(20)    DEFAULT 'ouvert'
                   CHECK (statut IN ('ouvert','en_traitement','resolu','clos')),
  titre            VARCHAR(255)   NOT NULL,
  description      TEXT,
  lieu             TEXT,
  latitude         DECIMAL(10,8),
  longitude        DECIMAL(11,8),
  date_incident    TIMESTAMP      NOT NULL DEFAULT NOW(),
  date_resolution  TIMESTAMP,
  actions_prises   TEXT,
  cout_reparation  DECIMAL(12,2),
  numero_sinistre  VARCHAR(100),
  photos_urls      TEXT,
  declared_by      INTEGER        REFERENCES users(id) ON DELETE SET NULL,
  resolved_by      INTEGER        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP      DEFAULT NOW(),
  updated_at       TIMESTAMP      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_vehicle_id   ON incidents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_incidents_statut       ON incidents(statut);
CREATE INDEX IF NOT EXISTS idx_incidents_gravite      ON incidents(gravite);
CREATE INDEX IF NOT EXISTS idx_incidents_date         ON incidents(date_incident);
