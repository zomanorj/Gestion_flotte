"""Configuration technique (app/config.py) et règles des paramètres métier (app/services/parametres.py)."""
import secrets
from dataclasses import fields

import pytest
from pydantic import ValidationError

from app.config import Configuration, problemes_de_configuration
from app.services import parametres
from app.services.parametres import DEFINITIONS, Parametres

SECRET_FORT = secrets.token_urlsafe(48)


def charger(**variables) -> Configuration:
    """Configuration construite uniquement à partir des variables données (ni environnement ni .env)."""
    return Configuration(_env_file=None, **{"jwt_secret": "secret-de-developpement", **variables})


def problemes(**variables) -> list[str]:
    with pytest.raises(ValidationError) as exc:
        charger(**variables)
    return problemes_de_configuration(exc.value)


@pytest.fixture(autouse=True)
def environnement_vide(monkeypatch):
    """Isole les tests des variables d'environnement de la machine."""
    for variable in ("ENVIRONNEMENT", "JWT_SECRET", "SEED_DEMO", "MODE_DEMO", "STOCKAGE", "UPLOADS_DIR", "CLIENT_URL",
                     "ADMIN_EMAIL", "ADMIN_PASSWORD", "MYSQL_URL", "APP_TIMEZONE", "S3_BUCKET"):
        monkeypatch.delenv(variable, raising=False)


class TestConfiguration:
    def test_valeurs_par_defaut(self):
        c = charger()
        assert (c.environnement, c.port, c.stockage, c.seed_demo) == ("developpement", 5000, "local", False)
        assert not c.mode_demo and not c.charger_demo
        assert c.origines_client == ["http://localhost:5173"]

    def test_secret_obligatoire(self):
        with pytest.raises(ValidationError):
            Configuration(_env_file=None)

    def test_plusieurs_origines(self):
        assert charger(client_url="https://a.mg, https://b.mg").origines_client == ["https://a.mg", "https://b.mg"]

    @pytest.mark.parametrize("origine", ["app.mg", "https://app.mg/", "ftp://app.mg"])
    def test_origine_invalide(self, origine):
        assert any("CLIENT_URL" in p for p in problemes(client_url=origine))

    def test_fuseau_inconnu(self):
        assert problemes(app_timezone="Mars/Olympus") == ["APP_TIMEZONE : fuseau horaire inconnu : Mars/Olympus"]

    def test_admin_avec_mot_de_passe_trop_court(self):
        assert any("ADMIN_PASSWORD" in p for p in problemes(admin_email="a@b.mg", admin_password="court"))

    def test_s3_incomplet(self):
        assert any("S3_ACCESS_KEY_ID" in p for p in problemes(stockage="S3", s3_bucket="b"))

    def test_variables_vides_ignorees(self):
        c = charger(admin_email="", uploads_dir="", mysql_url="")
        assert c.admin_email is None and c.uploads_dir is None and c.mysql_url is None

    def test_secret_jamais_affiche(self):
        assert SECRET_FORT not in repr(charger(jwt_secret=SECRET_FORT))


class TestProduction:
    BASE = {"environnement": "production", "jwt_secret": SECRET_FORT, "uploads_dir": "/data/uploads"}

    def test_configuration_valide(self):
        assert charger(**self.BASE).environnement == "production"

    @pytest.mark.parametrize("secret", ["change-moi-en-production", "flotte_secret_jwt_2024", "x" * 31])
    def test_secret_faible_refuse(self, secret):
        assert any("JWT_SECRET" in p for p in problemes(**{**self.BASE, "jwt_secret": secret}))

    def test_donnees_de_demo_refusees(self):
        assert any("SEED_DEMO" in p for p in problemes(**self.BASE, seed_demo=True))

    def test_mode_demo_accepte_les_donnees_de_demo(self):
        c = charger(**{**self.BASE, "uploads_dir": None}, mode_demo=True, seed_demo=True)
        assert c.mode_demo and c.charger_demo

    def test_disque_ephemere_refuse(self):
        assert any("UPLOADS_DIR" in p for p in problemes(**{**self.BASE, "uploads_dir": None}))

    def test_stockage_s3_accepte_sans_dossier(self):
        c = charger(**{**self.BASE, "uploads_dir": None}, stockage="s3", s3_bucket="b", s3_access_key_id="k",
                    s3_secret_access_key="s")
        assert c.stockage == "s3"


class TestParametres:
    def test_definitions_et_valeurs_correspondent(self):
        assert {f.name for f in fields(Parametres)} == set(DEFINITIONS)

    def test_defauts_dans_les_bornes(self):
        for cle, d in DEFINITIONS.items():
            assert d.minimum <= d.defaut <= d.maximum, cle

    def test_defauts_historiques(self):
        """Mêmes valeurs qu'avant la création des paramètres : aucun calcul ne change à l'installation."""
        p = Parametres.par_defaut()
        assert (p.prix_litre_gasoil, p.salaire_base_defaut, p.prime_mission_defaut) == (5200, 800000, 50000)
        assert (p.seuil_bonus_km, p.tranche_bonus_km, p.bonus_par_tranche, p.taux_cnaps) == (500, 500, 20000, 1)
        assert (p.jours_alerte_documents, p.jours_alerte_maintenances, p.km_alerte_vidange) == (30, 7, 10000)

    def test_composer_applique_les_valeurs_modifiees(self):
        p = parametres.composer({"prix_litre_gasoil": "5400", "seuil_bonus_km": "800"})
        assert p.prix_litre_gasoil == 5400.0 and p.seuil_bonus_km == 800
        assert isinstance(p.seuil_bonus_km, int)

    @pytest.mark.parametrize("stocke", ["abc", "-5", "1e9"])
    def test_valeur_stockee_invalide_revient_au_defaut(self, stocke):
        assert parametres.composer({"prix_litre_gasoil": stocke}).prix_litre_gasoil == 5200

    def test_cle_inconnue_en_base_ignoree(self):
        assert parametres.composer({"ancien_parametre": "1"}) == Parametres.par_defaut()

    @pytest.mark.parametrize("changements,message", [
        ({}, "Aucun paramètre"),
        ({"inconnu": 1}, "Paramètre inconnu : inconnu"),
        ({"taux_cnaps": 25}, "entre 0 et 20 %"),
        ({"prix_litre_gasoil": 0}, "entre 1 et 100000"),
        ({"seuil_bonus_km": 500.5}, "nombre entier"),
    ])
    def test_validation(self, changements, message):
        with pytest.raises(parametres.DonneesInvalides, match=message):
            parametres.valider(changements)

    def test_validation_convertit(self):
        assert parametres.valider({"seuil_bonus_km": 600.0, "taux_cnaps": 1.5}) == {"seuil_bonus_km": 600,
                                                                                     "taux_cnaps": 1.5}

    @pytest.mark.parametrize("valeur,texte", [(5200, "5200"), (5200.0, "5200"), (0.3, "0.3"), (1.25, "1.25")])
    def test_representation_stockee(self, valeur, texte):
        assert parametres._texte(valeur) == texte
