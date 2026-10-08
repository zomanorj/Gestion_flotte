"""Utilitaires : dates, pagination, formatage, itinéraires, événements aléatoires, découpage SQL."""
import random
from datetime import datetime

import pytest

from app.erreurs import ErreurApi
from app.services.evenement import generer_evenements
from app.services.pdf import montant_fr, tronquer
from app.services.route import VILLES_MADAGASCAR, calculer_distance, decimer_points, route_ligne_droite
from app.temps import decalage_mysql
from app.utils import Pagination, date_heure, nombre, ou_none
from tests.conftest import instructions_sql


class TestDateHeure:
    @pytest.mark.parametrize("valeur,attendu", [
        ("2026-10-08", datetime(2026, 10, 8)),
        ("2026-10-08T08:30", datetime(2026, 10, 8, 8, 30)),
        ("2026-10-08 08:30:15", datetime(2026, 10, 8, 8, 30, 15)),
        ("2026-10-08T08:30:00Z", datetime(2026, 10, 8, 8, 30)),
    ])
    def test_formats_acceptes(self, valeur, attendu):
        assert date_heure(valeur, "d") == attendu

    @pytest.mark.parametrize("valeur", ["", "demain", "08/10/2026", None, 20261008])
    def test_formats_refuses(self, valeur):
        with pytest.raises(ErreurApi) as exc:
            date_heure(valeur, "date_depart")
        assert exc.value.status == 400
        assert "date_depart" in exc.value.message


class _RequeteFactice:
    def __init__(self, **query):
        self.query_params = query


class TestPagination:
    def test_inactive_par_defaut(self):
        assert not Pagination(_RequeteFactice()).actif

    def test_valeurs_et_reponse(self):
        pg = Pagination(_RequeteFactice(paginate="true", page="3", limit="10"))
        assert (pg.actif, pg.page, pg.limit, pg.offset) == (True, 3, 10, 20)
        assert pg.reponse(["a"], 25) == {"data": ["a"], "total": 25, "page": 3, "pages": 3, "limit": 10}

    @pytest.mark.parametrize("page,limit,attendu", [
        ("0", "0", (1, 20)),       # valeurs nulles → défauts
        ("-5", "999", (1, 200)),   # bornes
        ("abc", "xyz", (1, 20)),   # non numériques → défauts
    ])
    def test_valeurs_invalides_corrigees(self, page, limit, attendu):
        pg = Pagination(_RequeteFactice(paginate="true", page=page, limit=limit))
        assert (pg.page, pg.limit) == attendu


def test_ou_none_reproduit_le_ou_logique_js():
    assert [ou_none(v) for v in (0, "", None, [], "x", 3)] == [None, None, None, None, "x", 3]


def test_nombre():
    assert nombre("12.5") == 12.5
    assert nombre("abc") is None
    assert nombre(None) is None


@pytest.mark.parametrize("valeur,attendu", [(0, "0"), (1234, "1 234"), (841500.4, "841 500"), (-8500, "-8 500")])
def test_montant_fr(valeur, attendu):
    assert montant_fr(valeur) == attendu


def test_tronquer():
    assert tronquer("court", 10) == "court"
    assert tronquer("abcdefghij", 4) == "abcd…"


def test_decalage_madagascar():
    # Madagascar : UTC+3 toute l'année, sans heure d'été
    assert decalage_mysql() == "+03:00"


class TestItineraires:
    def test_decimation_garde_les_extremites(self):
        points = list(range(1001))
        resultat = decimer_points(points, 300)
        assert len(resultat) == 300
        assert resultat[0] == 0 and resultat[-1] == 1000
        assert resultat == sorted(resultat)

    def test_decimation_inutile_si_peu_de_points(self):
        assert decimer_points([1, 2, 3], 300) == [1, 2, 3]

    def test_distance_haversine_antananarivo_toamasina(self):
        distance = calculer_distance(VILLES_MADAGASCAR["Antananarivo"], VILLES_MADAGASCAR["Toamasina"])
        assert 210 < distance < 225  # ~217 km à vol d'oiseau

    def test_route_ligne_droite(self):
        route = route_ligne_droite(VILLES_MADAGASCAR["Antananarivo"], VILLES_MADAGASCAR["Antsirabe"], "A", "B")
        assert len(route["points"]) == 51
        assert route["points"][0] == VILLES_MADAGASCAR["Antananarivo"]
        assert route["points"][-1] == pytest.approx(VILLES_MADAGASCAR["Antsirabe"])
        assert route["dureeMin"] == pytest.approx(route["distanceKm"])


@pytest.mark.parametrize("graine", range(30))
def test_evenements_au_plus_3_et_espaces(graine, monkeypatch):
    random.seed(graine)
    points = [{"lat": 0, "lng": i} for i in range(300)]
    evenements = generer_evenements(points)
    assert len(evenements) <= 3
    index = [e["indexPoint"] for e in evenements]
    assert index == sorted(index)
    assert all(0 < i < len(points) for i in index)


class TestDecoupageSQL:
    def test_delimiter_et_procedures(self):
        script = """
CREATE DATABASE IF NOT EXISTS x;
USE x;
-- commentaire;
CREATE TABLE a (id INT);
DELIMITER //
CREATE PROCEDURE p()
BEGIN
  SELECT 1;
END //
DELIMITER ;
CALL p();
"""
        assert list(instructions_sql(script)) == [
            "CREATE TABLE a (id INT)",
            "CREATE PROCEDURE p()\nBEGIN\n  SELECT 1;\nEND",
            "CALL p()",
        ]
