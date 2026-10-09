# Schéma de la base : migrations versionnées (Alembic, dossier migrations/)
#
# Au démarrage, mettre_a_jour_schema() amène la base à la dernière révision :
#   - base vide            → toutes les révisions sont appliquées depuis le socle (0001) ;
#   - base versionnée      → seules les révisions manquantes sont appliquées ;
#   - base historique      → base créée avant les migrations versionnées (fichiers SQL de
#     l'ancien dossier database/, ancien rattrapage au démarrage) : elle est complétée
#     jusqu'au socle, marquée à la révision 0001, puis mise à jour normalement.
#
# Un verrou MySQL (GET_LOCK) empêche deux instances de l'API de migrer en même temps.
# Pour faire évoluer le schéma : ajouter une révision dans migrations/versions/
# (`alembic revision --rev-id 0003 -m "..."`), jamais de SQL ailleurs.
import importlib.util
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import URL, create_engine
from sqlalchemy.engine import Connection
from sqlalchemy.pool import NullPool

from .db import _config_connexion

RACINE = Path(__file__).resolve().parents[1]
VERROU = "flotte_migrations"
ATTENTE_VERROU_SECONDES = 300
REVISION_SOCLE = "0001"


def url_base_de_donnees() -> URL:
    """Même base que l'API (MYSQL_URL ou variables DB_*), via le pilote synchrone PyMySQL."""
    c = _config_connexion()
    return URL.create("mysql+pymysql", username=c["user"], password=c["password"], host=c["host"],
                      port=int(c["port"]), database=c["db"], query={"charset": "utf8mb4"})


def configuration_alembic(connexion: Connection | None = None) -> Config:
    config = Config(str(RACINE / "alembic.ini"))
    config.set_main_option("script_location", str(RACINE / "migrations"))
    if connexion is not None:
        config.attributes["connection"] = connexion
    return config


