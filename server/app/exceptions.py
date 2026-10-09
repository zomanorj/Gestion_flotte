# Exceptions métier
#
# Les services lèvent ces exceptions sans rien savoir de HTTP ; app/erreurs.py les traduit en
# réponse { "message": ... } avec le code HTTP indiqué par `status`. Le message est destiné à
# l'utilisateur final : en français, précis, sans détail technique.


class ErreurMetier(Exception):
    status = 400

    def __init__(self, message: str, *, entetes: dict | None = None):
        super().__init__(message)
        self.message = message
        self.entetes = entetes


class DonneesInvalides(ErreurMetier):
    """Requête cohérente en apparence mais inacceptable (ex. ville inconnue, champ requis)."""
    status = 400


class NonAuthentifie(ErreurMetier):
    status = 401


class AccesRefuse(ErreurMetier):
    status = 403


class Introuvable(ErreurMetier):
    status = 404


class Conflit(ErreurMetier):
    """L'état actuel des données empêche l'opération (doublon, ressource occupée, transition)."""
    status = 409


class TropVolumineux(ErreurMetier):
    status = 413


class TropDeTentatives(ErreurMetier):
    status = 429


def trouve(ligne: dict | None, message: str) -> dict:
    """Retourne la ligne, ou lève Introuvable si la requête n'a rien trouvé."""
    if not ligne:
        raise Introuvable(message)
    return ligne
