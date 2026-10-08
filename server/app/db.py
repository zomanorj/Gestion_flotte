# Configuration et pool de connexions MySQL (aiomysql)
#
# Les requêtes utilisent le style de paramètres %s de PyMySQL.
# Sans paramètres (params=None), les % littéraux du SQL (DATE_FORMAT, LIKE…) sont laissés tels quels.
import os
from decimal import Decimal
from urllib.parse import urlparse, unquote

import aiomysql

_pool: aiomysql.Pool | None = None


def _config_connexion() -> dict:
    """Accepte soit MYSQL_URL (Railway) soit les variables séparées (local/.env)."""
    url = os.getenv("MYSQL_URL")
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
        "host":     os.getenv("DB_HOST", "localhost"),
        "port":     int(os.getenv("DB_PORT", "3306")),
        "user":     os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "db":       os.getenv("DB_NAME", "flotte_db"),
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
    )
    print("✅ Connexion MySQL établie")


async def fermer() -> None:
    if _pool:
        _pool.close()
        await _pool.wait_closed()


def _normaliser(row: dict) -> dict:
    # DECIMAL → float pour pouvoir calculer directement et sérialiser en nombre JSON
    return {k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()}


async def query(sql: str, params: list | tuple | None = None) -> list[dict]:
    """Exécute une requête de lecture et retourne la liste des lignes (dict)."""
    async with _pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            rows = await cur.fetchall()
            return [_normaliser(r) for r in rows]


async def query_one(sql: str, params: list | tuple | None = None) -> dict | None:
    rows = await query(sql, params)
    return rows[0] if rows else None


async def execute(sql: str, params: list | tuple | None = None) -> int:
    """Exécute une requête d'écriture et retourne l'id inséré (lastrowid)."""
    async with _pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            return cur.lastrowid
