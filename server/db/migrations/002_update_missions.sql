-- =============================================================================
-- migrations/002_update_missions.sql
-- Migration Sprint 4 : mise à jour de la table missions.
--
-- Ajoute les colonnes manquantes sans supprimer les données existantes.
--
-- Exécution : psql -U postgres -d transiflow_db -f server/db/migrations/002_update_missions.sql
-- ⚠️  Déjà appliquée sur l'environnement de développement le 2026-05-14
-- =============================================================================

BEGIN;

-- 1. Colonnes manquantes
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS heure_depart          TIME,
  ADD COLUMN IF NOT EXISTS heure_arrivee_prevue  TIME,
  ADD COLUMN IF NOT EXISTS poids_tonne           NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS distance_km           NUMERIC(8,1),
  ADD COLUMN IF NOT EXISTS notes                 TEXT,
  ADD COLUMN IF NOT EXISTS created_by            INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMP NOT NULL DEFAULT NOW();

-- 2. Supprimer l'ancienne contrainte statut
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_statut_check;

-- 3. Normaliser les statuts existants avant d'ajouter la nouvelle contrainte
UPDATE missions
  SET statut = 'planifiee'
  WHERE statut NOT IN ('brouillon','planifiee','en_cours','terminee','annulee');

-- 4. Nouvelle contrainte incluant 'brouillon'
ALTER TABLE missions
  ADD CONSTRAINT missions_statut_check
  CHECK (statut IN ('brouillon','planifiee','en_cours','terminee','annulee'));

COMMIT;
