# Auto-migration au démarrage — compatible MySQL 5.7+
import os

from . import db
from .auth import hacher_mdp


async def colonne_existe(table: str, colonne: str) -> bool:
    r = await db.query_one(
        """SELECT COUNT(*) AS nb FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s""",
        [table, colonne],
    )
    return r["nb"] > 0


async def index_existe(table: str, index: str) -> bool:
    r = await db.query_one(
        """SELECT COUNT(*) AS nb FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND INDEX_NAME = %s""",
        [table, index],
    )
    return r["nb"] > 0


async def table_existe(table: str) -> bool:
    r = await db.query_one(
        """SELECT COUNT(*) AS nb FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s""",
        [table],
    )
    return r["nb"] > 0


async def appliquer_migrations() -> None:
    ok = 0

    async def ajouter_colonne(table, colonne, definition):
        nonlocal ok
        if not await colonne_existe(table, colonne):
            await db.execute(f"ALTER TABLE {table} ADD COLUMN {colonne} {definition}")
            print(f"[Migration] + {table}.{colonne}")
            ok += 1

    async def ajouter_index(table, index, colonnes):
        nonlocal ok
        if not await index_existe(table, index):
            await db.execute(f"CREATE INDEX {index} ON {table}({colonnes})")
            ok += 1

    try:
        # ── Colonnes users ──────────────────────────────────────────────────────
        await ajouter_colonne("users", "is_active", "TINYINT(1) NOT NULL DEFAULT 1 AFTER role")
        # Incrémentée pour révoquer tous les tokens d'un compte (voir auth.py)
        await ajouter_colonne("users", "token_version", "INT NOT NULL DEFAULT 0 AFTER is_active")

        # ── Colonnes chauffeurs ─────────────────────────────────────────────────
        await ajouter_colonne("chauffeurs", "salaire_base",  "DECIMAL(10,2) DEFAULT 800000 AFTER statut")
        await ajouter_colonne("chauffeurs", "prime_mission", "DECIMAL(10,2) DEFAULT 50000  AFTER salaire_base")

        # ── Colonnes documents ──────────────────────────────────────────────────
        await ajouter_colonne("documents", "fichier_nom", "VARCHAR(255) NULL")
        await ajouter_colonne("documents", "fichier_url", "VARCHAR(500) NULL")

        # ── Colonne missions.client_id ──────────────────────────────────────────
        await ajouter_colonne("missions", "client_id", "INT NULL AFTER chauffeur_id")

        # ── updated_at sur les tables métier ────────────────────────────────────
        for table in ("missions", "vehicules", "chauffeurs"):
            await ajouter_colonne(table, "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")

        # ── Table notifications ──────────────────────────────────────────────────
        if not await table_existe("notifications"):
            await db.execute("""
                CREATE TABLE notifications (
                  id          INT PRIMARY KEY AUTO_INCREMENT,
                  type        VARCHAR(50),
                  titre       VARCHAR(200),
                  message     TEXT,
                  est_lue     BOOLEAN DEFAULT FALSE,
                  vehicule_id INT NULL,
                  user_id     INT NULL,
                  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            """)
            print("[Migration] + table notifications")
            ok += 1
        else:
            # Table existe — ajouter user_id si absent
            await ajouter_colonne("notifications", "user_id", "INT NULL AFTER vehicule_id")

        # ── Table mission_salaires ───────────────────────────────────────────────
        if not await table_existe("mission_salaires"):
            await db.execute("""
                CREATE TABLE mission_salaires (
                  id            INT PRIMARY KEY AUTO_INCREMENT,
                  mission_id    INT NOT NULL,
                  chauffeur_id  INT NOT NULL,
                  salaire_base  DECIMAL(10,2) DEFAULT 0,
                  prime_mission DECIMAL(10,2) DEFAULT 0,
                  bonus         DECIMAL(10,2) DEFAULT 0,
                  total_paye    DECIMAL(10,2) DEFAULT 0,
                  date_paiement DATE,
                  statut        ENUM('en_attente','paye') DEFAULT 'en_attente',
                  notes         TEXT,
                  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (mission_id)   REFERENCES missions(id)   ON DELETE CASCADE,
                  FOREIGN KEY (chauffeur_id) REFERENCES chauffeurs(id)
                ) ENGINE=InnoDB
            """)
            print("[Migration] + table mission_salaires")
            ok += 1

        # ── Table notification_etats : lu / supprimé par utilisateur ─────────────
        if not await table_existe("notification_etats"):
            await db.execute("""
                CREATE TABLE notification_etats (
                  notification_id INT NOT NULL,
                  user_id         INT NOT NULL,
                  est_lue         TINYINT(1) NOT NULL DEFAULT 0,
                  supprimee       TINYINT(1) NOT NULL DEFAULT 0,
                  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (notification_id, user_id),
                  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
                  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
                ) ENGINE=InnoDB
            """)
            print("[Migration] + table notification_etats")
            ok += 1

        # ── Indexes de performance ───────────────────────────────────────────────
        await ajouter_index("missions",                "idx_missions_statut",   "statut")
        await ajouter_index("missions",                "idx_missions_date",     "date_depart")
        await ajouter_index("carburant",               "idx_carburant_date",    "date_plein")
        await ajouter_index("depenses",                "idx_depenses_date",     "date_depense")
        await ajouter_index("documents",               "idx_documents_exp",     "date_expiration")
        await ajouter_index("maintenances_planifiees", "idx_maintenances_date", "date_prevue")
        # Détection des chevauchements de missions (camion / chauffeur + statut + période)
        await ajouter_index("missions",      "idx_missions_vehicule_periode",  "vehicule_id, statut, date_depart")
        await ajouter_index("missions",      "idx_missions_chauffeur_periode", "chauffeur_id, statut, date_depart")
        await ajouter_index("notifications", "idx_notifications_user_date",    "user_id, created_at")

        print(f"[Migration] {ok} changement(s) appliqué(s)")
    except Exception as err:
        print("[Migration] Erreur :", err)
        raise


async def initialiser_admin() -> None:
    """
    Garantit qu'un administrateur actif existe.
    Sur une base vide (production), le premier compte admin est créé à partir de
    ADMIN_EMAIL / ADMIN_PASSWORD (et ADMIN_NOM, optionnel). Sans ces variables, l'API
    démarre quand même mais signale qu'aucun admin ne peut se connecter.
    """
    if await db.query_one("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1"):
        return

    email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or ""
    if not email or len(password) < 8:
        print("[Admin] ATTENTION : aucun administrateur actif. Définissez ADMIN_EMAIL et "
              "ADMIN_PASSWORD (8 caractères minimum) puis redémarrez.")
        return

    hash_ = await hacher_mdp(password)
    existant = await db.query_one("SELECT id FROM users WHERE email = %s", [email])
    if existant:
        await db.execute(
            "UPDATE users SET role = 'admin', is_active = 1, password_hash = %s, "
            "token_version = token_version + 1 WHERE id = %s",
            [hash_, existant["id"]],
        )
    else:
        await db.execute(
            "INSERT INTO users (nom, email, password_hash, role) VALUES (%s, %s, %s, 'admin')",
            [os.getenv("ADMIN_NOM", "Administrateur"), email, hash_],
        )
    print(f"[Admin] Compte administrateur {email} initialisé")
