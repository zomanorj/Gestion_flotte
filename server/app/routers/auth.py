# Routes d'authentification
from fastapi import Depends, Request

from ..auth import verifier_token
from ..schemas.commun import Message
from ..schemas.comptes import Connexion, SessionOuverte, Utilisateur
from ..services import comptes as service
from ..utils import Routeur

router = Routeur()


@router.post("/login", response_model=SessionOuverte, summary="Se connecter")
async def login(donnees: Connexion, request: Request):
    """
    Vérifie email + mot de passe et retourne un token JWT (valide 24 h).
    Après 5 échecs sur un compte (ou 20 depuis une même IP) en 15 minutes : 429.
    """
    ip = request.client.host if request.client else "inconnue"
    return await service.se_connecter(donnees.email, donnees.password, ip)


@router.post("/logout", response_model=Message, summary="Se déconnecter")
async def logout():
    """Sans effet côté serveur : le client supprime son token."""
    return {"message": "Déconnecté"}


@router.get("/me", response_model=Utilisateur, summary="Profil du compte connecté")
async def profil(user: dict = Depends(verifier_token)):
    return await service.profil(user["id"])
