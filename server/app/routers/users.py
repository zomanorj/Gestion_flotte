# Routes gestion des utilisateurs — admin uniquement (sauf changement de mot de passe)
from fastapi import APIRouter, Depends, Request

from .. import db
from ..auth import hacher_mdp, verifier_mdp, verifier_role, verifier_token
from ..erreurs import ErreurApi
from ..utils import corps

router = APIRouter()
admin_only = verifier_role("admin")

ROLES_VALIDES = ["admin", "gestionnaire", "chauffeur"]


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
    if len(password) < 6:
        raise ErreurApi(400, "Le mot de passe doit faire au moins 6 caractères")

    email = email.strip().lower()
    if await db.query("SELECT id FROM users WHERE email = %s", [email]):
        raise ErreurApi(409, "Un compte avec cet email existe déjà")

    new_id = await db.execute(
        "INSERT INTO users (nom, email, password_hash, role) VALUES (%s, %s, %s, %s)",
        [nom.strip(), email, hacher_mdp(password), role],
    )
    return await db.query_one(
        "SELECT id, nom, email, role, is_active, created_at FROM users WHERE id = %s", [new_id]
    )


@router.put("/{id}")
async def update(id: int, request: Request, user: dict = Depends(admin_only)):
    """Met à jour nom, email, rôle et statut actif. Un admin ne peut pas se rétrograder lui-même."""
    b = await corps(request)
    nom, email, role, is_active = b.get("nom"), b.get("email"), b.get("role"), b.get("is_active")

    existant = await db.query_one("SELECT * FROM users WHERE id = %s", [id])
    if not existant:
        raise ErreurApi(404, "Utilisateur introuvable")

    if id == user["id"] and role and role != "admin":
        raise ErreurApi(403, "Vous ne pouvez pas modifier votre propre rôle")

    if email and email != existant["email"]:
        if await db.query("SELECT id FROM users WHERE email = %s AND id != %s", [email, id]):
            raise ErreurApi(409, "Cet email est déjà utilisé")

    await db.execute(
        "UPDATE users SET nom=%s, email=%s, role=%s, is_active=%s WHERE id=%s",
        [
            nom.strip() if nom is not None else existant["nom"],
            email.strip().lower() if email is not None else existant["email"],
            role if role is not None else existant["role"],
            (1 if is_active else 0) if is_active is not None else existant["is_active"],
            id,
        ],
    )
    return await db.query_one(
        "SELECT id, nom, email, role, is_active, created_at FROM users WHERE id=%s", [id]
    )


@router.patch("/{id}/password")
async def change_password(id: int, request: Request, user: dict = Depends(verifier_token)):
    """Réinitialise le mot de passe d'un utilisateur (admin) ou change le sien."""
    b = await corps(request)
    password, password_actuel = b.get("password"), b.get("password_actuel")

    if not password or len(password) < 6:
        raise ErreurApi(400, "Le nouveau mot de passe doit faire au moins 6 caractères")

    existant = await db.query_one("SELECT * FROM users WHERE id = %s", [id])
    if not existant:
        raise ErreurApi(404, "Utilisateur introuvable")

    # Un non-admin ne peut changer que son propre mot de passe
    if user["role"] != "admin" and id != user["id"]:
        raise ErreurApi(403, "Accès refusé")

    # Si l'utilisateur change son propre mot de passe, vérifier l'ancien
    if id == user["id"] and user["role"] != "admin":
        if not password_actuel:
            raise ErreurApi(400, "Mot de passe actuel requis")
        if not verifier_mdp(password_actuel, existant["password_hash"]):
            raise ErreurApi(401, "Mot de passe actuel incorrect")

    await db.execute("UPDATE users SET password_hash=%s WHERE id=%s", [hacher_mdp(password), id])
    return {"message": "Mot de passe mis à jour avec succès"}


@router.delete("/{id}")
async def remove(id: int, user: dict = Depends(admin_only)):
    """Désactive un compte (soft delete via is_active=0). Un admin ne peut pas se désactiver lui-même."""
    if id == user["id"]:
        raise ErreurApi(403, "Vous ne pouvez pas supprimer votre propre compte")

    existant = await db.query_one("SELECT id, nom FROM users WHERE id=%s", [id])
    if not existant:
        raise ErreurApi(404, "Utilisateur introuvable")

    await db.execute("UPDATE users SET is_active=0 WHERE id=%s", [id])
    return {"message": f"Compte de {existant['nom']} désactivé"}
