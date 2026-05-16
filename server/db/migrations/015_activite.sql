-- Migration 015 : table journal_activite
-- TransiFlow — Sprint 9

CREATE TABLE IF NOT EXISTS journal_activite (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entite      VARCHAR(50),
  entite_id   INTEGER,
  description TEXT NOT NULL,
  donnees_avant JSONB,
  donnees_apres JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user_id    ON journal_activite(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entite     ON journal_activite(entite, entite_id);
CREATE INDEX IF NOT EXISTS idx_journal_created_at ON journal_activite(created_at DESC);
