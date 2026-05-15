-- Table clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  type_client VARCHAR(20) DEFAULT 'entreprise',
  -- 'entreprise' | 'particulier' | 'administration'
  nom VARCHAR(255) NOT NULL,
  nom_contact VARCHAR(255),       -- interlocuteur principal
  telephone VARCHAR(50),
  telephone2 VARCHAR(50),         -- téléphone secondaire
  email VARCHAR(255),
  adresse TEXT,
  ville VARCHAR(100),
  nif VARCHAR(100),               -- Numéro fiscal Madagascar
  stat VARCHAR(100),              -- Numéro STAT Madagascar
  notes TEXT,
  statut VARCHAR(20) DEFAULT 'actif',
  -- 'actif' | 'inactif' | 'suspendu'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Lier les missions aux clients
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS client_id
  INTEGER REFERENCES clients(id);

-- Table factures
CREATE TABLE IF NOT EXISTS factures (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(50) UNIQUE NOT NULL,
  -- Format : FAC-2026-0001
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  mission_id INTEGER REFERENCES missions(id),
  statut VARCHAR(20) DEFAULT 'brouillon',
  -- 'brouillon' | 'envoyee' | 'payee' | 'annulee'
  date_emission DATE DEFAULT CURRENT_DATE,
  date_echeance DATE,
  montant_ht DECIMAL(12,2) NOT NULL,
  taux_tva DECIMAL(5,2) DEFAULT 20.00,  -- TVA Madagascar
  montant_tva DECIMAL(12,2),
  montant_ttc DECIMAL(12,2),
  description TEXT,
  conditions_paiement TEXT,
  date_paiement DATE,
  mode_paiement VARCHAR(50),
  -- 'virement' | 'especes' | 'cheque' | 'mvola'
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
