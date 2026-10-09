"""Règles métier pures : cycle de vie des missions, statut des documents, simulation."""
import pytest

from app.exceptions import Conflit
from app.services.documents import statut_depuis_jours
from app.services.missions import TRANSITIONS, verifier_transition
from app.services.simulation import calculer_delai, calculer_pause_evenement


class TestTransitionsMission:
    @pytest.mark.parametrize("actuel,nouveau", [
        ("planifiee", "en_cours"),
        ("planifiee", "annulee"),
        ("en_cours", "terminee"),
        ("en_cours", "annulee"),
    ])
    def test_transitions_autorisees(self, actuel, nouveau):
        verifier_transition(actuel, nouveau)

    @pytest.mark.parametrize("actuel,nouveau", [
        ("planifiee", "terminee"),
        ("en_cours", "planifiee"),
        ("terminee", "en_cours"),
        ("terminee", "annulee"),
        ("annulee", "en_cours"),
        ("annulee", "planifiee"),
    ])
    def test_transitions_interdites(self, actuel, nouveau):
        with pytest.raises(Conflit) as exc:
            verifier_transition(actuel, nouveau)
        assert exc.value.status == 409

    def test_etats_finaux_sans_sortie(self):
        assert TRANSITIONS["terminee"] == set()
        assert TRANSITIONS["annulee"] == set()

    def test_statut_inconnu_refuse(self):
        with pytest.raises(Conflit):
            verifier_transition("inconnu", "en_cours")


@pytest.mark.parametrize("jours,attendu", [
    (-1, "expire"),
    (-365, "expire"),
    (0, "expire_bientot"),
    (30, "expire_bientot"),
    (31, "valide"),
])
def test_statut_document(jours, attendu):
    assert statut_depuis_jours(jours, jours_alerte=30) == attendu


def test_statut_document_suit_le_seuil():
    assert statut_depuis_jours(45, jours_alerte=60) == "expire_bientot"
    assert statut_depuis_jours(45, jours_alerte=30) == "valide"


class TestSimulation:
    def test_delai_inversement_proportionnel_au_multiplicateur(self):
        route = {"distanceKm": 300, "points": [None] * 300}  # 1 km par point
        # 1 km à 60 km/h = 60 s ; x30 → 2 s ; x60 → 1 s
        assert calculer_delai(route, 30) == pytest.approx(2.0)
        assert calculer_delai(route, 60) == pytest.approx(1.0)

    def test_delai_minimum_50ms(self):
        route = {"distanceKm": 1, "points": [None] * 1000}
        assert calculer_delai(route, 60) == pytest.approx(0.05)

    @pytest.mark.parametrize("duree_min,mult,attendu", [
        (60, 1, 10.0),    # plafonné à 10 s
        (10, 60, 1.0),    # plancher à 1 s
        (30, 10, 3.0),
    ])
    def test_pause_evenement_bornee(self, duree_min, mult, attendu):
        assert calculer_pause_evenement(duree_min, mult) == pytest.approx(attendu)
