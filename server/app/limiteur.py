# Protection du login contre la force brute
#
# Compte les échecs sur une fenêtre glissante, par adresse IP et par email :
# - par email : protège un compte précis même si l'attaquant change d'IP ;
# - par IP : limite une machine qui essaie beaucoup de comptes différents.
#
# État en mémoire du processus : suffisant avec un seul worker. Avec plusieurs workers ou
# plusieurs instances, il faudra le déplacer dans Redis.
import time
from collections import deque

from .erreurs import ErreurApi

FENETRE_SECONDES  = 15 * 60
MAX_ECHECS_EMAIL  = 5
MAX_ECHECS_IP     = 20
MAX_CLES          = 10_000


class LimiteurConnexion:
    def __init__(self):
        self._echecs: dict[str, deque[float]] = {}

    def _purger(self, cle: str, maintenant: float) -> deque[float]:
        file = self._echecs.get(cle)
        if file is None:
            return deque()
        while file and file[0] <= maintenant - FENETRE_SECONDES:
            file.popleft()
        if not file:
            del self._echecs[cle]
        return file

    def verifier(self, ip: str, email: str) -> None:
        """Lève 429 si l'IP ou l'email a dépassé son quota d'échecs."""
        maintenant = time.monotonic()
        for cle, maximum in ((f"ip:{ip}", MAX_ECHECS_IP), (f"email:{email}", MAX_ECHECS_EMAIL)):
            file = self._purger(cle, maintenant)
            if len(file) >= maximum:
                attente = int(file[0] + FENETRE_SECONDES - maintenant) + 1
                minutes = -(-attente // 60)
                raise ErreurApi(
                    429,
                    f"Trop de tentatives de connexion. Réessayez dans {minutes} minute(s).",
                    headers={"Retry-After": str(attente)},
                )

    def enregistrer_echec(self, ip: str, email: str) -> None:
        maintenant = time.monotonic()
        if len(self._echecs) > MAX_CLES:
            # Garde-fou mémoire : on repart de zéro plutôt que de grossir indéfiniment
            self._echecs.clear()
        for cle in (f"ip:{ip}", f"email:{email}"):
            self._echecs.setdefault(cle, deque()).append(maintenant)

    def reinitialiser(self, email: str) -> None:
        self._echecs.pop(f"email:{email}", None)


limiteur_connexion = LimiteurConnexion()
