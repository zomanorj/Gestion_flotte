-- =============================================================================
-- migrations/001_update_vehicles.sql
-- Migration Sprint 2 : mise à jour de la table vehicles.
--
-- Ajoute les colonnes manquantes sans supprimer les données existantes.
-- IMPORTANT : la mise à jour des statuts doit précéder l'ajout de la contrainte.
--
-- Exécution : psql -U postgres -d transport_stta -f server/db/migrations/001_update_vehicles.sql
-- ⚠️  Déjà appliquée sur l'environnement de développement le 2026-05-14
-- =============================================================================

BEGIN;

-- 1. Ajouter les colonnes manquantes (IF NOT EXISTS = sans erreur si déjà présentes)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS date_visite_technique DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- 2. Supprimer l'ancienne contrainte de statut (anciens valeurs : disponible, en_mission…)
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_statut_check;

-- 3. Mettre à jour les lignes existantes AVANT d'ajouter la nouvelle contrainte
UPDATE vehicles SET statut = 'actif'       WHERE statut = 'disponible';
UPDATE vehicles SET statut = 'en_revision' WHERE statut IN ('en_mission', 'en_maintenance');
UPDATE vehicles SET statut = 'archive'     WHERE statut = 'hors_service';

-- 4. Appliquer la nouvelle contrainte (actif, en_revision, archive)
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_statut_check
  CHECK (statut IN ('actif', 'en_revision', 'archive'));

-- 5. Changer la valeur par défaut du statut
ALTER TABLE vehicles ALTER COLUMN statut SET DEFAULT 'actif';

COMMIT;
