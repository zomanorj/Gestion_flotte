-- server/db/migrations/010_salaires.sql

-- 1. Ajout des colonnes salaire_base et prime_mission à la table drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS salaire_base NUMERIC(15,2) DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS prime_mission NUMERIC(15,2) DEFAULT 0;

-- 2. Création de la table salaires
CREATE TABLE IF NOT EXISTS salaires (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  mission_id INTEGER REFERENCES missions(id) ON DELETE SET NULL,
  type_salaire VARCHAR(20) DEFAULT 'mission', -- 'fixe', 'mission', 'bonus'
  montant NUMERIC(15,2) NOT NULL,
  date_paiement DATE,
  statut VARCHAR(20) DEFAULT 'en_attente', -- 'en_attente', 'paye', 'annule'
  mois_concerne VARCHAR(10), -- ex: 'YYYY-MM'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
