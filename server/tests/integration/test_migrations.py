"""
Migrations du schéma (Alembic) : base vide, base historique, idempotence, retour arrière, verrou.

Chaque test travaille sur ses propres bases jetables, indépendamment de la base de la session.
"""
import uuid
from pathlib import Path

import pymysql
import pytest
from alembic import command
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from app import migrations
from app.config import config
from app.sql_outils import instructions_sql
from tests.conftest import _config_mysql

HISTORIQUE = Path(__file__).resolve().parents[1] / "donnees" / "historique"
SCRIPTS_HISTORIQUES = ["schema.sql", "migrate_modules.sql", "migrate_maintenances.sql", "migrate_clients.sql",
                       "migrate_v2.sql", "migrate_phase3.sql"]


@pytest.fixture
def nouvelle_base(monkeypatch):
    """Fabrique de bases vides ; la dernière créée devient la base « de l'API » (variables DB_*)."""
    mysql, creees = _config_mysql(), []
    admin = pymysql.connect(**mysql, autocommit=True)

    def creer() -> str:
        nom = f"flotte_migr_{uuid.uuid4().hex[:8]}"
        with admin.cursor() as cur:
            cur.execute(f"CREATE DATABASE `{nom}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        creees.append(nom)
        monkeypatch.delenv("MYSQL_URL", raising=False)
        for cle, valeur in (("DB_HOST", mysql["host"]), ("DB_PORT", str(mysql["port"])),
                            ("DB_USER", mysql["user"]), ("DB_PASSWORD", mysql["password"]), ("DB_NAME", nom)):
            monkeypatch.setenv(cle, valeur)
        config.cache_clear()  # la configuration est mise en cache : relue avec cette base
        return nom

    yield creer
    config.cache_clear()
    with admin.cursor() as cur:
        for nom in creees:
            cur.execute(f"DROP DATABASE IF EXISTS `{nom}`")
    admin.close()


def executer(base: str, requete: str, params=None) -> list[dict]:
    with pymysql.connect(**_config_mysql(), database=base, autocommit=True,
                         cursorclass=pymysql.cursors.DictCursor) as cx, cx.cursor() as cur:
        cur.execute(requete, params)
        return list(cur.fetchall())


def construire_base_historique(base: str, scripts: list[str] = SCRIPTS_HISTORIQUES) -> None:
    """
    Base telle que l'ancien système la créait (scripts du dossier database/ d'avant Alembic).
    Une seule connexion, comme le client mysql : migrate_phase3.sql utilise des variables de session.
    """
    with pymysql.connect(**_config_mysql(), database=base, autocommit=True) as cx, cx.cursor() as cur:
        for script in scripts:
            for instruction in instructions_sql((HISTORIQUE / script).read_text(encoding="utf-8")):
                cur.execute(instruction)


def schema(base: str) -> dict:
    """Description comparable d'un schéma : colonnes, index et clés étrangères (ordre ignoré)."""
    colonnes = {
        (r["TABLE_NAME"], r["COLUMN_NAME"]): (r["COLUMN_TYPE"], r["IS_NULLABLE"], r["COLUMN_DEFAULT"], r["EXTRA"])
        for r in executer(base, """SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                                   FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = %s""", [base])
    }
    index = {
        (r["TABLE_NAME"], r["INDEX_NAME"]): (r["colonnes"], r["NON_UNIQUE"])
        for r in executer(base, """SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
                                          GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS colonnes
                                   FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = %s
                                   GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE""", [base])
    }
    cles = {
        (r["TABLE_NAME"], r["COLUMN_NAME"]): (r["REFERENCED_TABLE_NAME"], r["REFERENCED_COLUMN_NAME"], r["DELETE_RULE"])
        for r in executer(base, """SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME,
                                          k.REFERENCED_COLUMN_NAME, r.DELETE_RULE
                                   FROM information_schema.KEY_COLUMN_USAGE k
                                   JOIN information_schema.REFERENTIAL_CONSTRAINTS r
                                     ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
                                   WHERE k.TABLE_SCHEMA = %s AND k.REFERENCED_TABLE_NAME IS NOT NULL""", [base])
    }
    return {"colonnes": colonnes, "index": index, "cles_etrangeres": cles}


def revision(base: str) -> str:
    return executer(base, "SELECT version_num FROM alembic_version")[0]["version_num"]


def tete() -> str:
    return ScriptDirectory.from_config(migrations.configuration_alembic()).get_current_head()


class TestBaseVide:
    def test_toutes_les_revisions_appliquees(self, nouvelle_base):
        base = nouvelle_base()
        assert migrations.mettre_a_jour_schema() == tete()
        tables = {r["TABLE_NAME"] for r in executer(
            base, "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s", [base])}
        assert {"users", "vehicules", "missions", "notification_etats", "alembic_version"} <= tables

    def test_relancer_ne_change_rien(self, nouvelle_base):
        base = nouvelle_base()
        migrations.mettre_a_jour_schema()
        avant = schema(base)
        assert migrations.mettre_a_jour_schema() == tete()
        assert schema(base) == avant

    def test_integrite_de_la_revision_0002(self, nouvelle_base):
        base = nouvelle_base()
        migrations.mettre_a_jour_schema()
        s = schema(base)
        assert s["cles_etrangeres"][("notifications", "user_id")] == ("users", "id", "CASCADE")
        assert s["cles_etrangeres"][("notifications", "vehicule_id")] == ("vehicules", "id", "SET NULL")
        index_documents = [nom for (table, nom) in s["index"] if table == "documents"]
        assert "idx_documents_exp" not in index_documents and "idx_documents_expiration" in index_documents


class TestBaseHistorique:
    def test_devient_identique_a_une_base_neuve(self, nouvelle_base):
        neuve = nouvelle_base()
        migrations.mettre_a_jour_schema()
        attendu = schema(neuve)

        historique = nouvelle_base()
        construire_base_historique(historique)
        assert migrations.mettre_a_jour_schema() == tete()

        obtenu = schema(historique)
        for partie in ("colonnes", "index", "cles_etrangeres"):
            assert obtenu[partie] == attendu[partie], partie

    def test_donnees_conservees_et_orphelines_nettoyees(self, nouvelle_base):
        base = nouvelle_base()
        construire_base_historique(base)
        executer(base, "INSERT INTO users (nom, email, password_hash, role) VALUES ('A', 'a@x.mg', 'h', 'admin')")
        executer(base, "INSERT INTO vehicules (immatriculation, marque, modele, annee) VALUES ('MAD-1', 'a', 'b', 2020)")
        # Notifications orphelines : sans clé étrangère, l'ancien schéma les laissait passer
        executer(base, "INSERT INTO notifications (type, titre, user_id) VALUES ('t', 'compte supprimé', 999)")
        executer(base, "INSERT INTO notifications (type, titre, vehicule_id) VALUES ('t', 'camion supprimé', 999)")

        migrations.mettre_a_jour_schema()

        assert executer(base, "SELECT immatriculation FROM vehicules") == [{"immatriculation": "MAD-1"}]
        assert executer(base, "SELECT is_active, token_version FROM users WHERE email = 'a@x.mg'") == [
            {"is_active": 1, "token_version": 0}]
        restantes = executer(base, "SELECT titre, vehicule_id FROM notifications")
        assert restantes == [{"titre": "camion supprimé", "vehicule_id": None}]

    def test_base_historique_partielle(self, nouvelle_base):
        """Comme en production Railway : l'import historique s'arrêtait à migrate_phase3 sur MySQL 8."""
        neuve = nouvelle_base()
        migrations.mettre_a_jour_schema()
        partielle = nouvelle_base()
        construire_base_historique(partielle, SCRIPTS_HISTORIQUES[:-1])

        migrations.mettre_a_jour_schema()
        assert schema(partielle) == schema(neuve)


class TestRetourArriere:
    def test_0002_aller_retour(self, nouvelle_base):
        base = nouvelle_base()
        migrations.mettre_a_jour_schema()
        apres = schema(base)
        moteur = create_engine(migrations.url_base_de_donnees(), poolclass=NullPool)

        with moteur.connect() as cx:
            command.downgrade(migrations.configuration_alembic(cx), "0001")
            cx.commit()
        assert revision(base) == "0001"
        assert ("documents", "idx_documents_exp") in schema(base)["index"]

        assert migrations.mettre_a_jour_schema() == tete()
        assert schema(base) == apres

    def test_le_socle_ne_se_defait_pas(self, nouvelle_base):
        nouvelle_base()
        migrations.mettre_a_jour_schema()
        moteur = create_engine(migrations.url_base_de_donnees(), poolclass=NullPool)
        with moteur.connect() as cx, pytest.raises(NotImplementedError):
            command.downgrade(migrations.configuration_alembic(cx), "base")


def test_verrou_empeche_deux_migrations_simultanees(nouvelle_base, monkeypatch):
    nouvelle_base()
    monkeypatch.setattr(migrations, "ATTENTE_VERROU_SECONDES", 1)
    occupant = create_engine(migrations.url_base_de_donnees(), poolclass=NullPool).connect()
    occupant.exec_driver_sql("SELECT GET_LOCK(%s, 0)", (migrations.VERROU,))
    try:
        with pytest.raises(RuntimeError, match="Verrou de migration"):
            migrations.mettre_a_jour_schema()
    finally:
        occupant.exec_driver_sql("SELECT RELEASE_LOCK(%s)", (migrations.VERROU,))
        occupant.close()
    assert migrations.mettre_a_jour_schema() == tete()


def test_historique_des_revisions_lineaire():
    """Une seule tête : deux révisions créées en parallèle sur des branches doivent être fusionnées."""
    script = ScriptDirectory.from_config(migrations.configuration_alembic())
    assert len(script.get_heads()) == 1
    revisions = list(script.walk_revisions())
    assert [r.revision for r in reversed(revisions)][:2] == ["0001", "0002"]
    assert all(r.doc for r in revisions), "chaque révision doit décrire ce qu'elle change"
