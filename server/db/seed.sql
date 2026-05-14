-- =============================================================================
-- seed.sql
-- Données de test pour le développement local du système Transport STTA.
--
-- Ce fichier insère des données réalistes pour pouvoir tester l'application
-- sans avoir à saisir manuellement des données.
--
-- ⚠️  NE PAS exécuter sur la base de données de production.
--
-- Exécution : psql -U postgres -d transport_stta -f seed.sql
-- (Exécuter schema.sql d'abord pour créer les tables)
-- =============================================================================


-- =============================================================================
-- Utilisateurs de test
-- Hashes bcrypt générés réellement avec bcryptjs (coût 10) — valides pour le login.
--
-- Comptes de test :
--   admin@stta.mg        / admin1234
--   gestionnaire@stta.mg / gest1234
--   chauffeur@stta.mg    / chauf1234
-- =============================================================================
INSERT INTO users (nom, email, mot_de_passe, role) VALUES
(
    'Administrateur STTA',
    'admin@stta.mg',
    '$2b$10$UK0u2Cuu0iupV7T5SwgHkOx.yxRKDlyOeOP4.hF0pQVg14vsHHCZO',
    'admin'
),
(
    'Rakoto Jean',
    'gestionnaire@stta.mg',
    '$2b$10$.PVepOCTqeNgpcwl5eSIE.ztN26a0hauzY16zYK.jngBUtpJVa62G',
    'gestionnaire'
),
(
    'Rabe Fidy',
    'chauffeur@stta.mg',
    '$2b$10$fZd5RUdq6jorJMsasXvuhOmA1IzHMa0RKasLtA0dHNBzfiS58QZgC',
    'chauffeur'
);


-- =============================================================================
-- Véhicules de test
-- =============================================================================
INSERT INTO vehicles (immatriculation, type, capacite, statut, date_assurance, kilometrage) VALUES
('MG-1234-TA', 'Minibus',      15, 'disponible',    '2025-12-31', 45230),
('MG-5678-TA', 'Camionnette',   3, 'disponible',    '2025-08-15', 23100),
('MG-9012-TA', 'Berline',       4, 'en_maintenance', '2025-10-01', 87654),
('MG-3456-TA', 'Pick-up',       2, 'disponible',    '2026-03-20', 12800);


-- =============================================================================
-- Chauffeurs de test
-- (user_id = 3 correspond au compte chauffeur créé ci-dessus)
-- =============================================================================
INSERT INTO drivers (user_id, nom, prenom, telephone, numero_permis, date_expiration_permis, statut) VALUES
(3,    'Rabe',      'Fidy',      '+261 34 00 111 22', 'MG-PERMIS-001', '2026-06-30', 'disponible'),
(NULL, 'Razafy',    'Hanta',     '+261 32 00 222 33', 'MG-PERMIS-002', '2025-11-15', 'disponible'),
(NULL, 'Randriamanana', 'Solo', '+261 33 00 333 44', 'MG-PERMIS-003', '2024-12-01', 'inactif');
-- Note : le 3ème chauffeur a un permis expiré — utile pour tester les alertes


-- =============================================================================
-- Missions de test
-- =============================================================================
INSERT INTO missions (vehicle_id, driver_id, lieu_depart, lieu_arrivee, date_mission, chargement, statut) VALUES
(
    1, 1,
    'Siège STTA - Antananarivo',
    'Aéroport Ivato',
    NOW() + INTERVAL '2 hours',
    '3 passagers + bagages',
    'planifiee'
),
(
    2, 2,
    'Entrepôt Ambatonakanga',
    'Site de Mahajanga',
    NOW() - INTERVAL '1 day',
    'Livraison matériel informatique (12 colis)',
    'terminee'
),
(
    1, 1,
    'Aéroport Ivato',
    'Hôtel Carlton - Antananarivo',
    NOW() - INTERVAL '3 hours',
    'Transfert délégation partenaires',
    'en_cours'
);
