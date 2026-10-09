# Routes d'authentification — login et récupération du profil
from fastapi import Depends, Request

from .. import db
from ..auth import generer_token, verifier_mdp, verifier_token
from ..erreurs import ErreurApi
from ..limiteur import limiteur_connexion
from ..schemas.commun import Message
from ..schemas.comptes import Connexion, SessionOuverte, Utilisateur
from ..utils import Routeur, ligne_ou_404

router = Routeur()


@router.post("/login", response_model=SessionOuverte, summary="Se connecter")
async def login(donnees: Connexion, request: Request):
    """
    Vérifie email + mot de passe et retourne un token JWT (valide 24 h).
    Après 5 échecs sur un compte (ou 20 depuis une même IP) en 15 minutes : 429.
    """
    email = donnees.email.lower()
    ip = request.client.host if request.client else "inconnue"
    limiteur_connexion.verifier(ip, email)

    user = await db.query_one("SELECT * FROM users WHERE email = %s", [email])
    if not await verifier_mdp(donnees.password, user["password_hash"] if user else None):
        limiteur_connexion.enregistrer_echec(ip, email)
        raise ErreurApi(401, "Identifiants incorrects")

    # Vérifié après le mot de passe : l'état du compte n'est révélé qu'à son propriétaire
    if not user["is_active"]:
        raise ErreurApi(403, "Ce compte est désactivé. Contactez un administrateur.")

    limiteur_connexion.reinitialiser(email)
    public = {k: user[k] for k in ("id", "nom", "email", "role", "is_active", "created_at")}
    return {"token": generer_token(user), "user": public}


@router.post("/logout", response_model=Message, summary="Se déconnecter")
async def logout():
    """Sans effet côté serveur : le client supprime son token."""
    return {"message": "Déconnecté"}


@router.get("/me", response_model=Utilisateur, summary="Profil du compte connecté")
async def get_me(user: dict = Depends(verifier_token)):
    return ligne_ou_404(
        await db.query_one("SELECT id, nom, email, role, created_at FROM users WHERE id = %s", [user["id"]]),
        "Utilisateur introuvable",
    )
