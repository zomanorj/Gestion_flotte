"""Utilitaires : dates, pagination, formatage, découpage SQL."""
import pytest

from app.pdf.base import montant_fr, tronquer
from app.repositories.base import Conditions, Plage, Resultat
from app.sql_outils import instructions_sql
from app.temps import decalage_mysql
from app.utils import Pagination


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
