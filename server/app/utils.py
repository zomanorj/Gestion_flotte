# Utilitaires partagés : lecture du corps JSON, pagination, conversions
from fastapi import Request

from .erreurs import ErreurApi


async def corps(request: Request) -> dict:
    """Corps JSON de la requête sous forme de dict (vide si absent ou invalide)."""
    try:
        data = await request.json()
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def ou_none(v):
    """Équivalent de `v || null` en JS : None pour les valeurs fausses (0, '', None…)."""
    return v or None


def nombre(v) -> float | None:
    """parseFloat tolérant : None si la valeur n'est pas un nombre."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def entier(v, defaut: int) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return defaut


class Pagination:
    """
    Pagination optionnelle : active seulement si ?paginate=true.
    Sans ce flag, les endpoints renvoient un tableau simple (compatibilité).
    """

    def __init__(self, request: Request):
        q = request.query_params
        self.actif  = q.get("paginate") == "true"
        self.page   = max(1, entier(q.get("page"), 1) or 1)
        self.limit  = min(200, max(1, entier(q.get("limit"), 20) or 20))
        self.offset = (self.page - 1) * self.limit

    def reponse(self, rows: list, total) -> dict:
        total = int(total)
        return {
            "data":  rows,
            "total": total,
            "page":  self.page,
            "pages": -(-total // self.limit),
            "limit": self.limit,
        }


def introuvable(message: str) -> ErreurApi:
    return ErreurApi(404, message)
