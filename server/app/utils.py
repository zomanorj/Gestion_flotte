# Utilitaires des routers : pagination et routeur
from fastapi import APIRouter, Query
from fastapi.responses import Response

from .repositories.base import Plage, Resultat


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

    @property
    def plage(self) -> Plage | None:
        """Fenêtre à demander au service (None : liste complète)."""
        return Plage(self.limit, self.offset) if self.actif else None

    def formater(self, resultat: Resultat) -> list[dict] | dict:
        """Tableau simple, ou {data, total, page, pages, limit} si la pagination est active."""
        return self.reponse(resultat.lignes, resultat.total) if self.actif else resultat.lignes

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


REPONSE_PDF = {200: {"content": {"application/pdf": {}}, "description": "Fichier PDF"}}


def reponse_pdf(contenu: bytes, nom_fichier: str) -> Response:
    return Response(content=contenu, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'})
