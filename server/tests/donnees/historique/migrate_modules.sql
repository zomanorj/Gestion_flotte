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

