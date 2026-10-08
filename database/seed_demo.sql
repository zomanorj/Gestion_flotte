-- ============================================================
-- Données de démonstration — FlotteApp
-- À exécuter APRÈS schema.sql et toutes les migrations.
-- Ne jamais exécuter en production : crée des comptes au mot de passe connu.
--   mysql -u root -p flotte_db < seed_demo.sql
-- Avec Docker : chargé automatiquement si SEED_DEMO=1 (valeur par défaut).
-- ============================================================

-- Utilisateurs
-- Mot de passe "password123" — pour régénérer le hash :
-- python3 -c "import bcrypt; print(bcrypt.hashpw(b'password123', bcrypt.gensalt(10)).decode())"
INSERT INTO users (nom, email, password_hash, role) VALUES
  ('Rakoto Jean',  'admin@flotte.mg',        '$2b$10$6G7jp5IK3Fn6tTSeljrySep.r867bHZaNIe.aumypReBksQZfUOVC', 'admin'),
  ('Rabe Marie',   'gestionnaire@flotte.mg', '$2b$10$6G7jp5IK3Fn6tTSeljrySep.r867bHZaNIe.aumypReBksQZfUOVC', 'gestionnaire'),
  ('Randria Paul', 'chauffeur@flotte.mg',    '$2b$10$6G7jp5IK3Fn6tTSeljrySep.r867bHZaNIe.aumypReBksQZfUOVC', 'chauffeur');

-- Camions lourds (immatriculations malgaches)
INSERT INTO vehicules
  (immatriculation, marque, modele, annee, kilometrage, consommation_litre_km,
   statut, date_derniere_vidange, date_prochain_ct,
   tonnage, type_camion, numero_chassis)
VALUES
  ('MAD-001-24', 'Mercedes', 'Actros',  2022, 145000, 0.30,
   'disponible',  '2024-02-15', '2025-03-01',
   32.50, 'tracteur',     'WDB9340321L123456'),

  ('MAD-002-24', 'Volvo',    'FH16',    2021, 189000, 0.32,
   'en_mission',  '2024-01-20', '2024-12-15',
   36.00, 'tracteur',     'YV2RGA0C0LB123789'),

  ('MAD-003-24', 'MAN',      'TGX',     2023,  67000, 0.28,
   'maintenance', '2024-03-10', '2026-04-20',
   28.00, 'porteur',      'WMAH065ZXNM654321'),

  ('MAD-004-24', 'Scania',   'R500',    2020, 234000, 0.35,
   'disponible',  '2023-11-05', '2024-08-30',
   40.00, 'benne',        'YS2R4X20005123654'),

  ('MAD-005-24', 'Renault',  'T520',    2022,  98000, 0.29,
   'disponible',  '2024-04-01', '2027-01-15',
   30.00, 'frigorifique', 'VF612GGA0LN987654');

-- Chauffeurs (permis catégorie C/CE pour poids lourds)
INSERT INTO chauffeurs (user_id, nom, prenom, telephone, numero_permis, categorie_permis, statut) VALUES
  (3, 'Randria',       'Paul',   '+261 34 12 345 67', 'MG-PL-2018-00123', 'CE', 'en_mission'),
  (NULL, 'Rakotondrabe', 'Hery',   '+261 33 87 654 32', 'MG-PL-2019-00456', 'CE', 'disponible'),
  (NULL, 'Andriantsoa',  'Lanto',  '+261 34 56 789 01', 'MG-PL-2020-00789', 'C',  'disponible'),
  (NULL, 'Razafimahefa', 'Tahiry', '+261 32 11 223 44', 'MG-PL-2017-00321', 'CE', 'conge');

-- Missions de transport de marchandises
INSERT INTO missions
  (titre, vehicule_id, chauffeur_id,
   lieu_depart, lieu_destination, distance_km,
   date_depart, date_retour_prevue, date_retour_reelle,
   statut, cout_carburant, poids_charge, notes)
VALUES
  (
    'Transport ciment Toamasina',
    2, 1,
    'Antananarivo', 'Toamasina', 260.00,
    '2024-05-10 06:00:00', '2024-05-11 18:00:00', NULL,
    'en_cours', NULL, 35.00,
    'Ciment Portland — 35 tonnes pour le chantier CHU Toamasina'
  ),
  (
    'Livraison riz Antsirabe',
    1, 2,
    'Antananarivo', 'Antsirabe', 170.00,
    '2024-05-15 07:00:00', '2024-05-15 20:00:00', NULL,
    'planifiee', NULL, 20.00,
    'Riz blanc décortiqué — 20 tonnes, coopérative Antsirabe-Sud'
  ),
  (
    'Transport carburant Fianarantsoa',
    3, 3,
    'Antananarivo', 'Fianarantsoa', 405.00,
    '2024-04-20 05:00:00', '2024-04-22 18:00:00', '2024-04-22 16:30:00',
    'terminee', ROUND(405 * 0.28 * 5200, 2), 22.50,
    'Carburant diesel — 25 000 litres pour la station JOVENNA'
  );

