-- ─────────────────────────────────────────────────────────────────────────────
-- 009_paiements.sql
-- Système de paiement progressif des factures — TransiFlow.
--
-- Permet d'enregistrer plusieurs paiements partiels (acomptes + solde)
-- par facture (usage courant à Madagascar : MVola, virement, espèces).
-- ─────────────────────────────────────────────────────────────────────────────

-- Table des paiements individuels
CREATE TABLE IF NOT EXISTS paiements (
  id              SERIAL PRIMARY KEY,
  facture_id      INTEGER REFERENCES factures(id) NOT NULL,
  montant         DECIMAL(12,2) NOT NULL,
  date_paiement   DATE NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement   VARCHAR(50) NOT NULL,
  -- 'mvola' | 'virement' | 'especes' | 'cheque'
  reference       VARCHAR(100),  -- référence MVola (MV-XXXXXXXXXX) ou virement
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Ajouter le statut 'partiel' à la colonne statut des factures
-- (idempotent grâce au DO $$ EXCEPTION WHEN...)
DO $$
BEGIN
  -- Modifier la contrainte check si elle existe
  ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_statut_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Vue calculant le solde restant par facture
CREATE OR REPLACE VIEW factures_solde AS
SELECT
  f.id,
  f.numero,
  f.montant_ttc,
  COALESCE(SUM(p.montant), 0)                                     AS montant_paye,
  f.montant_ttc - COALESCE(SUM(p.montant), 0)                     AS solde_restant,
  CASE
    WHEN COALESCE(SUM(p.montant), 0) = 0              THEN 'non_paye'
    WHEN COALESCE(SUM(p.montant), 0) >= f.montant_ttc THEN 'paye'
    ELSE                                                   'partiel'
  END                                                             AS etat_paiement
FROM factures f
LEFT JOIN paiements p ON p.facture_id = f.id
GROUP BY f.id, f.numero, f.montant_ttc;
