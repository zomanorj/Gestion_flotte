# Stockage des fichiers uploadés (documents des véhicules)
#
# STOCKAGE=local (défaut) : disque, dossier UPLOADS_DIR. En production, ce dossier doit être
#   un volume persistant (volume Docker, volume Railway) : le disque d'un conteneur est
#   effacé à chaque redéploiement.
# STOCKAGE=s3 : stockage objet compatible S3 (AWS S3, Cloudflare R2, MinIO…), configuré par
#   S3_BUCKET, S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION.
#
# Les fichiers sont identifiés par une clé relative, ex. "documents/doc_3_1700000000_assurance.pdf".
import asyncio
from pathlib import Path

from .config import config


class FichierIntrouvable(Exception):
    pass


class StockageLocal:
    def __init__(self, racine: Path):
        self.racine = racine.resolve()

    def _chemin(self, cle: str) -> Path:
        chemin = (self.racine / cle).resolve()
        # Interdit toute sortie du dossier racine (../, chemins absolus…)
        if not chemin.is_relative_to(self.racine):
            raise FichierIntrouvable(cle)
        return chemin

    async def preparer(self) -> None:
        (self.racine / "documents").mkdir(parents=True, exist_ok=True)

    async def enregistrer(self, cle: str, contenu: bytes, _content_type: str) -> None:
        chemin = self._chemin(cle)
        chemin.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(chemin.write_bytes, contenu)

    async def lire(self, cle: str) -> bytes:
        chemin = self._chemin(cle)
        if not chemin.is_file():
            raise FichierIntrouvable(cle)
        return await asyncio.to_thread(chemin.read_bytes)

    async def supprimer(self, cle: str) -> None:
        chemin = self._chemin(cle)
        await asyncio.to_thread(chemin.unlink, True)


class StockageS3:
    def __init__(self):
        import boto3
        from botocore.config import Config

        c = config()
        self.bucket = c.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=c.s3_endpoint_url,
            aws_access_key_id=c.s3_access_key_id,
            aws_secret_access_key=c.s3_secret_access_key.get_secret_value(),
            region_name=c.s3_region,
            config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
        )

    async def preparer(self) -> None:
        # Vérifie dès le démarrage que le bucket est accessible (erreur de config visible tout de suite)
        await asyncio.to_thread(self.client.head_bucket, Bucket=self.bucket)

    async def enregistrer(self, cle: str, contenu: bytes, content_type: str) -> None:
        await asyncio.to_thread(
            self.client.put_object, Bucket=self.bucket, Key=cle, Body=contenu, ContentType=content_type
        )

    async def lire(self, cle: str) -> bytes:
        try:
            reponse = await asyncio.to_thread(self.client.get_object, Bucket=self.bucket, Key=cle)
        except self.client.exceptions.NoSuchKey:
            raise FichierIntrouvable(cle) from None
        return await asyncio.to_thread(reponse["Body"].read)

    async def supprimer(self, cle: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=cle)


def _creer_stockage():
    if config().stockage == "s3":
        return StockageS3()
    return StockageLocal(config().dossier_uploads)


stockage = _creer_stockage()

PREFIXE_URL = "/uploads/"


def cle_depuis_url(fichier_url: str | None) -> str | None:
    """'/uploads/documents/x.pdf' (valeur stockée en base) → 'documents/x.pdf'."""
    if fichier_url and fichier_url.startswith(PREFIXE_URL):
        return fichier_url[len(PREFIXE_URL):]
    return None


async def supprimer_sans_erreur(fichier_url: str | None) -> None:
    """Suppression best-effort : un fichier déjà absent ne doit pas faire échouer la requête."""
    cle = cle_depuis_url(fichier_url)
    if not cle:
        return
    try:
        await stockage.supprimer(cle)
    except Exception as err:
        print(f"[Stockage] Suppression impossible de {cle} : {err}")