def _tables(cx: Connection) -> set[str]:
    return {r[0] for r in cx.exec_driver_sql(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()")}


def revision_actuelle(cx: Connection) -> str | None:
    return MigrationContext.configure(cx).get_current_revision()


def etat_de_la_base(cx: Connection) -> str:
    """'vide', 'historique' (créée avant les migrations versionnées) ou 'versionnee'."""
    tables = _tables(cx)
    if "alembic_version" in tables:
        return "versionnee"
    return "historique" if "users" in tables else "vide"


def mettre_a_jour_schema() -> str:
    """Applique les migrations en attente et retourne la révision finale de la base."""
    moteur = create_engine(url_base_de_donnees(), poolclass=NullPool)
    with moteur.connect() as cx:
        obtenu = cx.exec_driver_sql("SELECT GET_LOCK(%s, %s)", (VERROU, ATTENTE_VERROU_SECONDES)).scalar()
        if obtenu != 1:
            raise RuntimeError("Verrou de migration non obtenu : une autre instance migre-t-elle la base ?")
        cx.commit()  # le verrou est lié à la session MySQL, il survit à la fin de transaction
        try:
            if etat_de_la_base(cx) == "historique":
                rattraper_base_historique(cx)
                cx.commit()
                command.stamp(configuration_alembic(cx), REVISION_SOCLE)
                print(f"[Migration] Base historique complétée et marquée à la révision {REVISION_SOCLE}")
            command.upgrade(configuration_alembic(cx), "head")
            cx.commit()
            return revision_actuelle(cx)
        finally:
            cx.exec_driver_sql("SELECT RELEASE_LOCK(%s)", (VERROU,))
            cx.commit()


# ── Bases historiques ──────────────────────────────────────────────────────────
# Ce qui suit reproduit, sans le modifier, ce que l'ancien système garantissait. Ne plus le
# faire évoluer : toute nouveauté passe par une révision Alembic.

# Colonnes ajoutées après coup sur des tables existantes : (table, colonne, définition)
_COLONNES_HISTORIQUES = [
    ("users", "is_active", "TINYINT(1) NOT NULL DEFAULT 1 AFTER role"),
    ("users", "token_version", "INT NOT NULL DEFAULT 0 AFTER is_active"),
    ("chauffeurs", "salaire_base", "DECIMAL(10,2) DEFAULT 800000 AFTER statut"),
    ("chauffeurs", "prime_mission", "DECIMAL(10,2) DEFAULT 50000 AFTER salaire_base"),
    ("documents", "fichier_nom", "VARCHAR(255) NULL"),
    ("documents", "fichier_url", "VARCHAR(500) NULL"),
    ("missions", "client_id", "INT NULL AFTER chauffeur_id"),
    ("missions", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ("vehicules", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ("chauffeurs", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ("notifications", "user_id", "INT NULL AFTER vehicule_id"),
]

# Index du socle : (table, nom, colonnes)
_INDEX_HISTORIQUES = [
    ("missions", "idx_missions_statut", "statut"),
    ("missions", "idx_missions_date", "date_depart"),
    ("missions", "idx_missions_client", "client_id"),
    ("missions", "idx_missions_vehicule_periode", "vehicule_id, statut, date_depart"),
    ("missions", "idx_missions_chauffeur_periode", "chauffeur_id, statut, date_depart"),
    ("carburant", "idx_carburant_date", "date_plein"),
    ("carburant", "idx_carburant_vehicule", "vehicule_id"),
    ("depenses", "idx_depenses_date", "date_depense"),
    ("depenses", "idx_depenses_vehicule", "vehicule_id"),
    ("documents", "idx_documents_exp", "date_expiration"),
    ("documents", "idx_documents_expiration", "date_expiration"),
    ("maintenances_planifiees", "idx_maintenances_date", "date_prevue"),
    ("maintenances_planifiees", "idx_maintenances_vehicule", "vehicule_id"),
    ("notifications", "idx_notifications_user_date", "user_id, created_at"),
]


def _tables_du_socle() -> dict[str, str]:
    """{table: CREATE TABLE} de la révision socle (fichier de migration, importé par son chemin)."""
    chemin = RACINE / "migrations" / "versions" / "0001_socle.py"
    spec = importlib.util.spec_from_file_location("migration_socle", chemin)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    tables = {}
    for instruction in module.TABLES:
        nom = instruction.split("`")[1]
        tables[nom] = instruction
    return tables


def _existe(cx: Connection, requete: str, params: tuple) -> bool:
    return cx.exec_driver_sql(requete, params).scalar() > 0


def rattraper_base_historique(cx: Connection) -> None:
    """Complète une base créée par l'ancien système pour qu'elle corresponde au socle."""
    presentes = _tables(cx)
    for table, creation in _tables_du_socle().items():  # dans l'ordre des clés étrangères
        if table not in presentes:
            cx.exec_driver_sql(creation)
            print(f"[Migration] + table {table}")

    for table, colonne, definition in _COLONNES_HISTORIQUES:
        if not _existe(cx, "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                           "AND TABLE_NAME = %s AND COLUMN_NAME = %s", (table, colonne)):
            cx.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {colonne} {definition}")
            print(f"[Migration] + {table}.{colonne}")

    for table, index, colonnes in _INDEX_HISTORIQUES:
        if not _existe(cx, "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() "
                           "AND TABLE_NAME = %s AND INDEX_NAME = %s", (table, index)):
            cx.exec_driver_sql(f"CREATE INDEX {index} ON {table} ({colonnes})")

    if not _existe(cx, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() "
                       "AND TABLE_NAME = 'missions' AND CONSTRAINT_NAME = 'fk_mission_client'", ()):
        cx.exec_driver_sql("UPDATE missions SET client_id = NULL "
                           "WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM clients)")
        cx.exec_driver_sql("ALTER TABLE missions ADD CONSTRAINT fk_mission_client FOREIGN KEY (client_id) "
                           "REFERENCES clients (id) ON DELETE SET NULL")
