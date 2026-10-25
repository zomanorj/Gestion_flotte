# Authentification par token JWT et contrôle des rôles
#
# Chaque requête authentifiée relit l'utilisateur en base (lecture par clé primaire) :
# - un compte désactivé perd l'accès immédiatement, sans attendre l'expiration du token ;
# - le rôle utilisé est celui de la base, pas celui figé dans le token ;
# - incrémenter users.token_version révoque tous les tokens déjà émis (changement de
#   mot de passe, de rôle, désactivation).
import asyncio
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import config
from .exceptions import AccesRefuse, NonAuthentifie
from .repositories import comptes as depot_comptes

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
        "exp": maintenant + timedelta(hours=config().duree_token_heures),
    }
    return jwt.encode(payload, config().jwt_secret.get_secret_value(), algorithm="HS256")


async def utilisateur_depuis_token(token: str | None) -> dict:
    """Décode le token et vérifie que le compte est toujours actif et le token non révoqué."""
    if not token:
        raise NonAuthentifie("Token manquant ou mal formaté")
    try:
        payload = jwt.decode(token, config().jwt_secret.get_secret_value(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise NonAuthentifie("Session expirée, veuillez vous reconnecter") from None
    except jwt.InvalidTokenError:
        raise NonAuthentifie("Token invalide") from None

    user = await depot_comptes.etat_session(payload.get("id"))
    if not user or not user["is_active"]:
        raise NonAuthentifie("Compte désactivé ou supprimé")
    if payload.get("tv", 0) != user["token_version"]:
        raise NonAuthentifie("Session expirée, veuillez vous reconnecter")
    return {"id": user["id"], "nom": user["nom"], "email": user["email"], "role": user["role"]}


# auto_error=False : les erreurs restent au format de l'API ; le schéma sert aussi au bouton
# "Authorize" de la documentation /docs
_bearer = HTTPBearer(auto_error=False, description="Token obtenu via POST /api/auth/login")


async def verifier_token(
    identifiants: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> dict:
    """Dépendance : utilisateur authentifié via le header Authorization ("Bearer <token>")."""
    if identifiants is None or identifiants.scheme.lower() != "bearer":
        raise NonAuthentifie("Token manquant ou mal formaté")
    return await utilisateur_depuis_token(identifiants.credentials)


def verifier_role(*roles: str):
    """Dépendance : l'utilisateur authentifié doit posséder l'un des rôles autorisés."""

    async def _dep(user: dict = Depends(verifier_token)) -> dict:
        if user["role"] not in roles:
            raise AccesRefuse(f"Accès refusé. Rôles autorisés : {', '.join(roles)}")
        return user

    return _dep


async def refuser_en_demo() -> None:
    """Dépendance : action bloquée sur la démo publique (comptes partagés, fichiers)."""
    if config().mode_demo:
        raise AccesRefuse("Action désactivée sur la version de démonstration")


# Raccourcis utilisés par les routers
Connecte     = Depends(verifier_token)
Gestionnaire = Depends(verifier_role(*ROLES_GESTION))
Admin        = Depends(verifier_role("admin"))
HorsDemo     = Depends(refuser_en_demo)


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
