-- Ajout des colonnes de géolocalisation sur les missions
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS depart_lat DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS depart_lng DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS arrivee_lat DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS arrivee_lng DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS trajet_points TEXT;
