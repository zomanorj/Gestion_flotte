-- server/db/migrations/012_credit_client.sql

-- 1. Ajouter le solde de crédit au client
ALTER TABLE clients ADD COLUMN IF NOT EXISTS solde_credit DECIMAL(15,2) DEFAULT 0.00;

-- 2. Créer la table d'historique des transactions
CREATE TABLE IF NOT EXISTS client_transactions (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  facture_id INT REFERENCES factures(id) ON DELETE SET NULL,
  type_transaction VARCHAR(20) NOT NULL, -- 'credit' (recharge), 'debit' (paiement facture)
  montant DECIMAL(15,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
