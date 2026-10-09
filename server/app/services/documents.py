# Règles métier : documents administratifs des véhicules et fichiers joints
import re
import time
from pathlib import PurePath

from ..exceptions import DonneesInvalides, TropVolumineux, trouve
from ..repositories import operations as depot
from ..repositories.base import Plage, Resultat
from ..schemas.operations import DocumentSaisie
from ..stockage import PREFIXE_URL, stockage, supprimer_sans_erreur
from .vehicules import verifier_existe as verifier_vehicule

INTROUVABLE = "Document introuvable"
JOURS_AVANT_ALERTE = 30
TAILLE_MAX_OCTETS = 10 * 1024 * 1024  # 10 Mo
TYPES_FICHIER = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def statut_depuis_jours(jours: int) -> str:
    if jours < 0:
        return "expire"
    if jours <= JOURS_AVANT_ALERTE:
        return "expire_bientot"
    return "valide"


def enrichir(document: dict) -> dict:
    """Ajoute le statut calculé à partir de jours_restants (DATEDIFF côté SQL)."""
    jours = int(document["jours_restants"])
    return {**document, "jours_restants": jours, "statut": statut_depuis_jours(jours)}


def cle_de_stockage(document_id: int, nom_fichier: str, horodatage_ms: int) -> str:
    """Clé unique et sûre : seuls lettres, chiffres et _ sont conservés du nom d'origine."""
    chemin = PurePath(nom_fichier)
    base = re.sub(r"[^a-zA-Z0-9]", "_", chemin.stem)[:80]
    return f"documents/doc_{document_id}_{horodatage_ms}_{base}{chemin.suffix.lower()}"


async def lister(vehicule_id: int | None, type: str | None, plage: Plage | None) -> Resultat:
    resultat = await depot.lister_documents(vehicule_id, type, plage)
    resultat.lignes = [enrichir(d) for d in resultat.lignes]
    return resultat


async def a_renouveler() -> list[dict]:
    return [enrichir(d) for d in await depot.documents_a_renouveler()]


async def creer(donnees: DocumentSaisie) -> dict:
    """Le fichier se joint ensuite avec joindre_fichier()."""
    await verifier_vehicule(donnees.vehicule_id)
    return enrichir(await depot.obtenir_document(await depot.creer_document(donnees.model_dump())))


async def modifier(id: int, donnees: DocumentSaisie) -> dict:
    """Le fichier joint ne change qu'avec joindre_fichier()."""
    trouve(await depot.obtenir_document(id), INTROUVABLE)
    await verifier_vehicule(donnees.vehicule_id)
    await depot.modifier_document(id, donnees.model_dump())
    return enrichir(await depot.obtenir_document(id))


async def joindre_fichier(id: int, nom_fichier: str | None, contenu: bytes) -> dict:
    """Enregistre le fichier, le rattache au document et supprime l'ancien fichier éventuel."""
    if not nom_fichier:
        raise DonneesInvalides("Aucun fichier fourni")
    extension = PurePath(nom_fichier).suffix.lower()
    if extension not in TYPES_FICHIER:
        raise DonneesInvalides("Type de fichier non autorisé (PDF, images, Word uniquement)")
    if len(contenu) > TAILLE_MAX_OCTETS:
        raise TropVolumineux("Fichier trop volumineux (10 Mo max)")

    document = trouve(await depot.obtenir_document(id), INTROUVABLE)
    cle = cle_de_stockage(id, nom_fichier, int(time.time() * 1000))
    await stockage.enregistrer(cle, contenu, TYPES_FICHIER[extension])

    fichier_url = PREFIXE_URL + cle
    try:
        await depot.modifier_document(id, {"fichier_url": fichier_url, "fichier_nom": nom_fichier})
    except Exception:
        # La base n'a pas été mise à jour : on ne laisse pas de fichier orphelin
        await supprimer_sans_erreur(fichier_url)
        raise

    if document["fichier_url"] and document["fichier_url"] != fichier_url:
        await supprimer_sans_erreur(document["fichier_url"])
    return {"message": "Fichier uploadé avec succès", "fichier_url": fichier_url, "fichier_nom": nom_fichier}


async def supprimer(id: int) -> None:
    """Supprime aussi le fichier joint."""
    document = trouve(await depot.obtenir_document(id), INTROUVABLE)
    await depot.supprimer_document(id)
    await supprimer_sans_erreur(document["fichier_url"])
