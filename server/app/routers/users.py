# Routes gestion des utilisateurs — admin uniquement (sauf changement de mot de passe)
from fastapi import Depends

from .. import db
from ..auth import generer_token, hacher_mdp, revoquer_tokens, verifier_mdp, verifier_role, verifier_token
from ..erreurs import ErreurApi
from ..schemas.commun import Message
from ..schemas.comptes import (
    ChangementMotDePasse,
    MotDePasseChange,
    Utilisateur,
    UtilisateurCreation,
    UtilisateurMiseAJour,
)
from ..socket import deconnecter_utilisateur
from ..utils import Routeur, clause_set, ligne_ou_404

router = Routeur()
admin_only = verifier_role("admin")

SELECT_PUBLIC = "SELECT id, nom, email, role, is_active, created_at FROM users WHERE id = %s"


@router.get("", response_model=list[Utilisateur], summary="Liste des comptes")
async def get_all(_u: dict = Depends(admin_only)):
    return await db.query("""
        SELECT u.id, u.nom, u.email, u.role, u.is_active, u.created_at,
               c.id AS chauffeur_id, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM users u
        LEFT JOIN chauffeurs c ON c.user_id = u.id
        ORDER BY u.role ASC, u.nom ASC
    """)


@router.post("", status_code=201, response_model=Utilisateur, summary="Créer un compte")
async def create(donnees: UtilisateurCreation, _u: dict = Depends(admin_only)):
    if await db.query("SELECT id FROM users WHERE email = %s", [donnees.email]):
        raise ErreurApi(409, "Un compte avec cet email existe déjà")

    new_id = await db.execute(
        "INSERT INTO users (nom, email, password_hash, role) VALUES (%s, %s, %s, %s)",
        [donnees.nom, donnees.email, await hacher_mdp(donnees.password), donnees.role],
    )
    return await db.query_one(SELECT_PUBLIC, [new_id])


@router.put("/{id}", response_model=Utilisateur, summary="Modifier un compte")
async def update(id: int, donnees: UtilisateurMiseAJour, user: dict = Depends(admin_only)):
    """
    Seuls les champs envoyés sont modifiés. Un admin ne peut ni se rétrograder ni se
    désactiver. Un changement de rôle ou une désactivation coupe les sessions du compte.
    """
    champs = donnees.champs_fournis()
    if id == user["id"] and champs.get("role", "admin") != "admin":
        raise ErreurApi(403, "Vous ne pouvez pas modifier votre propre rôle")
    if id == user["id"] and champs.get("is_active") is False:
        raise ErreurApi(403, "Vous ne pouvez pas désactiver votre propre compte")

    async with db.transaction() as tx:
        existant = ligne_ou_404(
            await tx.query_one("SELECT * FROM users WHERE id = %s FOR UPDATE", [id]), "Utilisateur introuvable"
        )
        if champs.get("email", existant["email"]) != existant["email"]:
            if await tx.query("SELECT id FROM users WHERE email = %s AND id != %s", [champs["email"], id]):
                raise ErreurApi(409, "Cet email est déjà utilisé")

        if champs:
            colonnes, valeurs = clause_set(champs)
            await tx.execute(f"UPDATE users SET {colonnes} WHERE id = %s", [*valeurs, id])

        sessions_a_couper = (
            champs.get("role", existant["role"]) != existant["role"]
            or (existant["is_active"] and champs.get("is_active") is False)
        )
        if sessions_a_couper:
            await revoquer_tokens(tx, id)

    if sessions_a_couper:
        await deconnecter_utilisateur(id)
    return await db.query_one(SELECT_PUBLIC, [id])


@router.patch("/{id}/password", response_model=MotDePasseChange, response_model_exclude_none=True,
              summary="Changer un mot de passe")
async def change_password(id: int, donnees: ChangementMotDePasse, user: dict = Depends(verifier_token)):
    """
    Un administrateur réinitialise n'importe quel compte ; un utilisateur change le sien en
    confirmant son mot de passe actuel. Les sessions existantes du compte sont révoquées ; si
    l'utilisateur change son propre mot de passe, un nouveau token lui est renvoyé.
    """
    if user["role"] != "admin" and id != user["id"]:
        raise ErreurApi(403, "Accès refusé")

    existant = ligne_ou_404(await db.query_one("SELECT * FROM users WHERE id = %s", [id]), "Utilisateur introuvable")

    if user["role"] != "admin":
        if not donnees.password_actuel:
            raise ErreurApi(400, "Mot de passe actuel requis")
        if not await verifier_mdp(donnees.password_actuel, existant["password_hash"]):
            raise ErreurApi(401, "Mot de passe actuel incorrect")

    hash_ = await hacher_mdp(donnees.password)
    async with db.transaction() as tx:
        await tx.execute("UPDATE users SET password_hash = %s WHERE id = %s", [hash_, id])
        await revoquer_tokens(tx, id)

    await deconnecter_utilisateur(id)
    reponse = {"message": "Mot de passe mis à jour avec succès"}
    if id == user["id"]:
        reponse["token"] = generer_token(await db.query_one("SELECT * FROM users WHERE id = %s", [id]))
    return reponse


@router.delete("/{id}", response_model=Message, summary="Désactiver un compte")
async def remove(id: int, user: dict = Depends(admin_only)):
    """Désactivation (les données du compte sont conservées) ; ses sessions sont coupées."""
    if id == user["id"]:
        raise ErreurApi(403, "Vous ne pouvez pas supprimer votre propre compte")

    existant = ligne_ou_404(await db.query_one("SELECT id, nom FROM users WHERE id = %s", [id]),
                            "Utilisateur introuvable")

    async with db.transaction() as tx:
        await tx.execute("UPDATE users SET is_active = 0 WHERE id = %s", [id])
        await revoquer_tokens(tx, id)

    await deconnecter_utilisateur(id)
    return {"message": f"Compte de {existant['nom']} désactivé"}
