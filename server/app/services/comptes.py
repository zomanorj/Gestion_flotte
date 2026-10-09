# Règles métier : connexion, comptes utilisateurs et mots de passe
#
# Toute modification qui change les droits d'un compte (rôle, désactivation, mot de passe)
# révoque ses tokens et coupe ses connexions temps réel.
from .. import db
from ..auth import generer_token, hacher_mdp, verifier_mdp
from ..exceptions import AccesRefuse, Conflit, DonneesInvalides, NonAuthentifie, trouve
from ..limiteur import limiteur_connexion
from ..repositories import comptes as depot
from ..schemas.comptes import ChangementMotDePasse, UtilisateurCreation, UtilisateurMiseAJour
from ..socket import deconnecter_utilisateur

INTROUVABLE = "Utilisateur introuvable"
CHAMPS_PUBLICS = ("id", "nom", "email", "role", "is_active", "created_at")


async def se_connecter(email: str, password: str, ip: str) -> dict:
    """Vérifie les identifiants et ouvre une session : {token, user}."""
    email = email.lower()
    limiteur_connexion.verifier(ip, email)

    user = await depot.utilisateur_par_email(email)
    if not await verifier_mdp(password, user["password_hash"] if user else None):
        limiteur_connexion.enregistrer_echec(ip, email)
        raise NonAuthentifie("Identifiants incorrects")

    # Vérifié après le mot de passe : l'état du compte n'est révélé qu'à son propriétaire
    if not user["is_active"]:
        raise AccesRefuse("Ce compte est désactivé. Contactez un administrateur.")

    limiteur_connexion.reinitialiser(email)
    return {"token": generer_token(user), "user": {k: user[k] for k in CHAMPS_PUBLICS}}


async def profil(user_id: int) -> dict:
    ligne = trouve(await depot.utilisateur_public(user_id), INTROUVABLE)
    return {k: ligne[k] for k in ("id", "nom", "email", "role", "created_at")}


async def lister() -> list[dict]:
    return await depot.lister_utilisateurs()


async def creer(donnees: UtilisateurCreation) -> dict:
    if await depot.email_pris(donnees.email):
        raise Conflit("Un compte avec cet email existe déjà")
    nouvel_id = await depot.creer_utilisateur(donnees.nom, donnees.email, await hacher_mdp(donnees.password),
                                              donnees.role)
    return await depot.utilisateur_public(nouvel_id)


async def modifier(id: int, donnees: UtilisateurMiseAJour, auteur: dict) -> dict:
    """
    Seuls les champs envoyés sont modifiés. Un admin ne peut ni se rétrograder ni se
    désactiver. Un changement de rôle ou une désactivation coupe les sessions du compte.
    """
    champs = donnees.champs_fournis()
    if id == auteur["id"] and champs.get("role", "admin") != "admin":
        raise AccesRefuse("Vous ne pouvez pas modifier votre propre rôle")
    if id == auteur["id"] and champs.get("is_active") is False:
        raise AccesRefuse("Vous ne pouvez pas désactiver votre propre compte")

    async with db.transaction() as tx:
        existant = trouve(await depot.utilisateur_complet(id, tx, verrou=True), INTROUVABLE)
        if champs.get("email", existant["email"]) != existant["email"] and \
                await depot.email_pris(champs["email"], sauf_id=id, cx=tx):
            raise Conflit("Cet email est déjà utilisé")

        await depot.modifier_utilisateur(id, champs, tx)

        couper_sessions = (champs.get("role", existant["role"]) != existant["role"]
                           or (existant["is_active"] and champs.get("is_active") is False))
        if couper_sessions:
            await depot.revoquer_tokens(id, tx)

    if couper_sessions:
        await deconnecter_utilisateur(id)
    return await depot.utilisateur_public(id)


async def changer_mot_de_passe(id: int, donnees: ChangementMotDePasse, auteur: dict) -> dict:
    """
    Un administrateur réinitialise n'importe quel compte ; un utilisateur change le sien en
    confirmant son mot de passe actuel. Les sessions existantes sont révoquées ; si l'utilisateur
    change son propre mot de passe, un nouveau token lui est renvoyé.
    """
    if auteur["role"] != "admin" and id != auteur["id"]:
        raise AccesRefuse("Accès refusé")

    existant = trouve(await depot.utilisateur_complet(id), INTROUVABLE)
    if auteur["role"] != "admin":
        if not donnees.password_actuel:
            raise DonneesInvalides("Mot de passe actuel requis")
        if not await verifier_mdp(donnees.password_actuel, existant["password_hash"]):
            raise NonAuthentifie("Mot de passe actuel incorrect")

    hash_ = await hacher_mdp(donnees.password)
    async with db.transaction() as tx:
        await depot.modifier_utilisateur(id, {"password_hash": hash_}, tx)
        await depot.revoquer_tokens(id, tx)
    await deconnecter_utilisateur(id)

    reponse = {"message": "Mot de passe mis à jour avec succès"}
    if id == auteur["id"]:
        reponse["token"] = generer_token(await depot.utilisateur_complet(id))
    return reponse


async def desactiver(id: int, auteur: dict) -> str:
    """Désactivation (les données du compte sont conservées) ; retourne le nom du compte."""
    if id == auteur["id"]:
        raise AccesRefuse("Vous ne pouvez pas supprimer votre propre compte")
    existant = trouve(await depot.utilisateur_public(id), INTROUVABLE)

    async with db.transaction() as tx:
        await depot.modifier_utilisateur(id, {"is_active": 0}, tx)
        await depot.revoquer_tokens(id, tx)
    await deconnecter_utilisateur(id)
    return existant["nom"]
