# Routes documents administratifs des véhicules
from typing import Annotated

from fastapi import Depends, File, Query, UploadFile

from ..auth import Admin, Connecte, Gestionnaire
from ..schemas.commun import IdOpt, Message, Page, Vide
from ..schemas.enums import TypeDocument
from ..schemas.operations import Document, DocumentSaisie, FichierEnvoye
from ..services import documents as service
from ..utils import Pagination, Routeur

router = Routeur()


@router.get("/alertes", dependencies=[Connecte], response_model=list[Document],
            summary="Documents expirés ou expirant sous 30 jours")
async def alertes():
    return await service.a_renouveler()


@router.get("", dependencies=[Connecte], response_model=list[Document] | Page[Document], summary="Liste des documents")
async def lister(
    vehicule_id: Annotated[IdOpt, Query()] = None,
    type: Annotated[TypeDocument | None, Vide] = None,
    pg: Pagination = Depends(),
):
    return pg.formater(await service.lister(vehicule_id, type, pg.plage))


@router.post("", status_code=201, dependencies=[Gestionnaire], response_model=Document, summary="Ajouter un document")
async def creer(donnees: DocumentSaisie):
    """Le fichier se joint ensuite via POST /documents/{id}/fichier."""
    return await service.creer(donnees)


@router.put("/{id}", dependencies=[Gestionnaire], response_model=Document, summary="Modifier un document")
async def modifier(id: int, donnees: DocumentSaisie):
    """Le fichier joint ne change que via POST /documents/{id}/fichier."""
    return await service.modifier(id, donnees)


@router.post("/{id}/fichier", dependencies=[Gestionnaire], response_model=FichierEnvoye,
             summary="Joindre un fichier à un document")
async def joindre_fichier(id: int,
                          fichier: UploadFile | None = File(None, description="PDF, image ou Word, 10 Mo max")):
    """Remplace le fichier existant (l'ancien est supprimé)."""
    # Lecture bornée : un octet de plus que la limite suffit pour la faire respecter
    contenu = await fichier.read(service.TAILLE_MAX_OCTETS + 1) if fichier else b""
    return await service.joindre_fichier(id, fichier.filename if fichier else None, contenu)


@router.delete("/{id}", dependencies=[Admin], response_model=Message, summary="Supprimer un document")
async def supprimer(id: int):
    """Supprime aussi le fichier joint."""
    await service.supprimer(id)
    return {"message": "Document supprimé"}