-- Maintenances
INSERT INTO maintenances (vehicule_id, type, description, date_maintenance, cout, kilometrage_au_moment) VALUES
  (3, 'Vidange',    'Vidange huile moteur 15W40 + filtre à huile',         '2024-03-10', 220000,  66500),
  (2, 'Vidange',    'Vidange huile + filtre air + filtre carburant',        '2024-01-20', 220000, 188000),
  (1, 'Vidange',    'Vidange préventive 15 000 km',                        '2024-02-15', 220000, 144000),
  (4, 'Freins',     'Remplacement garnitures de frein + disques avant',    '2024-01-10', 850000, 232000),
  (3, 'CT',         'Contrôle technique poids lourd — résultat : OK',      '2024-03-10', 180000,  66800);

-- Alertes
INSERT INTO alertes (vehicule_id, type, message, est_lue) VALUES
  (4, 'Contrôle technique', 'Le contrôle technique du camion MAD-004-24 (Scania R500) expire le 30/08/2024.', FALSE),
  (2, 'Contrôle technique', 'Le contrôle technique du camion MAD-002-24 (Volvo FH16) expire le 15/12/2024.', FALSE),
  (4, 'Kilométrage vidange', 'Le camion MAD-004-24 dépasse 10 000 km depuis la dernière vidange.', FALSE);

-- Clients
INSERT INTO clients (nom, type, contact_nom, telephone, ville) VALUES
('COLAS Madagascar',    'entreprise', 'Rakoto Fils',  '034 11 111 11', 'Antananarivo'),
('Jirama',              'entreprise', 'Rabe Pierre',  '033 22 222 22', 'Toamasina'),
('Shoprite Madagascar', 'entreprise', 'Randria Jean', '032 33 333 33', 'Antananarivo'),
('Holcim Madagascar',   'entreprise', 'Razafy Marc',  '034 44 444 44', 'Mahajanga');

-- Maintenances planifiées
INSERT INTO maintenances_planifiees
  (vehicule_id, type, description, kilometrage_declencheur, date_prevue, cout_estime, garage, statut, priorite)
VALUES
(1,'vidange',           'Vidange huile moteur + filtre',  50000, '2024-12-20', 85000,  'Garage Rakoto Tana',    'planifiee','haute'),
(2,'freins',            'Remplacement plaquettes avant',  65000, '2024-12-15', 150000, 'MécaAuto Antsirabe',    'planifiee','urgente'),
(3,'revision_generale', 'Révision 20 000 km',             20000, '2025-01-10', 350000, 'Toyota Madagascar',     'planifiee','normale'),
(1,'pneus',             'Remplacement 4 pneus',           55000, '2025-01-20', 800000, 'Garage Rakoto Tana',    'planifiee','normale');

INSERT INTO documents (vehicule_id, type, numero, date_emission, date_expiration, notes) VALUES
(1, 'carte_grise',          'CG-2024-001',      '2024-01-15', '2027-01-15', 'Carte grise principale'),
(1, 'assurance',            'ASS-2024-MCR-001', '2024-03-01', '2025-03-01', 'Assurance tout risques expirée'),
(2, 'vignette',             'VGT-2025-002',     '2025-01-01', '2025-12-31', 'Vignette annuelle'),
(2, 'visite_technique',     'VT-2024-002',      '2024-06-15', '2026-06-15', 'Visite technique valide'),
(3, 'assurance',            'ASS-2025-003',     '2025-01-01', DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Assurance expire dans 15 jours');

INSERT INTO carburant (vehicule_id, date_plein, litres, prix_litre, cout_total, kilometrage_au_plein, consommation_reelle, station, ville, type_carburant) VALUES
(1, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 120.50, 5200, 626600, 45320, 0.32, 'Total',   'Antananarivo', 'diesel'),
(2, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 95.00,  5200, 494000, 38150, 0.28, 'Galana',  'Toamasina',   'diesel'),
(1, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 110.00, 5200, 572000, 45680, 0.31, 'Total',   'Antananarivo', 'diesel'),
(3, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  130.00, 5200, 676000, 22100, 0.35, 'Jovenna', 'Fianarantsoa', 'diesel');

INSERT INTO depenses (vehicule_id, categorie, montant, date_depense, description) VALUES
(1, 'peage',             15000,  DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Péage RN2 Antananarivo-Toamasina'),
(2, 'pneu',             450000,  DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Remplacement 2 pneus avant'),
(3, 'lavage',            25000,  DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Lavage complet + désinfection'),
(1, 'pieces_detachees', 180000,  DATE_SUB(CURDATE(), INTERVAL 8 DAY),  'Filtre à huile + filtre air'),
(4, 'amende',            50000,  DATE_SUB(CURDATE(), INTERVAL 3 DAY),  'Amende surcharge RN7');
