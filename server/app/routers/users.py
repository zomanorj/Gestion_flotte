# Routes gestion des utilisateurs — admin uniquement (sauf changement de mot de passe)
from fastapi import APIRouter, Depends, Request

from .. import db
from ..auth import generer_token, hacher_mdp, revoquer_tokens, verifier_mdp, verifier_role, verifier_token
from ..erreurs import ErreurApi
from ..socket import deconnecter_utilisateur
from ..utils import corps

router = APIRouter()
admin_only = verifier_role("admin")

ROLES_VALIDES = ["admin", "gestionnaire", "chauffeur"]
LONGUEUR_MIN_MDP = 8

SELECT_PUBLIC = "SELECT id, nom, email, role, is_active, created_at FROM users WHERE id = %s"


def valider_mdp(password) -> None:
    if not isinstance(password, str) or len(password) < LONGUEUR_MIN_MDP:
        raise ErreurApi(400, f"Le mot de passe doit faire au moins {LONGUEUR_MIN_MDP} caractères")


@router.get("")
async def get_all(_u: dict = Depends(admin_only)):
    """Liste tous les comptes utilisateurs (sans hash de mot de passe)."""
    return await db.query("""
        SELECT u.id, u.nom, u.email, u.role, u.is_active, u.created_at,
               c.id AS chauffeur_id, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM users u
        LEFT JOIN chauffeurs c ON c.user_id = u.id
        ORDER BY u.role ASC, u.nom ASC
    """)


@router.post("", status_code=201)
async def create(request: Request, _u: dict = Depends(admin_only)):
    """Crée un nouveau compte utilisateur. Champs requis : nom, email, password, role."""
    b = await corps(request)
    nom, email, password, role = b.get("nom"), b.get("email"), b.get("password"), b.get("role")

    if not nom or not email or not password or not role:
        raise ErreurApi(400, "Champs obligatoires : nom, email, password, role")
    if role not in ROLES_VALIDES:
        raise ErreurApi(400, f"Rôle invalide. Valeurs acceptées : {', '.join(ROLES_VALIDES)}")
    valider_mdp(password)

    email = email.strip().lower()
    if await db.query("SELECT id FROM users WHERE email = %s", [email]):
        raise ErreurApi(409, "Un compte avec cet email existe déjà")

    new_id = await db.execute(
        "INSERT INTO users (nom, email, password_hash, role) VALUES (%s, %s, %s, %s)",
        [nom.strip(), email, await hacher_mdp(password), role],
    )
    return await db.query_one(SELECT_PUBLIC, [new_id])


@router.put("/{id}")
async def update(id: int, request: Request, user: dict = Depends(admin_only)):
    """
    Met à jour nom, email, rôle et statut actif. Un admin ne peut ni se rétrograder ni se
    désactiver. Un changement de rôle ou une désactivation coupe les sessions du compte.
    """
    b = await corps(request)
    nom, email, role, is_active = b.get("nom"), b.get("email"), b.get("role"), b.get("is_active")

    if role is not None and role not in ROLES_VALIDES:
        raise ErreurApi(400, f"Rôle invalide. Valeurs acceptées : {', '.join(ROLES_VALIDES)}")
    if id == user["id"] and role is not None and role != "admin":
        raise ErreurApi(403, "Vous ne pouvez pas modifier votre propre rôle")
    if id == user["id"] and is_active is not None and not is_active:
        raise ErreurApi(403, "Vous ne pouvez pas désactiver votre propre compte")

    async with db.transaction() as tx:
        existant = await tx.query_one("SELECT * FROM users WHERE id = %s FOR UPDATE", [id])
        if not existant:
            raise ErreurApi(404, "Utilisateur introuvable")

        nouvel_email = email.strip().lower() if email is not None else existant["email"]
        if nouvel_email != existant["email"]:
            if await tx.query("SELECT id FROM users WHERE email = %s AND id != %s", [nouvel_email, id]):
                raise ErreurApi(409, "Cet email est déjà utilisé")

        nouveau_role  = role if role is not None else existant["role"]
        nouvel_actif  = (1 if is_active else 0) if is_active is not None else existant["is_active"]

        await tx.execute(
            "UPDATE users SET nom=%s, email=%s, role=%s, is_active=%s WHERE id=%s",
            [nom.strip() if nom is not None else existant["nom"], nouvel_email, nouveau_role, nouvel_actif, id],
        )

        sessions_a_couper = nouveau_role != existant["role"] or (existant["is_active"] and not nouvel_actif)
        if sessions_a_couper:
            await revoquer_tokens(tx, id)

    if sessions_a_couper:
        await deconnecter_utilisateur(id)
    return await db.query_one(SELECT_PUBLIC, [id])


@router.patch("/{id}/password")
async def change_password(id: int, request: Request, user: dict = Depends(verifier_token)):
    """
    Réinitialise le mot de passe d'un utilisateur (admin) ou change le sien.
    Toutes les sessions existantes du compte sont révoquées ; si l'utilisateur change son
    propre mot de passe, un nouveau token lui est renvoyé.
    """
    b = await corps(request)
    password, password_actuel = b.get("password"), b.get("password_actuel")
    valider_mdp(password)

    # Un non-admin ne peut changer que son propre mot de passe
    if user["role"] != "admin" and id != user["id"]:
        raise ErreurApi(403, "Accès refusé")

    existant = await db.query_one("SELECT * FROM users WHERE id = %s", [id])
    if not existant:
        raise ErreurApi(404, "Utilisateur introuvable")

    # Un non-admin doit confirmer son mot de passe actuel
    if user["role"] != "admin":
        if not password_actuel:
            raise ErreurApi(400, "Mot de passe actuel requis")
        if not await verifier_mdp(password_actuel, existant["password_hash"]):
            raise ErreurApi(401, "Mot de passe actuel incorrect")

    hash_ = await hacher_mdp(password)
    async with db.transaction() as tx:
        await tx.execute("UPDATE users SET password_hash=%s WHERE id=%s", [hash_, id])
        await revoquer_tokens(tx, id)

    await deconnecter_utilisateur(id)
    reponse = {"message": "Mot de passe mis à jour avec succès"}
    if id == user["id"]:
        reponse["token"] = generer_token(await db.query_one("SELECT * FROM users WHERE id = %s", [id]))
    return reponse


@router.delete("/{id}")
async def remove(id: int, user: dict = Depends(admin_only)):
    """Désactive un compte (soft delete via is_active=0) et coupe ses sessions."""
    if id == user["id"]:
        raise ErreurApi(403, "Vous ne pouvez pas supprimer votre propre compte")

    existant = await db.query_one("SELECT id, nom FROM users WHERE id=%s", [id])
    if not existant:
        raise ErreurApi(404, "Utilisateur introuvable")

    async with db.transaction() as tx:
        await tx.execute("UPDATE users SET is_active=0 WHERE id=%s", [id])
        await revoquer_tokens(tx, id)

    await deconnecter_utilisateur(id)
    return {"message": f"Compte de {existant['nom']} désactivé"}
