-- Migration FlotteCamion v2 — schéma complet
-- mysql -u root -pmanoa1105 flotte_db < migrate_v2.sql

-- ── Nouveaux champs missions ──────────────────────────────────────────────────
ALTER TABLE missions ADD COLUMN salaire_mission     DECIMAL(10,2) DEFAULT 0;
ALTER TABLE missions ADD COLUMN produits_transportes TEXT;
ALTER TABLE missions ADD COLUMN poids_total          DECIMAL(8,2);
ALTER TABLE missions ADD COLUMN valeur_marchandise   DECIMAL(12,2);

-- ── Nouveaux champs chauffeurs ────────────────────────────────────────────────
ALTER TABLE chauffeurs ADD COLUMN salaire_base  DECIMAL(10,2) DEFAULT 800000;
ALTER TABLE chauffeurs ADD COLUMN prime_mission DECIMAL(10,2) DEFAULT 50000;

-- ── Salaires par mission ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_salaires (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  mission_id    INT NOT NULL,
  chauffeur_id  INT NOT NULL,
  salaire_base  DECIMAL(10,2) DEFAULT 0,
  prime_mission DECIMAL(10,2) DEFAULT 0,
  bonus         DECIMAL(10,2) DEFAULT 0,
  total_paye    DECIMAL(10,2) DEFAULT 0,
  date_paiement DATE,
  statut        ENUM('en_attente','paye') DEFAULT 'en_attente',
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id)   REFERENCES missions(id)   ON DELETE CASCADE,
  FOREIGN KEY (chauffeur_id) REFERENCES chauffeurs(id)
);

-- ── Historique modifications carburant ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carburant_historique (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  carburant_id    INT NOT NULL,
  champ_modifie   VARCHAR(50),
  ancienne_valeur VARCHAR(200),
  nouvelle_valeur VARCHAR(200),
  modifie_par     INT,
  modifie_par_nom VARCHAR(100),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (carburant_id) REFERENCES carburant(id) ON DELETE CASCADE
);

-- ── Événements mission stockés en base ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_evenements (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  mission_id   INT NOT NULL,
  type         VARCHAR(50),
  label        VARCHAR(200),
  description  TEXT,
  duree_min    INT,
  position_lat DECIMAL(10,7),
  position_lng DECIMAL(10,7),
  km_au_moment DECIMAL(8,2),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

-- ── Champs notifications ──────────────────────────────────────────────────────
-- Crée la table si elle n'existe pas encore
CREATE TABLE IF NOT EXISTS notifications (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  type        VARCHAR(50),
  titre       VARCHAR(200),
  message     TEXT,
  est_lue     BOOLEAN DEFAULT FALSE,
  vehicule_id INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notifications ADD COLUMN regle         BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN regle_par     INT;
ALTER TABLE notifications ADD COLUMN regle_par_nom VARCHAR(100);
ALTER TABLE notifications ADD COLUMN regle_le      TIMESTAMP NULL;

-- ── Champs clients enrichis ───────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN nif           VARCHAR(50);
ALTER TABLE clients ADD COLUMN stat_num      VARCHAR(50);
ALTER TABLE clients ADD COLUMN site_web      VARCHAR(200);
ALTER TABLE clients ADD COLUMN secteur       VARCHAR(100);
ALTER TABLE clients ADD COLUMN limite_credit DECIMAL(12,2) DEFAULT 0;

-- ── Nettoyage des données de test ─────────────────────────────────────────────
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE mission_evenements;
TRUNCATE TABLE mission_salaires;
TRUNCATE TABLE carburant_historique;
TRUNCATE TABLE carburant;
TRUNCATE TABLE depenses;
TRUNCATE TABLE documents;
TRUNCATE TABLE maintenances_planifiees;
TRUNCATE TABLE alertes;
TRUNCATE TABLE notifications;
TRUNCATE TABLE missions;
TRUNCATE TABLE chauffeurs;
TRUNCATE TABLE vehicules;
TRUNCATE TABLE clients;
SET FOREIGN_KEY_CHECKS = 1;

-- ── Garde uniquement l'admin ──────────────────────────────────────────────────
DELETE FROM users WHERE role != 'admin';
UPDATE users SET nom = 'Administrateur', email = 'admin@flotte.mg' WHERE role = 'admin';
