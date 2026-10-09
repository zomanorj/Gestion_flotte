# Authentification par token JWT et contrôle des rôles
#
# Chaque requête authentifiée relit l'utilisateur en base (lecture par clé primaire) :
# - un compte désactivé perd l'accès immédiatement, sans attendre l'expiration du token ;
# - le rôle utilisé est celui de la base, pas celui figé dans le token ;
# - incrémenter users.token_version révoque tous les tokens déjà émis (changement de
#   mot de passe, de rôle, désactivation).
import asyncio
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import db
from .erreurs import ErreurApi

DUREE_TOKEN = timedelta(hours=24)
ROLES_GESTION = ("admin", "gestionnaire")

# Hash factice : au login d'un email inconnu, on vérifie quand même un mot de passe pour que
# le temps de réponse ne révèle pas l'existence du compte.
_HASH_FACTICE = bcrypt.hashpw(b"mot-de-passe-factice", bcrypt.gensalt(10))


def generer_token(user: dict) -> str:
    maintenant = datetime.now(timezone.utc)
    payload = {
        "id": user["id"], "nom": user["nom"], "email": user["email"], "role": user["role"],
        "tv": user.get("token_version", 0),
        "iat": maintenant,
        "exp": maintenant + DUREE_TOKEN,
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


async def utilisateur_depuis_token(token: str | None) -> dict:
    """Décode le token et vérifie que le compte est toujours actif et le token non révoqué."""
    if not token:
        raise ErreurApi(401, "Token manquant ou mal formaté")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ErreurApi(401, "Session expirée, veuillez vous reconnecter") from None
    except jwt.InvalidTokenError:
        raise ErreurApi(401, "Token invalide") from None

    user = await db.query_one(
        "SELECT id, nom, email, role, is_active, token_version FROM users WHERE id = %s",
        [payload.get("id")],
    )
    if not user or not user["is_active"]:
        raise ErreurApi(401, "Compte désactivé ou supprimé")
    if payload.get("tv", 0) != user["token_version"]:
        raise ErreurApi(401, "Session expirée, veuillez vous reconnecter")
    return {"id": user["id"], "nom": user["nom"], "email": user["email"], "role": user["role"]}


# auto_error=False : les erreurs restent au format de l'API ; le schéma sert aussi au bouton
# "Authorize" de la documentation /docs
_bearer = HTTPBearer(auto_error=False, description="Token obtenu via POST /api/auth/login")


async def verifier_token(
    identifiants: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> dict:
    """Dépendance : utilisateur authentifié via le header Authorization ("Bearer <token>")."""
    if identifiants is None or identifiants.scheme.lower() != "bearer":
        raise ErreurApi(401, "Token manquant ou mal formaté")
    return await utilisateur_depuis_token(identifiants.credentials)


def verifier_role(*roles: str):
    """Dépendance : l'utilisateur authentifié doit posséder l'un des rôles autorisés."""

    async def _dep(user: dict = Depends(verifier_token)) -> dict:
        if user["role"] not in roles:
            raise ErreurApi(403, f"Accès refusé. Rôles autorisés : {', '.join(roles)}")
        return user

    return _dep


# Raccourcis utilisés par les routers
Connecte     = Depends(verifier_token)
Gestionnaire = Depends(verifier_role(*ROLES_GESTION))
Admin        = Depends(verifier_role("admin"))


async def revoquer_tokens(conn, user_id: int) -> None:
    """Invalide tous les tokens émis pour cet utilisateur (conn : db ou transaction)."""
    await conn.execute("UPDATE users SET token_version = token_version + 1 WHERE id = %s", [user_id])


# bcrypt est volontairement lent (~100 ms) : exécuté hors de la boucle async pour ne pas
# bloquer les autres requêtes ni Socket.io.
async def hacher_mdp(mdp: str) -> str:
    return (await asyncio.to_thread(bcrypt.hashpw, mdp.encode(), bcrypt.gensalt(10))).decode()


async def verifier_mdp(mdp: str, hash_: str | None) -> bool:
    cible = hash_.encode() if hash_ else _HASH_FACTICE
    try:
        valide = await asyncio.to_thread(bcrypt.checkpw, mdp.encode(), cible)
    except ValueError:
        return False
    return valide and hash_ is not None
