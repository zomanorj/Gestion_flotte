-- Migration : ajout des colonnes spécifiques aux camions
USE flotte_db;

-- Nouvelles colonnes dans vehicules
ALTER TABLE vehicules
  ADD COLUMN tonnage        DECIMAL(6,2)  NULL AFTER date_prochain_ct,
  ADD COLUMN type_camion    ENUM('porteur','tracteur','benne','frigorifique','citerne')
                            NOT NULL DEFAULT 'porteur' AFTER tonnage,
  ADD COLUMN numero_chassis VARCHAR(50)   NULL AFTER type_camion;

-- Nouvelle colonne dans missions
ALTER TABLE missions
  ADD COLUMN poids_charge DECIMAL(8,2) NULL AFTER cout_carburant;

-- Mise à jour de la consommation par défaut : 0.08 voiture -> 0.30 camion
ALTER TABLE vehicules
  MODIFY COLUMN consommation_litre_km DECIMAL(4,2) NOT NULL DEFAULT 0.30;

-- Mise à jour de la catégorie permis par défaut : B -> C pour poids lourds
ALTER TABLE chauffeurs
  MODIFY COLUMN categorie_permis VARCHAR(10) NOT NULL DEFAULT 'C';

-- Vérification
SELECT
  TABLE_NAME,
  GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) AS colonnes
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'flotte_db'
  AND TABLE_NAME IN ('vehicules', 'missions', 'chauffeurs')
GROUP BY TABLE_NAME;
