# Point d'entrée du serveur FastAPI — Système de gestion de flotte
#
# Lancement : uvicorn main:app --reload --port 5000
import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Logs visibles immédiatement même hors terminal (Railway, fichiers)
sys.stdout.reconfigure(line_buffering=True)
load_dotenv()

if not os.getenv("JWT_SECRET"):
    print("ERREUR : JWT_SECRET manquant dans .env")
    sys.exit(1)

import mimetypes

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app import db
from app.auth import Connecte
from app.erreurs import ErreurApi, installer_gestionnaires
from app.migrations import appliquer_migrations, initialiser_admin
from app.routers import (
    auth, carburant, chauffeurs, clients, dashboard, depenses, documents,
    maintenances, missions, notifications, paie, simulation, users, vehicules,
)
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

    # Migrations automatiques avant d'accepter les requêtes
    await appliquer_migrations()
    await initialiser_admin()
    await stockage.preparer()
    tache_alertes = asyncio.create_task(_alertes_periodiques())

    print("\nCamionApp — Serveur démarré (FastAPI)")
    print(f"   API disponible sur : http://localhost:{os.getenv('PORT', '5000')}/api")
    print(f"   Environnement      : {os.getenv('NODE_ENV', 'development')}\n")
    yield

    tache_alertes.cancel()
    await db.fermer()


api = FastAPI(title="FlotteApp API", lifespan=lifespan, redirect_slashes=False)
installer_gestionnaires(api)

# CORS — autorise uniquement le client React
api.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_URL", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montage des routes de l'API
for module, prefixe in [
    (auth, "auth"), (users, "users"), (vehicules, "vehicules"), (chauffeurs, "chauffeurs"),
    (missions, "missions"), (dashboard, "dashboard"), (simulation, "simulation"),
    (documents, "documents"), (carburant, "carburant"), (depenses, "depenses"),
    (maintenances, "maintenances"), (clients, "clients"), (paie, "paie"),
    (notifications, "notifications"),
]:
    api.include_router(module.router, prefix=f"/api/{prefixe}")


@api.get("/api/uploads/{chemin:path}", dependencies=[Connecte])
async def fichier_uploade(chemin: str):
    """Sert les fichiers uploadés (documents…) — réservé aux utilisateurs connectés."""
    try:
        contenu = await stockage.lire(chemin)
    except FichierIntrouvable:
        raise ErreurApi(404, "Fichier introuvable")
    return Response(
        content=contenu,
        media_type=mimetypes.guess_type(chemin)[0] or "application/octet-stream",
        # Toujours en téléchargement : un fichier uploadé ne doit jamais s'exécuter dans la page
        headers={
            "Content-Disposition": f'attachment; filename="{Path(chemin).name}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@api.get("/api/health")
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

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "5000")), reload=True)
