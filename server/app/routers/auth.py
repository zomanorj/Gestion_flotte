# Routes d'authentification — login et récupération du profil
from fastapi import APIRouter, Depends, Request

from .. import db
from ..auth import generer_token, verifier_mdp, verifier_token
from ..erreurs import ErreurApi
from ..limiteur import limiteur_connexion
from ..utils import corps

router = APIRouter()


@router.post("/login")
async def login(request: Request):
    """Vérifie email + mot de passe, retourne un token JWT si valide."""
    body = await corps(request)
    email, password = body.get("email"), body.get("password")

    if not isinstance(email, str) or not isinstance(password, str) or not email or not password:
        raise ErreurApi(400, "Email et mot de passe requis")

    email = email.strip().lower()
    ip = request.client.host if request.client else "inconnue"
    limiteur_connexion.verifier(ip, email)

    user = await db.query_one("SELECT * FROM users WHERE email = %s", [email])
    if not await verifier_mdp(password, user["password_hash"] if user else None):
        limiteur_connexion.enregistrer_echec(ip, email)
        raise ErreurApi(401, "Identifiants incorrects")

    # Vérifié après le mot de passe : l'état du compte n'est révélé qu'à son propriétaire
    if not user["is_active"]:
        raise ErreurApi(403, "Ce compte est désactivé. Contactez un administrateur.")

    limiteur_connexion.reinitialiser(email)
    token = generer_token(user)

    # Retour du token et des infos utilisateur (sans données sensibles)
    for champ in ("password_hash", "token_version"):
        user.pop(champ, None)
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
