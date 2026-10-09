# Routes paie chauffeurs — bulletins et masse salariale
from typing import Annotated

from fastapi import Depends, Path
from fastapi.responses import Response

from .. import db
from ..auth import ROLES_GESTION, Gestionnaire, verifier_token
from ..erreurs import ErreurApi
from ..schemas.pilotage import FichePaie, PaieMensuelle, Salaire, SalaireSaisie
from ..services.paie import ChauffeurIntrouvable, calculer_fiche_paie, generer_bulletin_pdf, resume_mensuel
from ..utils import Routeur, clause_set, ligne_ou_404

router = Routeur()

Annee = Annotated[int, Path(ge=2000, le=2100)]
Mois = Annotated[int, Path(ge=1, le=12, description="1 à 12")]


async def _fiche(id: int, annee: int, mois: int) -> dict:
    try:
        return await calculer_fiche_paie(id, annee, mois)
    except ChauffeurIntrouvable as err:
        raise ErreurApi(404, str(err)) from None


@router.get("/{annee}/{mois}", dependencies=[Gestionnaire], response_model=PaieMensuelle,
            summary="Masse salariale du mois")
async def get_mensuelle(annee: Annee, mois: Mois):
    fiches = await resume_mensuel(annee, mois)
    return {
        "fiches":          fiches,
        "masse_salariale": sum(f["net_a_payer"] for f in fiches),
        "nb_missions":     sum(f["nb_missions"] for f in fiches),
        "annee":           annee,
        "mois":            mois,
    }


@router.get("/chauffeur/{id}/{annee}/{mois}", dependencies=[Gestionnaire], response_model=FichePaie,
            summary="Fiche de paie d'un chauffeur")
async def get_chauffeur_mensuel(id: int, annee: Annee, mois: Mois):
    return await _fiche(id, annee, mois)


@router.get("/chauffeur/{id}/{annee}/{mois}/pdf", response_class=Response, summary="Bulletin de paie PDF",
            responses={200: {"content": {"application/pdf": {}}, "description": "Fichier PDF"}})
async def get_bulletin_pdf(id: int, annee: Annee, mois: Mois, user: dict = Depends(verifier_token)):
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


@router.patch("/chauffeur/{id}/salaire", dependencies=[Gestionnaire], response_model=Salaire,
              summary="Modifier le salaire d'un chauffeur")
async def update_salaire(id: int, donnees: SalaireSaisie):
    """Salaire de base et/ou prime par mission."""
    ligne_ou_404(await db.query_one("SELECT id FROM chauffeurs WHERE id = %s", [id]), "Chauffeur introuvable")
    colonnes, valeurs = clause_set(donnees.champs_fournis())
    await db.execute(f"UPDATE chauffeurs SET {colonnes} WHERE id = %s", [*valeurs, id])
    return await db.query_one("SELECT id, nom, prenom, salaire_base, prime_mission FROM chauffeurs WHERE id = %s", [id])
