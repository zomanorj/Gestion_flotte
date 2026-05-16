/* Ajout des index pour optimiser les requêtes fréquentes — audit TransiFlow */
/* NB : les salaires utilisent mois_concerne (varchar YYYY-MM), pas (mois, annee). */

-- Index sur factures
CREATE INDEX IF NOT EXISTS idx_factures_client_id
  ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut
  ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_factures_date_emission
  ON factures(date_emission);

-- Index sur paiements
CREATE INDEX IF NOT EXISTS idx_paiements_facture_id
  ON paiements(facture_id);

-- Index sur missions
CREATE INDEX IF NOT EXISTS idx_missions_client_id
  ON missions(client_id);
CREATE INDEX IF NOT EXISTS idx_missions_statut
  ON missions(statut);
CREATE INDEX IF NOT EXISTS idx_missions_date_mission
  ON missions(date_mission);

-- Index sur salaires
CREATE INDEX IF NOT EXISTS idx_salaires_driver_id
  ON salaires(driver_id);
CREATE INDEX IF NOT EXISTS idx_salaires_mission_id
  ON salaires(mission_id);
CREATE INDEX IF NOT EXISTS idx_salaires_mois_concerne
  ON salaires(mois_concerne);

-- Index sur incidents
CREATE INDEX IF NOT EXISTS idx_incidents_statut
  ON incidents(statut);
CREATE INDEX IF NOT EXISTS idx_incidents_vehicle_id
  ON incidents(vehicle_id);
