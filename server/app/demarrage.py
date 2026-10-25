# Initialisation des données au démarrage (après les migrations du schéma)
from pathlib import Path

from . import db
from .auth import hacher_mdp
from .config import config
from .sql_outils import instructions_sql

FICHIER_DEMO = Path(__file__).resolve().parents[1] / "donnees" / "demo.sql"


async def _executer_demo(tx) -> None:
    for instruction in instructions_sql(FICHIER_DEMO.read_text(encoding="utf-8")):
        await tx.execute(instruction)


async def charger_donnees_demo() -> bool:
    """
    Avec SEED_DEMO=1 (ou MODE_DEMO=1), charge les données de démonstration (comptes en
    password123, camions, missions…) dans une base sans aucun compte. Retourne True si chargé.
    """
    if not config().charger_demo:
        return False
    if (await db.query_one("SELECT COUNT(*) AS nb FROM users"))["nb"]:
        return False
    async with db.transaction() as tx:
        await _executer_demo(tx)
    print("[Démo] Données de démonstration chargées (comptes en password123)")
    return True


async def reinitialiser_demo() -> None:
    """
    Mode démo : vide toutes les tables puis recharge les données de démonstration.
    TRUNCATE remet les compteurs AUTO_INCREMENT à 1, nécessaire car demo.sql référence
    les lignes par leur id.
    """
    async with db.transaction() as tx:
        tables = await tx.query(
            "SELECT TABLE_NAME AS nom FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'alembic_version'"
        )
        await tx.execute("SET FOREIGN_KEY_CHECKS = 0")
        try:
            for table in tables:
                await tx.execute(f"TRUNCATE TABLE `{table['nom']}`")
        finally:
            await tx.execute("SET FOREIGN_KEY_CHECKS = 1")
        await _executer_demo(tx)
    print("[Démo] Données de démonstration réinitialisées")


async def initialiser_admin() -> None:
    """
    Garantit qu'un administrateur actif existe.
    Sur une base vide (production), le premier compte admin est créé à partir de
    ADMIN_EMAIL / ADMIN_PASSWORD (et ADMIN_NOM, optionnel). Sans ces variables, l'API
    démarre quand même mais signale qu'aucun admin ne peut se connecter.
    """
    if await db.query_one("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1"):
        return

    email = (config().admin_email or "").strip().lower()
    password = config().mot_de_passe_admin
    if not email:
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
            [config().admin_nom, email, hash_],
        )
    print(f"[Admin] Compte administrateur {email} initialisé")
