# Configuration technique de l'API, lue dans l'environnement (et server/.env) et validée au démarrage
#
# Toute variable d'environnement passe par ici : aucun autre module ne lit os.environ.
# Une configuration invalide arrête l'API au démarrage avec la liste des problèmes, au lieu
# d'échouer plus tard sur une requête. Avec ENVIRONNEMENT=production, des règles
# supplémentaires refusent les réglages dangereux (secret faible, données de démo, disque
# éphémère pour les fichiers).
#
# Les paramètres métier (prix du gasoil, barème de paie, seuils d'alerte) ne sont pas ici :
# ils sont en base et modifiables par l'admin (app/services/parametres.py).
from functools import lru_cache
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

RACINE = Path(__file__).resolve().parents[1]

# Valeurs d'exemple publiées dans le dépôt : jamais acceptées en production
SECRETS_CONNUS = {
    "flotte_secret_jwt_2024", "change-moi-en-production", "a_remplacer_par_une_longue_chaine_aleatoire",
    "secret-de-test-uniquement",
}
LONGUEUR_MIN_SECRET_PRODUCTION = 32


class Configuration(BaseSettings):
    model_config = SettingsConfigDict(env_file=RACINE / ".env", env_file_encoding="utf-8", extra="ignore",
                                      case_sensitive=False)

    environnement: Literal["developpement", "test", "production"] = "developpement"
    port: int = Field(5000, ge=1, le=65535)

    # Sécurité
    jwt_secret: SecretStr = Field(min_length=16, description="Secret de signature des tokens")
    duree_token_heures: int = Field(24, ge=1, le=720)
    client_url: str = Field("http://localhost:5173",
                            description="Origine(s) du client web, séparées par des virgules (CORS et Socket.io)")

    # Base de données : MYSQL_URL (Railway) ou variables séparées
    mysql_url: str | None = None
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: SecretStr = SecretStr("")
    db_name: str = "flotte_db"

    app_timezone: str = "Indian/Antananarivo"

    # Démarrage
    seed_demo: bool = False
    # Démo publique : données remises à zéro régulièrement, actions sensibles bloquées
    mode_demo: bool = False
    demo_reinitialisation_heures: int = Field(24, ge=1, le=168)
    admin_email: str | None = None
    admin_password: SecretStr | None = None
    admin_nom: str = "Administrateur"

    # Fichiers uploadés
    stockage: Literal["local", "s3"] = "local"
    uploads_dir: Path | None = None
    s3_bucket: str | None = None
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: SecretStr | None = None
    s3_region: str = "auto"

    # Tests
    api_schemas_stricts: bool = False

    @field_validator("stockage", mode="before")
    @classmethod
    def _minuscules(cls, valeur):
        return valeur.lower() if isinstance(valeur, str) else valeur

    @field_validator("app_timezone")
    @classmethod
    def _fuseau_connu(cls, valeur: str) -> str:
        try:
            ZoneInfo(valeur)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(f"fuseau horaire inconnu : {valeur}") from None
        return valeur

    @field_validator("client_url")
    @classmethod
    def _origines_valides(cls, valeur: str) -> str:
        for origine in valeur.split(","):
            origine = origine.strip()
            if not origine.startswith(("http://", "https://")) or origine.endswith("/"):
                raise ValueError(f"origine invalide « {origine} » (attendu : https://domaine, sans / final)")
        return valeur

    @field_validator("admin_email", "mysql_url", "uploads_dir", "s3_bucket", "s3_endpoint_url",
                     "s3_access_key_id", "s3_secret_access_key", "admin_password", mode="before")
    @classmethod
    def _vide_vers_none(cls, valeur):
        return None if isinstance(valeur, str) and not valeur.strip() else valeur

    @model_validator(mode="after")
    def _coherence(self):
        erreurs = []
        if self.admin_email and len(self.mot_de_passe_admin) < 8:
            erreurs.append("ADMIN_PASSWORD doit faire au moins 8 caractères quand ADMIN_EMAIL est défini")
        if self.stockage == "s3":
            manquantes = [nom for nom, valeur in (("S3_BUCKET", self.s3_bucket),
                                                   ("S3_ACCESS_KEY_ID", self.s3_access_key_id),
                                                   ("S3_SECRET_ACCESS_KEY", self.s3_secret_access_key)) if not valeur]
            if manquantes:
                erreurs.append(f"STOCKAGE=s3 exige {', '.join(manquantes)}")
        if self.environnement == "production":
            secret = self.jwt_secret.get_secret_value()
            if len(secret) < LONGUEUR_MIN_SECRET_PRODUCTION or secret in SECRETS_CONNUS:
                erreurs.append(f"JWT_SECRET doit être une valeur aléatoire propre à la production "
                               f"({LONGUEUR_MIN_SECRET_PRODUCTION} caractères minimum)")
            # En mode démo, les comptes connus sont voulus et l'envoi de fichiers est bloqué
            if self.seed_demo and not self.mode_demo:
                erreurs.append("SEED_DEMO est interdit en production (comptes au mot de passe connu), "
                               "sauf avec MODE_DEMO=1")
            if self.stockage == "local" and self.uploads_dir is None and not self.mode_demo:
                erreurs.append("En production, définir UPLOADS_DIR sur un volume persistant, ou utiliser STOCKAGE=s3 "
                               "(le disque d'un conteneur est effacé à chaque déploiement)")
        if erreurs:
            raise ValueError(" ; ".join(erreurs))
        return self

    # ── Valeurs dérivées ───────────────────────────────────────────────────────
    @property
    def origines_client(self) -> list[str]:
        return [o.strip() for o in self.client_url.split(",") if o.strip()]

    @property
    def charger_demo(self) -> bool:
        return self.seed_demo or self.mode_demo

    @property
    def mot_de_passe_admin(self) -> str:
        return self.admin_password.get_secret_value() if self.admin_password else ""

    @property
    def dossier_uploads(self) -> Path:
        return self.uploads_dir or RACINE / "uploads"


@lru_cache
def config() -> Configuration:
    """Configuration chargée une fois pour toutes (lève ValidationError si elle est invalide)."""
    return Configuration()


def problemes_de_configuration(erreur) -> list[str]:
    """Messages lisibles à partir d'une ValidationError de Configuration."""
    messages = []
    for e in erreur.errors():
        champ = ".".join(str(p) for p in e["loc"]).upper()
        texte = e["msg"].removeprefix("Value error, ")
        if e["type"] == "missing":
            texte = "variable obligatoire manquante"
        messages.extend(f"{champ + ' : ' if champ else ''}{m}" for m in texte.split(" ; "))
    return messages
