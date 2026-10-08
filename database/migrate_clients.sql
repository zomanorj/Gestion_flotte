-- Migration module clients
-- Exécuter : mysql -u root -pmanoa1105 flotte_db < migrate_clients.sql

CREATE TABLE IF NOT EXISTS clients (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  nom         VARCHAR(200) NOT NULL,
  type        ENUM('entreprise','particulier') DEFAULT 'entreprise',
  contact_nom VARCHAR(100),
  telephone   VARCHAR(20),
  email       VARCHAR(150),
  adresse     TEXT,
  ville       VARCHAR(100),
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajout colonne client_id dans missions
ALTER TABLE missions ADD COLUMN client_id INT REFERENCES clients(id);

