# Configuration et pool de connexions MySQL (aiomysql)
#
# Les requêtes utilisent le style de paramètres %s de PyMySQL.
# Sans paramètres (params=None), les % littéraux du SQL (DATE_FORMAT, LIKE…) sont laissés tels quels.
#
# Écritures sur plusieurs tables : toujours dans `async with db.transaction() as tx:`
# (tx expose query / query_one / execute ; commit à la sortie, rollback sur exception).
from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Protocol
from urllib.parse import unquote, urlparse

import aiomysql

from .config import config
from .temps import decalage_mysql

_pool: aiomysql.Pool | None = None


def _config_connexion() -> dict:
    """Accepte soit MYSQL_URL (Railway) soit les variables séparées (local/.env)."""
    c = config()
    url = c.mysql_url
    if url:
        u = urlparse(url)
        return {
            "host":     u.hostname or "localhost",
            "port":     u.port or 3306,
            "user":     unquote(u.username or "root"),
            "password": unquote(u.password or ""),
            "db":       u.path.lstrip("/") or "flotte_db",
        }
    return {
        "host":     c.db_host,
        "port":     c.db_port,
        "user":     c.db_user,
        "password": c.db_password.get_secret_value(),
        "db":       c.db_name,
    }


async def connecter() -> None:
    global _pool
    _pool = await aiomysql.create_pool(
        **_config_connexion(),
        minsize=1,
        maxsize=10,
        charset="utf8mb4",
        autocommit=True,
        cursorclass=aiomysql.DictCursor,
        # CURDATE() / NOW() en heure locale de l'application, pas celle du serveur MySQL
        init_command=f"SET time_zone = '{decalage_mysql()}'",
        pool_recycle=3600,
    )
    print("[DB] Connexion MySQL établie")


async def fermer() -> None:
    if _pool:
        _pool.close()
        await _pool.wait_closed()


def _normaliser(row: dict) -> dict:
    # DECIMAL → float pour pouvoir calculer directement et sérialiser en nombre JSON
    return {k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()}


class Executeur(Protocol):
    """
    Ce qui exécute du SQL : le module db lui-même (une connexion du pool par requête, en
    autocommit) ou la Connexion d'une transaction. Les repositories acceptent l'un ou l'autre.
    """

    async def query(self, sql: str, params: list | tuple | None = None) -> list[dict]: ...

    async def query_one(self, sql: str, params: list | tuple | None = None) -> dict | None: ...

    async def execute(self, sql: str, params: list | tuple | None = None) -> int: ...


class Connexion:
    """Accès SQL sur une connexion donnée (utilisé pour les transactions)."""

    def __init__(self, conn: aiomysql.Connection):
        self._conn = conn

    async def query(self, sql: str, params: list | tuple | None = None) -> list[dict]:
        async with self._conn.cursor() as cur:
            await cur.execute(sql, params)
            return [_normaliser(r) for r in await cur.fetchall()]

    async def query_one(self, sql: str, params: list | tuple | None = None) -> dict | None:
        rows = await self.query(sql, params)
        return rows[0] if rows else None

    async def execute(self, sql: str, params: list | tuple | None = None) -> int:
        """Exécute une écriture et retourne l'id inséré (lastrowid)."""
        async with self._conn.cursor() as cur:
            await cur.execute(sql, params)
            return cur.lastrowid


@asynccontextmanager
async def transaction():
    async with _pool.acquire() as conn:
        await conn.begin()
        try:
            yield Connexion(conn)
            await conn.commit()
        except BaseException:
            await conn.rollback()
            raise


async def query(sql: str, params: list | tuple | None = None) -> list[dict]:
    """Exécute une requête de lecture et retourne la liste des lignes (dict)."""
    async with _pool.acquire() as conn:
        return await Connexion(conn).query(sql, params)


async def query_one(sql: str, params: list | tuple | None = None) -> dict | None:
    rows = await query(sql, params)
    return rows[0] if rows else None


async def execute(sql: str, params: list | tuple | None = None) -> int:
    """Exécute une requête d'écriture (autocommit) et retourne l'id inséré (lastrowid)."""
    async with _pool.acquire() as conn:
        return await Connexion(conn).execute(sql, params)
