-- Migration 014 : colonnes supplémentaires sur users + deleted_by sur tables soft-delete
-- TransiFlow — Sprint 9

-- Ajouter les colonnes manquantes sur la table users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS statut VARCHAR(20) DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES drivers(id),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS telephone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Ajouter deleted_by sur les tables soft-deletables (traçabilité corbeille)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE drivers  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
