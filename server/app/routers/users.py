# Routes gestion des utilisateurs — admin uniquement (sauf changement de mot de passe)
from fastapi import Depends

from ..auth import verifier_role, verifier_token
from ..schemas.commun import Message
from ..schemas.comptes import (
    ChangementMotDePasse,
    MotDePasseChange,
    Utilisateur,
    UtilisateurCreation,
    UtilisateurMiseAJour,
)
from ..services import comptes as service
from ..utils import Routeur

router = Routeur()
admin_seulement = verifier_role("admin")


@router.get("", response_model=list[Utilisateur], dependencies=[Depends(admin_seulement)],
            summary="Liste des comptes")
async def lister():
    return await service.lister()


@router.post("", status_code=201, response_model=Utilisateur, dependencies=[Depends(admin_seulement)],
             summary="Créer un compte")
async def creer(donnees: UtilisateurCreation):
    return await service.creer(donnees)


@router.put("/{id}", response_model=Utilisateur, summary="Modifier un compte")
async def modifier(id: int, donnees: UtilisateurMiseAJour, auteur: dict = Depends(admin_seulement)):
    """
    Seuls les champs envoyés sont modifiés. Un admin ne peut ni se rétrograder ni se
    désactiver. Un changement de rôle ou une désactivation coupe les sessions du compte.
    """
    return await service.modifier(id, donnees, auteur)


@router.patch("/{id}/password", response_model=MotDePasseChange, response_model_exclude_none=True,
              summary="Changer un mot de passe")
async def changer_mot_de_passe(id: int, donnees: ChangementMotDePasse, auteur: dict = Depends(verifier_token)):
    """
    Un administrateur réinitialise n'importe quel compte ; un utilisateur change le sien en
    confirmant son mot de passe actuel. Les sessions existantes sont révoquées ; un nouveau token
    est renvoyé à l'utilisateur qui change son propre mot de passe.
    """
    return await service.changer_mot_de_passe(id, donnees, auteur)


@router.delete("/{id}", response_model=Message, summary="Désactiver un compte")
async def desactiver(id: int, auteur: dict = Depends(admin_seulement)):
    """Les données du compte sont conservées ; ses sessions sont coupées."""
    nom = await service.desactiver(id, auteur)
    return {"message": f"Compte de {nom} désactivé"}
