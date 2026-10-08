"""Paie : calcul du salaire (primes, bonus kilométrique, CNAPS), masse salariale, bulletins."""
import pytest

from app.temps import aujourdhui


@pytest.fixture
def chauffeur_avec_missions(api, admin, fabrique_chauffeur, creer_mission):
    """
    Chauffeur ayant terminé ce mois-ci deux missions de 700 km (1 400 km au total).
    Les missions sont terminées via l'API : date_retour_reelle = maintenant.
    """
    fiche = fabrique_chauffeur()
    for jour in ("01", "05"):
        v = api.post("/vehicules", headers=admin, json={
            "immatriculation": f"PAIE-{fiche['id']}-{jour}", "marque": "a", "modele": "b", "annee": 2020}).json()
        m = creer_mission(v["id"], fiche["id"], f"2020-02-{jour}T08:00", f"2020-02-{jour}T20:00",
                          distance_km=700).json()
        for statut in ("en_cours", "terminee"):
            assert api.put(f"/missions/{m['id']}/statut", headers=admin, json={"statut": statut}).status_code == 200
    return fiche


def test_calcul_de_la_fiche(api, admin, chauffeur_avec_missions):
    aujourd_hui = aujourdhui()  # mois courant à Madagascar, comme l'API
    r = api.get(f"/paie/chauffeur/{chauffeur_avec_missions['id']}/{aujourd_hui.year}/{aujourd_hui.month}",
                headers=admin)
    assert r.status_code == 200
    calcul = r.json()["calcul"]
    # 800 000 de base + 2 × 50 000 de primes + 20 000 de bonus (1 400 km : une tranche de 500 km au-delà de 500)
    assert calcul == {
        "nb_missions": 2, "total_km": 1400, "salaire_base": 800000, "total_primes": 100000,
        "km_bonus": 20000, "total_brut": 920000, "cnaps": 9200, "net_a_payer": 910800,
    }


def test_masse_salariale(api, admin, chauffeur_avec_missions):
    aujourd_hui = aujourdhui()  # mois courant à Madagascar, comme l'API
    r = api.get(f"/paie/{aujourd_hui.year}/{aujourd_hui.month}", headers=admin).json()
    fiche = next(f for f in r["fiches"] if f["chauffeur_id"] == chauffeur_avec_missions["id"])
    assert fiche["net_a_payer"] == 910800
    assert r["masse_salariale"] == pytest.approx(sum(f["net_a_payer"] for f in r["fiches"]))


def test_mois_sans_mission(api, admin, chauffeur_fiche):
    calcul = api.get(f"/paie/chauffeur/{chauffeur_fiche['id']}/2001/1", headers=admin).json()["calcul"]
    assert calcul["nb_missions"] == 0 and calcul["km_bonus"] == 0
    assert calcul["net_a_payer"] == 800000 - 8000


def test_modification_du_salaire(api, admin, chauffeur_fiche):
    r = api.patch(f"/paie/chauffeur/{chauffeur_fiche['id']}/salaire", headers=admin,
                  json={"salaire_base": 1000000, "prime_mission": 60000})
    assert r.json()["salaire_base"] == 1000000
    calcul = api.get(f"/paie/chauffeur/{chauffeur_fiche['id']}/2001/1", headers=admin).json()["calcul"]
    assert calcul["salaire_base"] == 1000000


def test_modification_sans_champ(api, admin, chauffeur_fiche):
    assert api.patch(f"/paie/chauffeur/{chauffeur_fiche['id']}/salaire", headers=admin, json={}).status_code == 400


@pytest.mark.parametrize("mois", [0, 13])
def test_mois_invalide(api, admin, mois):
    assert api.get(f"/paie/2026/{mois}", headers=admin).status_code == 400


def test_chauffeur_inexistant(api, admin):
    assert api.get("/paie/chauffeur/999999/2026/1", headers=admin).status_code == 404


def test_bulletin_pdf(api, admin, chauffeur_avec_missions):
    aujourd_hui = aujourdhui()  # mois courant à Madagascar, comme l'API
    r = api.get(f"/paie/chauffeur/{chauffeur_avec_missions['id']}/{aujourd_hui.year}/{aujourd_hui.month}/pdf",
                headers=admin)
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    assert "bulletin_" in r.headers["content-disposition"]
