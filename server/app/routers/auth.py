# Routes d'authentification — login et récupération du profil
from fastapi import APIRouter, Depends, Request

from .. import db
from ..auth import generer_token, verifier_mdp, verifier_token
from ..erreurs import ErreurApi
from ..utils import corps

router = APIRouter()


@router.post("/login")
async def login(request: Request):
    """Vérifie email + mot de passe, retourne un token JWT si valide."""
    body = await corps(request)
    email, password = body.get("email"), body.get("password")

    if not email or not password:
        raise ErreurApi(400, "Email et mot de passe requis")

    user = await db.query_one("SELECT * FROM users WHERE email = %s", [email])
    if not user or not verifier_mdp(password, user["password_hash"]):
        raise ErreurApi(401, "Identifiants incorrects")

    token = generer_token(user)

    # Retour du token et des infos utilisateur (sans le hash du mot de passe)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@router.post("/logout")
async def logout():
    return {"message": "Déconnecté"}


@router.get("/me")
async def get_me(user: dict = Depends(verifier_token)):
    """Profil du compte connecté — nécessite un token valide."""
    row = await db.query_one(
        "SELECT id, nom, email, role, created_at FROM users WHERE id = %s", [user["id"]]
    )
    if not row:
        raise ErreurApi(404, "Utilisateur introuvable")
    return row
