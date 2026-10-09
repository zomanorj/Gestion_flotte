"""
Paramètres métier : droits, validation, historique, et effet réel sur les calculs.

Les paramètres sont partagés par toute la session : chaque test qui en modifie un le remet à sa
valeur par défaut (fixture `restaurer`), pour ne pas influencer les autres tests.
"""
import pytest

from app.temps import aujourdhui


@pytest.fixture
def restaurer(api, admin):
    modifies = []

    def noter(*cles):
        modifies.extend(cles)

    yield noter
    for cle in modifies:
        api.delete(f"/parametres/{cle}", headers=admin)


def _parametre(api, headers, cle):
    return next(p for p in api.get("/parametres", headers=headers).json() if p["cle"] == cle)


def _modifier(api, headers, **valeurs):
    return api.put("/parametres", headers=headers, json={"valeurs": valeurs})


class TestDroits:
    def test_lecture_par_la_gestion(self, api, gestionnaire):
        parametres = api.get("/parametres", headers=gestionnaire).json()
        assert {"prix_litre_gasoil", "taux_cnaps", "jours_alerte_documents"} <= {p["cle"] for p in parametres}
        assert {p["categorie"] for p in parametres} == {"Missions", "Paie", "Alertes"}

    def test_chauffeur_sans_acces(self, api, chauffeur):
        assert api.get("/parametres", headers=chauffeur).status_code == 403

    def test_modification_reservee_a_l_admin(self, api, gestionnaire):
        assert _modifier(api, gestionnaire, prix_litre_gasoil=6000).status_code == 403
        assert api.delete("/parametres/prix_litre_gasoil", headers=gestionnaire).status_code == 403
        assert api.get("/parametres/historique", headers=gestionnaire).status_code == 403


class TestModification:
    def test_modification_tracee_puis_retour_au_defaut(self, api, admin, restaurer):
        restaurer("prix_litre_gasoil")
        r = _modifier(api, admin, prix_litre_gasoil=5400)
        assert r.status_code == 200
        prix = next(p for p in r.json() if p["cle"] == "prix_litre_gasoil")
        assert (prix["valeur"], prix["defaut"], prix["personnalise"]) == (5400, 5200, True)
        assert prix["modifie_par_nom"] and prix["modifie_le"]

        trace = api.get("/parametres/historique", headers=admin).json()[0]
        assert (trace["cle"], trace["ancienne_valeur"], trace["nouvelle_valeur"]) == ("prix_litre_gasoil", None,
                                                                                       "5400")

        prix = next(p for p in api.delete("/parametres/prix_litre_gasoil", headers=admin).json()
                    if p["cle"] == "prix_litre_gasoil")
        assert (prix["valeur"], prix["personnalise"]) == (5200, False)
        assert api.get("/parametres/historique", headers=admin).json()[0]["nouvelle_valeur"] is None

    def test_tout_ou_rien(self, api, admin):
        r = _modifier(api, admin, prix_litre_gasoil=5500, taux_cnaps=99)
        assert r.status_code == 400
        assert "Cotisation CNAPS" in r.json()["message"]
        assert _parametre(api, admin, "prix_litre_gasoil")["valeur"] == 5200

    def test_valeur_identique_non_tracee(self, api, admin):
        avant = len(api.get("/parametres/historique", headers=admin).json())
        assert _modifier(api, admin, prix_litre_gasoil=5200).status_code == 200
        assert len(api.get("/parametres/historique", headers=admin).json()) == avant

    @pytest.mark.parametrize("corps", [{}, {"valeurs": {}}, {"valeurs": {"prix_litre_gasoil": "cher"}},
                                       {"valeurs": {"inconnu": 1}}])
    def test_requetes_invalides(self, api, admin, corps):
        assert api.put("/parametres", headers=admin, json=corps).status_code == 400

    def test_reinitialiser_un_parametre_inconnu(self, api, admin):
        assert api.delete("/parametres/inconnu", headers=admin).status_code == 404


