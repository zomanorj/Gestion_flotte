# Fuseau horaire de l'application (Madagascar par défaut)
#
# Les dates métier (DATETIME) sont stockées en heure locale. La session MySQL est réglée
# sur le même décalage (voir db.py), de sorte que CURDATE() / NOW() et Python soient d'accord,
# quel que soit le fuseau du serveur (Railway et Docker tournent en UTC).
from datetime import date, datetime
from zoneinfo import ZoneInfo

from .config import config

FUSEAU = ZoneInfo(config().app_timezone)


def maintenant() -> datetime:
    """Date et heure locales, sans tzinfo (même convention que les colonnes DATETIME)."""
    return datetime.now(FUSEAU).replace(tzinfo=None)


def aujourdhui() -> date:
    return maintenant().date()


def decalage_mysql() -> str:
    """Décalage UTC courant au format MySQL, ex. '+03:00'."""
    secondes = int(datetime.now(FUSEAU).utcoffset().total_seconds())
    signe = "+" if secondes >= 0 else "-"
    heures, reste = divmod(abs(secondes), 3600)
    return f"{signe}{heures:02d}:{reste // 60:02d}"
