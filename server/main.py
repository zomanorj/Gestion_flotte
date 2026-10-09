# Point d'entrée du serveur FastAPI — Système de gestion de flotte
#
# Lancement : uvicorn main:app --reload --port 5000
import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from pydantic import ValidationError

from app.config import config, problemes_de_configuration

# Logs visibles immédiatement même hors terminal (Railway, fichiers)
sys.stdout.reconfigure(line_buffering=True)

# Configuration validée avant tout le reste (plusieurs modules la lisent dès leur import)
try:
    config()
except ValidationError as erreur:
    print("ERREUR : configuration invalide (variables d'environnement ou server/.env) :")
    for probleme in problemes_de_configuration(erreur):
        print(f"  - {probleme}")
    sys.exit(1)

import mimetypes

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app import db
from app.auth import Connecte
from app.demarrage import charger_donnees_demo, initialiser_admin
from app.erreurs import installer_gestionnaires
from app.exceptions import Introuvable
from app.migrations import mettre_a_jour_schema
from app.routers import (
    auth,
    carburant,
    chauffeurs,
    clients,
    dashboard,
    depenses,
    documents,
    maintenances,
    missions,
    notifications,
    paie,
    parametres,
    users,
    vehicules,
)
from app.schemas.commun import Erreur, Sante
from app.services.notifications import verifier_alertes_periodiques
from app.socket import sio
from app.stockage import FichierIntrouvable, stockage


async def _alertes_periodiques():
    """Vérification des alertes (documents + maintenances) 5 s après le démarrage puis toutes les 24 h."""
    await asyncio.sleep(5)
    while True:
        await verifier_alertes_periodiques()
        await asyncio.sleep(24 * 3600)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await db.connecter()
    except Exception as err:
        print("ERREUR : impossible de se connecter à MySQL :", err)
        print("   Vérifiez vos paramètres dans server/.env")
        sys.exit(1)

    # Schéma à jour avant d'accepter les requêtes (Alembic, synchrone : exécuté dans un thread)
    revision = await asyncio.to_thread(mettre_a_jour_schema)
    print(f"[Migration] Schéma à jour (révision {revision})")
    await charger_donnees_demo()
    await initialiser_admin()
    await stockage.preparer()
    tache_alertes = asyncio.create_task(_alertes_periodiques())

    print("\nCamionApp — Serveur démarré (FastAPI)")
    print(f"   API disponible sur : http://localhost:{config().port}/api")
    print(f"   Environnement      : {config().environnement}\n")
    yield

    tache_alertes.cancel()
    await db.fermer()


DESCRIPTION = """
API de gestion de flotte de camions (Madagascar).

**Authentification** : obtenir un token avec `POST /api/auth/login`, puis l'envoyer dans l'en-tête
`Authorization: Bearer <token>` (bouton *Authorize* ci-dessus).

**Rôles** : `admin` (tout), `gestionnaire` (création et modification, sans suppression),
`chauffeur` (lecture ; uniquement ses propres données de paie).

**Erreurs** : toujours `{"message": "..."}` ; les erreurs de validation (400) ajoutent
`erreurs: [{champ, message}]`.

**Listes** : un tableau simple, ou `{data, total, page, pages, limit}` avec `?paginate=true`.

**Temps réel** : Socket.io sur `/socket.io`, connexion avec `auth: { token }`.
"""

MODULES = [
    (auth, "auth", "Authentification", "Connexion et profil"),
    (users, "users", "Utilisateurs", "Comptes et mots de passe (administration)"),
    (vehicules, "vehicules", "Véhicules", "Camions et alertes d'entretien"),
    (chauffeurs, "chauffeurs", "Chauffeurs", "Chauffeurs et historique"),
    (missions, "missions", "Missions", "Planification, cycle de vie, planning et bon de livraison"),
    (dashboard, "dashboard", "Tableau de bord", "Indicateurs"),
    (documents, "documents", "Documents", "Pièces administratives des véhicules et fichiers joints"),
    (carburant, "carburant", "Carburant", "Pleins et consommation"),
    (depenses, "depenses", "Dépenses", "Dépenses opérationnelles"),
    (maintenances, "maintenances", "Maintenances", "Maintenances planifiées"),
    (clients, "clients", "Clients", "Clients et leurs missions"),
    (paie, "paie", "Paie", "Calcul des salaires et bulletins"),
    (notifications, "notifications", "Notifications", "Alertes de l'utilisateur connecté"),
    (parametres, "parametres", "Paramètres", "Paramètres métier modifiables par l'administrateur"),
]

# Format d'erreur documenté sur toutes les routes
REPONSES_ERREUR = {
    400: {"model": Erreur, "description": "Données invalides"},
    401: {"model": Erreur, "description": "Non authentifié ou session expirée"},
    403: {"model": Erreur, "description": "Droits insuffisants"},
    404: {"model": Erreur, "description": "Ressource introuvable"},
    409: {"model": Erreur, "description": "Conflit avec l'état actuel (doublon, indisponibilité…)"},
}

api = FastAPI(
    title="FlotteApp API",
    version="2.0.0",
    description=DESCRIPTION,
    openapi_tags=[{"name": tag, "description": desc} for _, _, tag, desc in MODULES],
    lifespan=lifespan,
    redirect_slashes=False,
)
installer_gestionnaires(api)

# CORS — autorise uniquement le client React
api.add_middleware(
    CORSMiddleware,
    allow_origins=config().origines_client,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montage des routes de l'API
for module, prefixe, tag, _ in MODULES:
    api.include_router(module.router, prefix=f"/api/{prefixe}", tags=[tag], responses=REPONSES_ERREUR)


@api.get("/api/uploads/{chemin:path}", dependencies=[Connecte], tags=["Documents"], response_class=Response,
         summary="Télécharger un fichier joint",
         responses={**REPONSES_ERREUR,
                    200: {"content": {"application/octet-stream": {}}, "description": "Contenu du fichier"}})
async def fichier_uploade(chemin: str):
    """Sert les fichiers uploadés (documents…) — réservé aux utilisateurs connectés."""
    try:
        contenu = await stockage.lire(chemin)
    except FichierIntrouvable:
        raise Introuvable("Fichier introuvable") from None
    return Response(
        content=contenu,
        media_type=mimetypes.guess_type(chemin)[0] or "application/octet-stream",
        # Toujours en téléchargement : un fichier uploadé ne doit jamais s'exécuter dans la page
        headers={
            "Content-Disposition": f'attachment; filename="{Path(chemin).name}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@api.get("/api/health", tags=["Système"], response_model=Sante, summary="État de l'API et de la base",
         responses={503: {"model": Sante, "description": "Base de données injoignable"}})
async def sante():
    """Route de santé : vérifie que l'API répond et que la base est joignable."""
    try:
        await db.query_one("SELECT 1 AS ok")
    except Exception:
        return JSONResponse(status_code=503, content={"status": "KO", "message": "Base de données injoignable"})
    return {"status": "OK", "message": "Serveur flotte opérationnel"}


# Application ASGI finale : Socket.io sur /socket.io, FastAPI pour le reste
app = socketio.ASGIApp(sio, other_asgi_app=api)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=config().port, reload=True)
