# Routes paie chauffeurs — bulletins et masse salariale
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from .. import db
from ..auth import ROLES_GESTION, Gestionnaire, verifier_token
from ..erreurs import ErreurApi
from ..services.paie import ChauffeurIntrouvable, calculer_fiche_paie, generer_bulletin_pdf, resume_mensuel
from ..utils import corps

router = APIRouter()


async def _fiche(id: int, annee: int, mois: int) -> dict:
    try:
        return await calculer_fiche_paie(id, annee, mois)
    except ChauffeurIntrouvable as err:
        raise ErreurApi(404, str(err)) from None


@router.get("/{annee}/{mois}", dependencies=[Gestionnaire])
async def get_mensuelle(annee: int, mois: int):
    """Résumé mensuel de toute la masse salariale."""
    if not 1 <= mois <= 12:
        raise ErreurApi(400, "Année et mois invalides")

    fiches = await resume_mensuel(annee, mois)
    return {
        "fiches":          fiches,
        "masse_salariale": sum(f["net_a_payer"] for f in fiches),
        "nb_missions":     sum(f["nb_missions"] for f in fiches),
        "annee":           annee,
        "mois":            mois,
    }


@router.get("/chauffeur/{id}/{annee}/{mois}", dependencies=[Gestionnaire])
async def get_chauffeur_mensuel(id: int, annee: int, mois: int):
    """Fiche individuelle d'un chauffeur."""
    return await _fiche(id, annee, mois)


@router.get("/chauffeur/{id}/{annee}/{mois}/pdf")
async def get_bulletin_pdf(id: int, annee: int, mois: int, user: dict = Depends(verifier_token)):
    """Bulletin PDF d'un chauffeur : gestion, ou le chauffeur lui-même pour son propre bulletin."""
    if user["role"] not in ROLES_GESTION:
        proprietaire = await db.query_one("SELECT user_id FROM chauffeurs WHERE id = %s", [id])
        if not proprietaire or proprietaire["user_id"] != user["id"]:
            raise ErreurApi(403, "Accès refusé : ce bulletin ne vous appartient pas")
    fiche = await _fiche(id, annee, mois)
    nom_fichier = f"bulletin_{fiche['chauffeur']['nom']}_{mois}_{annee}.pdf"
    return Response(
        content=generer_bulletin_pdf(fiche),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )


@router.patch("/chauffeur/{id}/salaire", dependencies=[Gestionnaire])
async def update_salaire(id: int, request: Request):
    """Met à jour le salaire de base et/ou la prime mission d'un chauffeur."""
    b = await corps(request)
    champs = {k: b[k] for k in ("salaire_base", "prime_mission") if k in b}
    if not champs:
        raise ErreurApi(400, "Au moins salaire_base ou prime_mission requis")

    if not await db.query("SELECT id FROM chauffeurs WHERE id=%s", [id]):
        raise ErreurApi(404, "Chauffeur introuvable")

    sets = ",".join(f"{k}=%s" for k in champs)
    await db.execute(f"UPDATE chauffeurs SET {sets} WHERE id=%s", [*champs.values(), id])

    return await db.query_one(
        "SELECT id, nom, prenom, salaire_base, prime_mission FROM chauffeurs WHERE id=%s", [id]
    )
