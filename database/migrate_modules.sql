-- Migration modules : documents, carburant, dépenses
-- À exécuter une seule fois : cmd /c "mysql -u root -pmanoa1105 flotte_db < migrate_modules.sql"

-- ─────────────────────────────────────────────
-- MODULE 1 : Documents administratifs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  vehicule_id       INT NOT NULL,
  type              ENUM('carte_grise','assurance','vignette','visite_technique','autorisation_transport') NOT NULL,
  numero            VARCHAR(100),
  date_emission     DATE NOT NULL,
  date_expiration   DATE NOT NULL,
  fichier_nom       VARCHAR(255),
  fichier_url       VARCHAR(500),
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE
);

INSERT INTO documents (vehicule_id, type, numero, date_emission, date_expiration, notes) VALUES
(1, 'carte_grise',          'CG-2024-001',      '2024-01-15', '2027-01-15', 'Carte grise principale'),
(1, 'assurance',            'ASS-2024-MCR-001', '2024-03-01', '2025-03-01', 'Assurance tout risques expirée'),
(2, 'vignette',             'VGT-2025-002',     '2025-01-01', '2025-12-31', 'Vignette annuelle'),
(2, 'visite_technique',     'VT-2024-002',      '2024-06-15', '2026-06-15', 'Visite technique valide'),
(3, 'assurance',            'ASS-2025-003',     '2025-01-01', DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Assurance expire dans 15 jours');

-- ─────────────────────────────────────────────
-- MODULE 2 : Gestion du carburant
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carburant (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  vehicule_id          INT NOT NULL,
  mission_id           INT,
  date_plein           DATE NOT NULL,
  litres               DECIMAL(8,2) NOT NULL,
  prix_litre           DECIMAL(8,2) NOT NULL DEFAULT 5200,
  cout_total           DECIMAL(12,2) NOT NULL,
  kilometrage_au_plein INT,
  consommation_reelle  DECIMAL(5,2),
  station              VARCHAR(100),
  ville                VARCHAR(100),
  type_carburant       ENUM('diesel','essence','gasoil') NOT NULL DEFAULT 'diesel',
  notes                TEXT,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id)  REFERENCES missions(id)  ON DELETE SET NULL
);

INSERT INTO carburant (vehicule_id, date_plein, litres, prix_litre, cout_total, kilometrage_au_plein, consommation_reelle, station, ville, type_carburant) VALUES
(1, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 120.50, 5200, 626600, 45320, 0.32, 'Total',   'Antananarivo', 'diesel'),
(2, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 95.00,  5200, 494000, 38150, 0.28, 'Galana',  'Toamasina',   'diesel'),
(1, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 110.00, 5200, 572000, 45680, 0.31, 'Total',   'Antananarivo', 'diesel'),
(3, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  130.00, 5200, 676000, 22100, 0.35, 'Jovenna', 'Fianarantsoa', 'diesel');

-- ─────────────────────────────────────────────
-- MODULE 3 : Gestion des dépenses
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS depenses (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  vehicule_id      INT NOT NULL,
  mission_id       INT,
  categorie        ENUM('peage','amende','lavage','pneu','pieces_detachees','main_oeuvre','parking','divers') NOT NULL,
  montant          DECIMAL(12,2) NOT NULL,
  date_depense     DATE NOT NULL,
  description      TEXT,
  justificatif_url VARCHAR(500),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicule_id) REFERENCES vehicules(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id)  REFERENCES missions(id)  ON DELETE SET NULL
);

INSERT INTO depenses (vehicule_id, categorie, montant, date_depense, description) VALUES
(1, 'peage',             15000,  DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Péage RN2 Antananarivo-Toamasina'),
(2, 'pneu',             450000,  DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Remplacement 2 pneus avant'),
(3, 'lavage',            25000,  DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Lavage complet + désinfection'),
(1, 'pieces_detachees', 180000,  DATE_SUB(CURDATE(), INTERVAL 8 DAY),  'Filtre à huile + filtre air'),
(4, 'amende',            50000,  DATE_SUB(CURDATE(), INTERVAL 3 DAY),  'Amende surcharge RN7');
