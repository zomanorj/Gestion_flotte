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

INSERT INTO maintenances_planifiees
  (vehicule_id, type, description, kilometrage_declencheur, date_prevue, cout_estime, garage, statut, priorite)
VALUES
(1,'vidange',           'Vidange huile moteur + filtre',  50000, '2024-12-20', 85000,  'Garage Rakoto Tana',    'planifiee','haute'),
(2,'freins',            'Remplacement plaquettes avant',  65000, '2024-12-15', 150000, 'MécaAuto Antsirabe',    'planifiee','urgente'),
(3,'revision_generale', 'Révision 20 000 km',             20000, '2025-01-10', 350000, 'Toyota Madagascar',     'planifiee','normale'),
(1,'pneus',             'Remplacement 4 pneus',           55000, '2025-01-20', 800000, 'Garage Rakoto Tana',    'planifiee','normale');