class TestEffetSurLesCalculs:
    def test_prix_du_gasoil_et_cout_des_missions(self, api, admin, vehicule, chauffeur_fiche, creer_mission,
                                                 restaurer):
        restaurer("prix_litre_gasoil")
        _modifier(api, admin, prix_litre_gasoil=6000)
        m = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2036-01-01T08:00", "2036-01-02T08:00",
                          distance_km=100).json()
        for statut in ("en_cours", "terminee"):
            r = api.put(f"/missions/{m['id']}/statut", headers=admin, json={"statut": statut})
        # 100 km × 0,3 L/km × 6 000 Ar
        assert r.json()["cout_carburant"] == pytest.approx(180000)

    def test_bareme_de_paie(self, api, admin, fabrique_chauffeur, creer_mission, restaurer):
        restaurer("taux_cnaps", "bonus_par_tranche")
        _modifier(api, admin, taux_cnaps=2, bonus_par_tranche=30000)
        fiche = fabrique_chauffeur()
        v = api.post("/vehicules", headers=admin, json={"immatriculation": f"BAR-{fiche['id']}", "marque": "a",
                                                         "modele": "b", "annee": 2020}).json()
        m = creer_mission(v["id"], fiche["id"], "2020-05-01T08:00", "2020-05-01T20:00", distance_km=1000).json()
        for statut in ("en_cours", "terminee"):
            api.put(f"/missions/{m['id']}/statut", headers=admin, json={"statut": statut})

        mois = aujourdhui()
        calcul = api.get(f"/paie/chauffeur/{fiche['id']}/{mois.year}/{mois.month}", headers=admin).json()["calcul"]
        assert calcul["km_bonus"] == 30000
        assert calcul["cnaps"] == round((800000 + 50000 + 30000) * 0.02)

    def test_defauts_d_un_nouveau_chauffeur_et_d_un_nouveau_camion(self, api, admin, restaurer):
        restaurer("salaire_base_defaut", "consommation_par_defaut")
        _modifier(api, admin, salaire_base_defaut=950000, consommation_par_defaut=0.42)
        chauffeur = api.post("/chauffeurs", headers=admin, json={"nom": "N", "prenom": "P", "telephone": "1",
                                                                  "numero_permis": "PARAM-1"}).json()
        assert chauffeur["salaire_base"] == 950000
        camion = api.post("/vehicules", headers=admin, json={"immatriculation": "PARAM-1", "marque": "a",
                                                              "modele": "b", "annee": 2020}).json()
        assert camion["consommation_litre_km"] == pytest.approx(0.42)
        # Une valeur explicite reste prioritaire
        autre = api.post("/vehicules", headers=admin, json={"immatriculation": "PARAM-2", "marque": "a",
                                                             "modele": "b", "annee": 2020,
                                                             "consommation_litre_km": 0.5}).json()
        assert autre["consommation_litre_km"] == pytest.approx(0.5)

    def test_seuil_d_alerte_des_documents(self, api, admin, vehicule, restaurer):
        restaurer("jours_alerte_documents")
        from datetime import timedelta
        echeance = (aujourdhui() + timedelta(days=45)).isoformat()
        doc = api.post("/documents", headers=admin, json={"vehicule_id": vehicule["id"], "type": "vignette",
                                                           "date_emission": "2026-01-01",
                                                           "date_expiration": echeance}).json()
        assert doc["statut"] == "valide"
        assert doc["id"] not in [d["id"] for d in api.get("/documents/alertes", headers=admin).json()]

        _modifier(api, admin, jours_alerte_documents=60)
        assert doc["id"] in [d["id"] for d in api.get("/documents/alertes", headers=admin).json()]
        liste = api.get("/documents", headers=admin, params={"vehicule_id": vehicule["id"]}).json()
        assert liste[0]["statut"] == "expire_bientot"
