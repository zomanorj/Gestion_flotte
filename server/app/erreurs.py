# Gestion des erreurs — toutes les réponses d'erreur ont le format { "message": ... }
# (plus "erreurs": [{champ, message}] pour les erreurs de validation), lu tel quel par le client React.
import traceback

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErreurApi(Exception):
    """Erreur métier renvoyée telle quelle au client."""

    def __init__(self, status: int, message: str, headers: dict | None = None):
        self.status = status
        self.message = message
        self.headers = headers


ORIGINES = ("body", "query", "path", "header")


def _champ(loc: tuple) -> str:
    parties = [str(p) for p in loc if p not in ORIGINES]
    return ".".join(parties) or "requête"


def _valeurs_attendues(ctx: dict) -> str:
    return str(ctx.get("expected", "")).replace(" or ", ", ")


def message_validation(erreur: dict) -> str:
    """Traduit une erreur de validation Pydantic en message français destiné à l'utilisateur."""
    champ, type_, ctx = _champ(erreur["loc"]), erreur["type"], erreur.get("ctx") or {}
    entree = erreur.get("input")

    if type_ == "missing" or (entree is None and type_.endswith("_type")):
        return f"Champ obligatoire manquant : {champ}"
    if type_ in ("string_too_short", "too_short"):
        return f"{champ} ne peut pas être vide" if ctx.get("min_length") == 1 else \
            f"{champ} : {ctx.get('min_length')} caractères minimum"
    if type_ in ("string_too_long", "too_long"):
        return f"{champ} : {ctx.get('max_length')} caractères maximum"
    if type_ in ("int_parsing", "int_type", "int_from_float"):
        return f"{champ} doit être un nombre entier"
    if type_ in ("float_parsing", "float_type", "decimal_parsing"):
        return f"{champ} doit être un nombre"
    if type_ == "greater_than":
        return f"{champ} doit être supérieur à {ctx.get('gt')}"
    if type_ == "greater_than_equal":
        return f"{champ} doit être supérieur ou égal à {ctx.get('ge')}"
    if type_ == "less_than_equal":
        return f"{champ} doit être inférieur ou égal à {ctx.get('le')}"
    if type_ in ("enum", "literal_error"):
        return f"Valeur invalide pour {champ}. Valeurs acceptées : {_valeurs_attendues(ctx)}"
    if type_.startswith(("date", "datetime")):
        return f"Date invalide pour {champ}"
    if type_ in ("bool_parsing", "bool_type"):
        return f"{champ} doit valoir vrai ou faux"
    if type_ == "value_error":
        # Messages écrits en français dans les validateurs des schémas
        return erreur["msg"].removeprefix("Value error, ")
    if type_ == "json_invalid":
        return "Corps de requête JSON invalide"
    if type_ in ("model_attributes_type", "dict_type"):
        return "Corps de requête invalide : objet JSON attendu"
    return f"Valeur invalide pour {champ}"


def installer_gestionnaires(app: FastAPI) -> None:
    @app.exception_handler(ErreurApi)
    async def _erreur_api(_req: Request, exc: ErreurApi):
        return JSONResponse(status_code=exc.status, content={"message": exc.message}, headers=exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_req: Request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            return JSONResponse(status_code=404, content={"message": "Route introuvable"})
        return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)})

    @app.exception_handler(RequestValidationError)
    async def _validation(_req: Request, exc: RequestValidationError):
        erreurs = [{"champ": _champ(e["loc"]), "message": message_validation(e)} for e in exc.errors()]
        return JSONResponse(status_code=400, content={"message": erreurs[0]["message"], "erreurs": erreurs})

    @app.exception_handler(Exception)
    async def _interne(_req: Request, exc: Exception):
        print("Erreur serveur :", exc)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Erreur interne du serveur"})
