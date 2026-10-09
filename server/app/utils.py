# Utilitaires des routers : pagination, routeur, petites aides SQL
from fastapi import APIRouter, Query

from .erreurs import ErreurApi


class Pagination:
    """
    Dépendance de pagination, optionnelle : active seulement avec ?paginate=true.
    Sans ce paramètre, les listes renvoient un tableau simple (compatibilité).
    """

    LIMITE_MAX = 200

    def __init__(
        self,
        paginate: bool = Query(False, description="true pour une réponse paginée {data, total, page, pages, limit}"),
        page: int = Query(1, ge=1, description="Numéro de page (à partir de 1)"),
        limit: int = Query(20, ge=1, description=f"Éléments par page (plafonné à {LIMITE_MAX})"),
    ):
        self.actif = paginate
        self.page = page
        self.limit = min(limit, self.LIMITE_MAX)
        self.offset = (page - 1) * self.limit

    def reponse(self, rows: list, total) -> dict:
        total = int(total)
        return {
            "data":  rows,
            "total": total,
            "page":  self.page,
            "pages": -(-total // self.limit),
            "limit": self.limit,
        }


class Routeur(APIRouter):
    """
    APIRouter dont les réponses n'incluent que les champs réellement fournis par l'endpoint
    (response_model_exclude_unset) : un même modèle sert aux variantes d'une ressource
    (liste avec jointures, détail, résumé) sans ajouter de champs null qui n'existent pas.
    """

    def add_api_route(self, path, endpoint, **kwargs):
        # Forcé : les décorateurs @get/@post transmettent toujours la valeur par défaut (False)
        kwargs["response_model_exclude_unset"] = True
        return super().add_api_route(path, endpoint, **kwargs)


def ligne_ou_404(ligne: dict | None, message: str) -> dict:
    if not ligne:
        raise ErreurApi(404, message)
    return ligne


def clause_set(champs: dict) -> tuple[str, list]:
    """
    "col1 = %s, col2 = %s" et ses valeurs, pour un UPDATE partiel.
    Les clés doivent venir des champs d'un schéma Pydantic (jamais directement de la requête) :
    ce sont des noms de colonnes insérés dans le SQL.
    """
    return ", ".join(f"{colonne} = %s" for colonne in champs), list(champs.values())
