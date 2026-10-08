# Gestion des erreurs — conserve le format JSON { message } attendu par le client React
import traceback

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErreurApi(Exception):
    """Erreur métier renvoyée telle quelle au client : { cle: message }."""

    def __init__(self, status: int, message: str, cle: str = "message", headers: dict | None = None):
        self.status = status
        self.message = message
        self.cle = cle
        self.headers = headers


def installer_gestionnaires(app: FastAPI) -> None:
    @app.exception_handler(ErreurApi)
    async def _erreur_api(_req: Request, exc: ErreurApi):
        return JSONResponse(status_code=exc.status, content={exc.cle: exc.message}, headers=exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_req: Request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            return JSONResponse(status_code=404, content={"message": "Route introuvable"})
        return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)})

    @app.exception_handler(RequestValidationError)
    async def _validation(_req: Request, _exc: RequestValidationError):
        return JSONResponse(status_code=400, content={"message": "Paramètres invalides"})

    @app.exception_handler(Exception)
    async def _interne(_req: Request, exc: Exception):
        print("Erreur serveur :", exc)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Erreur interne du serveur"})
