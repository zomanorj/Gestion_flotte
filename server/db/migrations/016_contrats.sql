-- Migration 016 : table contrats clients
-- TransiFlow — Sprint 9

CREATE TABLE IF NOT EXISTS contrats (
  id                        SERIAL PRIMARY KEY,
  client_id                 INTEGER REFERENCES clients(id) NOT NULL,
  numero                    VARCHAR(50) UNIQUE NOT NULL,
  titre                     VARCHAR(255) NOT NULL,
  statut                    VARCHAR(20) DEFAULT 'actif',
  date_debut                DATE NOT NULL,
  date_fin                  DATE,
  tarif_km                  DECIMAL(10,2),
  tarif_mission             DECIMAL(12,2),
  conditions_paiement       TEXT,
  delai_paiement_jours      INTEGER DEFAULT 30,
  remise_pourcentage        DECIMAL(5,2) DEFAULT 0,
  notes                     TEXT,
  renouvellement_auto       BOOLEAN DEFAULT FALSE,
  duree_renouvellement_mois INTEGER DEFAULT 12,
  created_by                INTEGER REFERENCES users(id),
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contrats_client ON contrats(client_id);
