# Authentification par token JWT et contrôle des rôles
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Request

from .erreurs import ErreurApi


def generer_token(user: dict) -> str:
    maintenant = datetime.now(timezone.utc)
    payload = {
        "id": user["id"], "nom": user["nom"], "email": user["email"], "role": user["role"],
        "iat": maintenant,
        "exp": maintenant + timedelta(hours=24),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


def verifier_token(request: Request) -> dict:
    """
    Vérifie le token JWT dans le header Authorization ("Bearer <token>").
    Retourne l'utilisateur décodé : { id, nom, email, role, iat, exp }.
    """
    auth = request.headers.get("authorization")
    if not auth or not auth.startswith("Bearer "):
        raise ErreurApi(401, "Token manquant ou mal formaté")

    token = auth.split(" ")[1]
    try:
        return jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ErreurApi(401, "Session expirée, veuillez vous reconnecter")
    except jwt.InvalidTokenError:
        raise ErreurApi(401, "Token invalide")


def verifier_role(*roles: str):
    """Dépendance : l'utilisateur authentifié doit posséder l'un des rôles autorisés."""

    def _dep(user: dict = Depends(verifier_token)) -> dict:
        if user.get("role") not in roles:
            raise ErreurApi(403, f"Accès refusé. Rôles autorisés : {', '.join(roles)}")
        return user

    return _dep


# Raccourcis utilisés par les routers
Connecte     = Depends(verifier_token)
Gestionnaire = Depends(verifier_role("admin", "gestionnaire"))
Admin        = Depends(verifier_role("admin"))


def hacher_mdp(mdp: str) -> str:
    return bcrypt.hashpw(mdp.encode(), bcrypt.gensalt(10)).decode()


def verifier_mdp(mdp: str, hash_: str) -> bool:
    try:
        return bcrypt.checkpw(mdp.encode(), hash_.encode())
    except ValueError:
        return False
