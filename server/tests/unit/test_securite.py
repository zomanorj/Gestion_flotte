"""Briques de sécurité : limitation des connexions, mots de passe, stockage local."""
import asyncio

import pytest

from app import limiteur as module_limiteur
from app.auth import hacher_mdp, verifier_mdp
from app.exceptions import TropDeTentatives
from app.limiteur import MAX_ECHECS_EMAIL, MAX_ECHECS_IP, LimiteurConnexion
from app.stockage import FichierIntrouvable, StockageLocal, cle_depuis_url


class _Horloge:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


@pytest.fixture
def horloge(monkeypatch):
    h = _Horloge()
    monkeypatch.setattr(module_limiteur.time, "monotonic", h)
    return h


class TestLimiteurConnexion:
    def test_bloque_un_email_apres_trop_d_echecs(self, horloge):
        lim = LimiteurConnexion()
        for _ in range(MAX_ECHECS_EMAIL):
            lim.verifier("1.1.1.1", "a@x.mg")
            lim.enregistrer_echec("1.1.1.1", "a@x.mg")
        with pytest.raises(TropDeTentatives) as exc:
            lim.verifier("2.2.2.2", "a@x.mg")  # même compte, autre IP : toujours bloqué
        assert exc.value.status == 429
        assert int(exc.value.entetes["Retry-After"]) > 0

    def test_autre_email_non_bloque(self, horloge):
        lim = LimiteurConnexion()
        for _ in range(MAX_ECHECS_EMAIL):
            lim.enregistrer_echec("1.1.1.1", "a@x.mg")
        lim.verifier("1.1.1.1", "b@x.mg")

    def test_bloque_une_ip_qui_essaie_beaucoup_de_comptes(self, horloge):
        lim = LimiteurConnexion()
        for i in range(MAX_ECHECS_IP):
            lim.enregistrer_echec("9.9.9.9", f"compte{i}@x.mg")
        with pytest.raises(TropDeTentatives):
            lim.verifier("9.9.9.9", "nouveau@x.mg")
        lim.verifier("8.8.8.8", "nouveau@x.mg")

    def test_fenetre_glissante(self, horloge):
        lim = LimiteurConnexion()
        for _ in range(MAX_ECHECS_EMAIL):
            lim.enregistrer_echec("1.1.1.1", "a@x.mg")
        horloge.t += module_limiteur.FENETRE_SECONDES + 1
        lim.verifier("1.1.1.1", "a@x.mg")

    def test_succes_reinitialise_le_compte(self, horloge):
        lim = LimiteurConnexion()
        for _ in range(MAX_ECHECS_EMAIL - 1):
            lim.enregistrer_echec("1.1.1.1", "a@x.mg")
        lim.reinitialiser("a@x.mg")
        lim.enregistrer_echec("1.1.1.1", "a@x.mg")
        lim.verifier("1.1.1.1", "a@x.mg")


class TestMotsDePasse:
    def test_hachage_et_verification(self):
        hash_ = asyncio.run(hacher_mdp("secret123"))
        assert hash_.startswith("$2b$")
        assert asyncio.run(verifier_mdp("secret123", hash_))
        assert not asyncio.run(verifier_mdp("mauvais", hash_))

    def test_compte_inexistant_toujours_refuse(self):
        assert not asyncio.run(verifier_mdp("mot-de-passe-factice", None))

    def test_hash_corrompu_refuse(self):
        assert not asyncio.run(verifier_mdp("x", "pas-un-hash"))


class TestStockageLocal:
    def test_cycle_complet(self, tmp_path):
        st = StockageLocal(tmp_path)
        asyncio.run(st.enregistrer("documents/a.pdf", b"%PDF", "application/pdf"))
        assert asyncio.run(st.lire("documents/a.pdf")) == b"%PDF"
        asyncio.run(st.supprimer("documents/a.pdf"))
        with pytest.raises(FichierIntrouvable):
            asyncio.run(st.lire("documents/a.pdf"))

    @pytest.mark.parametrize("cle", ["../secret.txt", "documents/../../secret.txt", "/etc/passwd"])
    def test_sortie_du_dossier_interdite(self, tmp_path, cle):
        (tmp_path.parent / "secret.txt").write_text("x")
        st = StockageLocal(tmp_path / "uploads")
        with pytest.raises(FichierIntrouvable):
            asyncio.run(st.lire(cle))

    def test_cle_depuis_url(self):
        assert cle_depuis_url("/uploads/documents/a.pdf") == "documents/a.pdf"
        assert cle_depuis_url("/autre/a.pdf") is None
        assert cle_depuis_url(None) is None
