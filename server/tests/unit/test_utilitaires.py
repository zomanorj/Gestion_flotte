"""Utilitaires : dates, pagination, formatage, itinéraires, événements aléatoires, découpage SQL."""
import random

import pytest

from app.pdf.base import montant_fr, tronquer
from app.repositories.base import Conditions, Plage, Resultat
from app.services.evenement import generer_evenements
from app.services.route import VILLES_MADAGASCAR, calculer_distance, decimer_points, route_ligne_droite
from app.temps import decalage_mysql
from app.utils import Pagination
from tests.conftest import instructions_sql


class TestPagination:
    def test_valeurs_et_reponse(self):
        pg = Pagination(paginate=True, page=3, limit=10)
        assert (pg.actif, pg.page, pg.limit, pg.offset) == (True, 3, 10, 20)
        assert pg.reponse(["a"], 25) == {"data": ["a"], "total": 25, "page": 3, "pages": 3, "limit": 10}

    def test_limite_plafonnee(self):
        assert Pagination(paginate=True, page=1, limit=999).limit == 200

    def test_page_vide(self):
        assert Pagination(paginate=True, page=1, limit=20).reponse([], 0)["pages"] == 0


class TestConditions:
    def test_filtres_vides_ignores(self):
        c = Conditions().si("statut = %s", None).si("type = %s", "").si("vehicule_id = %s", 3)
        assert (c.where, c.params) == (" WHERE vehicule_id = %s", [3])

    def test_plusieurs_valeurs(self):
        c = Conditions().si("(a LIKE %s OR b LIKE %s)", "%x%", "%x%").si("d >= %s", 0)
        assert c.where == " WHERE (a LIKE %s OR b LIKE %s) AND d >= %s"
        assert c.params == ["%x%", "%x%", 0]

    def test_aucun_filtre(self):
        assert Conditions().where == ""


def test_pagination_vers_plage_et_formatage():
    assert Pagination(paginate=False, page=1, limit=20).plage is None
    pg = Pagination(paginate=True, page=2, limit=10)
    assert pg.plage == Plage(10, 10)
    assert pg.formater(Resultat([{"id": 1}], 11))["pages"] == 2
    assert Pagination(paginate=False, page=1, limit=20).formater(Resultat([{"id": 1}])) == [{"id": 1}]


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
