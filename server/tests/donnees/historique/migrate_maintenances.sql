-- Migration module maintenances planifiées
-- Exécuter : mysql -u root -pmanoa1105 flotte_db < migrate_maintenances.sql

CREATE TABLE IF NOT EXISTS maintenances_planifiees (
  id                      INT PRIMARY KEY AUTO_INCREMENT,
  vehicule_id             INT NOT NULL,
  type                    ENUM('vidange','freins','pneus','courroie','filtres','revision_generale','autre') NOT NULL,
  description             TEXT,
  kilometrage_declencheur INT,
  date_prevue             DATE,
  date_realisee           DATE,
  cout_estime             DECIMAL(10,2),
  cout_reel               DECIMAL(10,2),
  garage                  VARCHAR(200),
  statut                  ENUM('planifiee','en_cours','terminee','annulee') DEFAULT 'planifiee',
  priorite                ENUM('faible','normale','haute','urgente') DEFAULT 'normale',
  notes                   TEXT,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE
);

