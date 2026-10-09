"""Socle : schéma complet de la base au moment du passage aux migrations versionnées.

Revision ID: 0001
Revises:
Create Date: 2026-10-09

Reproduit exactement le schéma obtenu jusqu'ici par database/schema.sql, les fichiers
migrate_*.sql et les migrations applicatives (extrait d'une base réelle avec SHOW CREATE TABLE).
Sur une base existante, ce socle n'est pas exécuté : la base est complétée puis marquée à ce
niveau (voir app/migrations.py).
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Ordre de création compatible avec les clés étrangères
TABLES = [
    """
    CREATE TABLE `users` (
      `id` int NOT NULL AUTO_INCREMENT,
      `nom` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
      `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
      `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      `role` enum('admin','gestionnaire','chauffeur') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'chauffeur',
      `is_active` tinyint(1) NOT NULL DEFAULT '1',
      `token_version` int NOT NULL DEFAULT '0',
      `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `email` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `vehicules` (
      `id` int NOT NULL AUTO_INCREMENT,
      `immatriculation` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
      `marque` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
      `modele` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
      `annee` year NOT NULL,
      `kilometrage` int NOT NULL DEFAULT '0',
      `consommation_litre_km` decimal(4,2) NOT NULL DEFAULT '0.30',
      `statut` enum('disponible','en_mission','en_panne','maintenance') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'disponible',
      `date_derniere_vidange` date DEFAULT NULL,
      `date_prochain_ct` date DEFAULT NULL,
      `tonnage` decimal(6,2) DEFAULT NULL,
      `type_camion` enum('porteur','tracteur','benne','frigorifique','citerne') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'porteur',
      `numero_chassis` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `immatriculation` (`immatriculation`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `chauffeurs` (
      `id` int NOT NULL AUTO_INCREMENT,
      `user_id` int DEFAULT NULL,
      `nom` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
      `prenom` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
      `telephone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
      `numero_permis` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
      `categorie_permis` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'C',
      `statut` enum('disponible','en_mission','conge') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'disponible',
      `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `salaire_base` decimal(10,2) DEFAULT '800000.00',
      `prime_mission` decimal(10,2) DEFAULT '50000.00',
      `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `numero_permis` (`numero_permis`),
      KEY `fk_chauffeur_user` (`user_id`),
      CONSTRAINT `fk_chauffeur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `clients` (
      `id` int NOT NULL AUTO_INCREMENT,
      `nom` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
      `type` enum('entreprise','particulier') COLLATE utf8mb4_unicode_ci DEFAULT 'entreprise',
      `contact_nom` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `telephone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `adresse` text COLLATE utf8mb4_unicode_ci,
      `ville` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `notes` text COLLATE utf8mb4_unicode_ci,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      `nif` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `stat_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `site_web` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `secteur` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `limite_credit` decimal(12,2) DEFAULT '0.00',
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `missions` (
      `id` int NOT NULL AUTO_INCREMENT,
      `titre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
      `vehicule_id` int NOT NULL,
      `chauffeur_id` int NOT NULL,
      `lieu_depart` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
      `lieu_destination` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
      `distance_km` decimal(8,2) NOT NULL DEFAULT '0.00',
      `date_depart` datetime NOT NULL,
      `date_retour_prevue` datetime NOT NULL,
      `date_retour_reelle` datetime DEFAULT NULL,
      `statut` enum('planifiee','en_cours','terminee','annulee') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planifiee',
      `cout_carburant` decimal(10,2) DEFAULT NULL,
      `poids_charge` decimal(8,2) DEFAULT NULL,
      `notes` text COLLATE utf8mb4_unicode_ci,
      `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `client_id` int DEFAULT NULL,
      `salaire_mission` decimal(10,2) DEFAULT '0.00',
      `produits_transportes` text COLLATE utf8mb4_unicode_ci,
      `poids_total` decimal(8,2) DEFAULT NULL,
      `valeur_marchandise` decimal(12,2) DEFAULT NULL,
      `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_missions_statut` (`statut`),
      KEY `idx_missions_date` (`date_depart`),
      KEY `idx_missions_client` (`client_id`),
      KEY `idx_missions_vehicule_periode` (`vehicule_id`,`statut`,`date_depart`),
      KEY `idx_missions_chauffeur_periode` (`chauffeur_id`,`statut`,`date_depart`),
      CONSTRAINT `fk_mission_chauffeur` FOREIGN KEY (`chauffeur_id`) REFERENCES `chauffeurs` (`id`) ON DELETE RESTRICT,
      CONSTRAINT `fk_mission_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
      CONSTRAINT `fk_mission_vehicule` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicules` (`id`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `alertes` (
      `id` int NOT NULL AUTO_INCREMENT,
      `vehicule_id` int NOT NULL,
      `type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
      `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
      `est_lue` tinyint(1) NOT NULL DEFAULT '0',
      `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `fk_alerte_vehicule` (`vehicule_id`),
      CONSTRAINT `fk_alerte_vehicule` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `maintenances` (
      `id` int NOT NULL AUTO_INCREMENT,
      `vehicule_id` int NOT NULL,
      `type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
      `description` text COLLATE utf8mb4_unicode_ci,
      `date_maintenance` date NOT NULL,
      `cout` decimal(10,2) NOT NULL DEFAULT '0.00',
      `kilometrage_au_moment` int NOT NULL DEFAULT '0',
      `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `fk_maintenance_vehicule` (`vehicule_id`),
      CONSTRAINT `fk_maintenance_vehicule` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `documents` (
      `id` int NOT NULL AUTO_INCREMENT,
      `vehicule_id` int NOT NULL,
      `type` enum('carte_grise','assurance','vignette','visite_technique','autorisation_transport') COLLATE utf8mb4_unicode_ci NOT NULL,
      `numero` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `date_emission` date NOT NULL,
      `date_expiration` date NOT NULL,
      `fichier_nom` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `fichier_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `notes` text COLLATE utf8mb4_unicode_ci,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `vehicule_id` (`vehicule_id`),
      KEY `idx_documents_expiration` (`date_expiration`),
      KEY `idx_documents_exp` (`date_expiration`),
      CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `carburant` (
      `id` int NOT NULL AUTO_INCREMENT,
      `vehicule_id` int NOT NULL,
      `mission_id` int DEFAULT NULL,
      `date_plein` date NOT NULL,
      `litres` decimal(8,2) NOT NULL,
      `prix_litre` decimal(8,2) NOT NULL DEFAULT '5200.00',
      `cout_total` decimal(12,2) NOT NULL,
      `kilometrage_au_plein` int DEFAULT NULL,
      `consommation_reelle` decimal(5,2) DEFAULT NULL,
      `station` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `ville` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `type_carburant` enum('diesel','essence','gasoil') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'diesel',
      `notes` text COLLATE utf8mb4_unicode_ci,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `mission_id` (`mission_id`),
      KEY `idx_carburant_date` (`date_plein`),
      KEY `idx_carburant_vehicule` (`vehicule_id`),
      CONSTRAINT `carburant_ibfk_1` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE,
      CONSTRAINT `carburant_ibfk_2` FOREIGN KEY (`mission_id`) REFERENCES `missions` (`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `carburant_historique` (
      `id` int NOT NULL AUTO_INCREMENT,
      `carburant_id` int NOT NULL,
      `champ_modifie` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `ancienne_valeur` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `nouvelle_valeur` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `modifie_par` int DEFAULT NULL,
      `modifie_par_nom` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `carburant_id` (`carburant_id`),
      CONSTRAINT `carburant_historique_ibfk_1` FOREIGN KEY (`carburant_id`) REFERENCES `carburant` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `depenses` (
      `id` int NOT NULL AUTO_INCREMENT,
      `vehicule_id` int NOT NULL,
      `mission_id` int DEFAULT NULL,
      `categorie` enum('peage','amende','lavage','pneu','pieces_detachees','main_oeuvre','parking','divers') COLLATE utf8mb4_unicode_ci NOT NULL,
      `montant` decimal(12,2) NOT NULL,
      `date_depense` date NOT NULL,
      `description` text COLLATE utf8mb4_unicode_ci,
      `justificatif_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `mission_id` (`mission_id`),
      KEY `idx_depenses_date` (`date_depense`),
      KEY `idx_depenses_vehicule` (`vehicule_id`),
      CONSTRAINT `depenses_ibfk_1` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE,
      CONSTRAINT `depenses_ibfk_2` FOREIGN KEY (`mission_id`) REFERENCES `missions` (`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `maintenances_planifiees` (
      `id` int NOT NULL AUTO_INCREMENT,
      `vehicule_id` int NOT NULL,
      `type` enum('vidange','freins','pneus','courroie','filtres','revision_generale','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
      `description` text COLLATE utf8mb4_unicode_ci,
      `kilometrage_declencheur` int DEFAULT NULL,
      `date_prevue` date DEFAULT NULL,
      `date_realisee` date DEFAULT NULL,
      `cout_estime` decimal(10,2) DEFAULT NULL,
      `cout_reel` decimal(10,2) DEFAULT NULL,
      `garage` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `statut` enum('planifiee','en_cours','terminee','annulee') COLLATE utf8mb4_unicode_ci DEFAULT 'planifiee',
      `priorite` enum('faible','normale','haute','urgente') COLLATE utf8mb4_unicode_ci DEFAULT 'normale',
      `notes` text COLLATE utf8mb4_unicode_ci,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_maintenances_date` (`date_prevue`),
      KEY `idx_maintenances_vehicule` (`vehicule_id`),
      CONSTRAINT `maintenances_planifiees_ibfk_1` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `mission_salaires` (
      `id` int NOT NULL AUTO_INCREMENT,
      `mission_id` int NOT NULL,
      `chauffeur_id` int NOT NULL,
      `salaire_base` decimal(10,2) DEFAULT '0.00',
      `prime_mission` decimal(10,2) DEFAULT '0.00',
      `bonus` decimal(10,2) DEFAULT '0.00',
      `total_paye` decimal(10,2) DEFAULT '0.00',
      `date_paiement` date DEFAULT NULL,
      `statut` enum('en_attente','paye') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
      `notes` text COLLATE utf8mb4_unicode_ci,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `mission_id` (`mission_id`),
      KEY `chauffeur_id` (`chauffeur_id`),
      CONSTRAINT `mission_salaires_ibfk_1` FOREIGN KEY (`mission_id`) REFERENCES `missions` (`id`) ON DELETE CASCADE,
      CONSTRAINT `mission_salaires_ibfk_2` FOREIGN KEY (`chauffeur_id`) REFERENCES `chauffeurs` (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `mission_evenements` (
      `id` int NOT NULL AUTO_INCREMENT,
      `mission_id` int NOT NULL,
      `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `label` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `description` text COLLATE utf8mb4_unicode_ci,
      `duree_min` int DEFAULT NULL,
      `position_lat` decimal(10,7) DEFAULT NULL,
      `position_lng` decimal(10,7) DEFAULT NULL,
      `km_au_moment` decimal(8,2) DEFAULT NULL,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `mission_id` (`mission_id`),
      CONSTRAINT `mission_evenements_ibfk_1` FOREIGN KEY (`mission_id`) REFERENCES `missions` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `notifications` (
      `id` int NOT NULL AUTO_INCREMENT,
      `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `titre` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `message` text COLLATE utf8mb4_unicode_ci,
      `est_lue` tinyint(1) DEFAULT '0',
      `vehicule_id` int DEFAULT NULL,
      `user_id` int DEFAULT NULL,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      `regle` tinyint(1) DEFAULT '0',
      `regle_par` int DEFAULT NULL,
      `regle_par_nom` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `regle_le` timestamp NULL DEFAULT NULL,
      PRIMARY KEY (`id`),
      KEY `idx_notifications_user_date` (`user_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE `notification_etats` (
      `notification_id` int NOT NULL,
      `user_id` int NOT NULL,
      `est_lue` tinyint(1) NOT NULL DEFAULT '0',
      `supprimee` tinyint(1) NOT NULL DEFAULT '0',
      `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`notification_id`,`user_id`),
      KEY `user_id` (`user_id`),
      CONSTRAINT `notification_etats_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
      CONSTRAINT `notification_etats_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
]


def upgrade() -> None:
    for instruction in TABLES:
        op.execute(instruction)


def downgrade() -> None:
    raise NotImplementedError("Le socle ne se défait pas : supprimer la base pour repartir de zéro.")
