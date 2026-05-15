-- =============================================================================
-- migrations/003_add_tracking.sql
-- Migration Sprint 5 : création de la table tracking (suivi GPS).
--
-- Crée la table tracking si elle n'existe pas encore.
-- Idempotent : peut être exécutée plusieurs fois sans erreur.
--
-- Exécution : psql -U postgres -d transiflow_db -f server/db/migrations/003_add_tracking.sql
-- =============================================================================

BEGIN;

-- Création de la table tracking (si absente)
CREATE TABLE IF NOT EXISTS tracking (
    id          SERIAL           PRIMARY KEY,
    mission_id  INT              NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    latitude    DECIMAL(10, 8)   NOT NULL,
    longitude   DECIMAL(11, 8)   NOT NULL,
    vitesse     INT              DEFAULT 0 CHECK (vitesse >= 0),
    horodatage  TIMESTAMP        DEFAULT NOW(),
    created_at  TIMESTAMP        DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_tracking_mission_id    ON tracking(mission_id);
CREATE INDEX IF NOT EXISTS idx_tracking_horodatage    ON tracking(horodatage);
CREATE INDEX IF NOT EXISTS idx_tracking_mission_time  ON tracking(mission_id, horodatage DESC);

COMMIT;
