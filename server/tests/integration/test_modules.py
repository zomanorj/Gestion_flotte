"""Modules CRUD : véhicules, chauffeurs, clients, carburant, dépenses, maintenances, tableau de bord."""
import pytest

from tests.conftest import unique


class TestVehicules:
    def test_creation_normalise_l_immatriculation(self, api, admin):
        immat = unique("mad-")
        r = api.post("/vehicules", headers=admin, json={"immatriculation": immat, "marque": "Volvo", "modele": "FH",
                                                         "annee": 2021})
        assert r.status_code == 201
        assert r.json()["immatriculation"] == immat.upper()
        assert r.json()["statut"] == "disponible"

    def test_doublon(self, api, admin, vehicule):
        r = api.post("/vehicules", headers=admin, json={"immatriculation": vehicule["immatriculation"], "marque": "a",
                                                         "modele": "b", "annee": 2020})
        assert r.status_code == 409

    def test_mise_a_jour_partielle(self, api, admin, vehicule):
        r = api.put(f"/vehicules/{vehicule['id']}", headers=admin, json={"kilometrage": 12345})
        assert r.json()["kilometrage"] == 12345
        assert r.json()["marque"] == vehicule["marque"]

    def test_detail_et_recherche(self, api, admin, vehicule):
        detail = api.get(f"/vehicules/{vehicule['id']}", headers=admin).json()
        assert detail["missions"] == [] and detail["maintenances"] == []
        trouves = api.get("/vehicules", headers=admin, params={"search": vehicule["immatriculation"]}).json()
        assert [v["id"] for v in trouves] == [vehicule["id"]]
        assert api.get("/vehicules/999999", headers=admin).status_code == 404

    def test_suppression_bloquee_par_l_historique(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        creer_mission(vehicule["id"], chauffeur_fiche["id"], "2033-01-01", "2033-01-02")
        assert api.delete(f"/vehicules/{vehicule['id']}", headers=admin).status_code == 409

    def test_suppression(self, api, admin, vehicule):
        assert api.delete(f"/vehicules/{vehicule['id']}", headers=admin).status_code == 200
        assert api.get(f"/vehicules/{vehicule['id']}", headers=admin).status_code == 404


class TestChauffeurs:
    def test_permis_unique(self, api, admin, chauffeur_fiche):
        r = api.post("/chauffeurs", headers=admin, json={"nom": "a", "prenom": "b", "telephone": "1",
                                                          "numero_permis": chauffeur_fiche["numero_permis"]})
        assert r.status_code == 409

    def test_statistiques_et_historique(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        creer_mission(vehicule["id"], chauffeur_fiche["id"], "2033-02-01", "2033-02-02", distance_km=150)
        detail = api.get(f"/chauffeurs/{chauffeur_fiche['id']}", headers=admin).json()
        assert detail["stats"]["total_missions"] == 1
        assert detail["stats"]["total_km"] == 150
        assert len(api.get(f"/chauffeurs/{chauffeur_fiche['id']}/missions", headers=admin).json()) == 1

    def test_suppression(self, api, admin, chauffeur_fiche):
        assert api.delete(f"/chauffeurs/{chauffeur_fiche['id']}", headers=admin).status_code == 200


class TestClients:
    def test_cycle_complet(self, api, admin):
        r = api.post("/clients", headers=admin, json={"nom": unique("Client ")})
        assert r.status_code == 201
        client = r.json()
        assert client["type"] == "entreprise"
        assert api.put(f"/clients/{client['id']}", headers=admin,
                       json={"nom": client["nom"], "ville": "Toamasina"}).json()["ville"] == "Toamasina"
        assert api.get(f"/clients/{client['id']}/missions", headers=admin).json()["missions"] == []
        assert api.delete(f"/clients/{client['id']}", headers=admin).status_code == 200
        assert api.get(f"/clients/{client['id']}/missions", headers=admin).status_code == 404

    def test_suppression_detache_les_missions(self, api, admin, vehicule, chauffeur_fiche, creer_mission, sql):
        client = api.post("/clients", headers=admin, json={"nom": unique("Client ")}).json()
        mission = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2033-03-01", "2033-03-02").json()
        sql("UPDATE missions SET client_id = %s WHERE id = %s", [client["id"], mission["id"]])
        assert api.delete(f"/clients/{client['id']}", headers=admin).status_code == 200
        assert sql("SELECT client_id FROM missions WHERE id = %s", [mission["id"]])[0]["client_id"] is None

    def test_nom_obligatoire(self, api, admin):
        assert api.post("/clients", headers=admin, json={}).status_code == 400

    def test_pagination(self, api, admin):
        page = api.get("/clients?paginate=true&limit=2", headers=admin).json()
        assert len(page["data"]) <= 2 and page["total"] >= len(page["data"])


class TestCarburant:
    def test_cout_calcule(self, api, admin, vehicule):
        r = api.post("/carburant", headers=admin, json={"vehicule_id": vehicule["id"], "date_plein": "2026-10-01",
                                                         "litres": "50", "prix_litre": 5200})
        assert r.status_code == 201
        assert r.json()["cout_total"] == 260000
        plein = r.json()
        r = api.put(f"/carburant/{plein['id']}", headers=admin, json={"vehicule_id": vehicule["id"],
                                                                      "date_plein": "2026-10-02", "litres": 10,
                                                                      "prix_litre": 5000})
        assert r.json()["cout_total"] == 50000
        assert api.delete(f"/carburant/{plein['id']}", headers=admin).status_code == 200

    @pytest.mark.parametrize("litres,prix", [("abc", 1), (-5, 1), (10, 0)])
    def test_valeurs_invalides(self, api, admin, vehicule, litres, prix):
        r = api.post("/carburant", headers=admin, json={"vehicule_id": vehicule["id"], "date_plein": "2026-10-01",
                                                         "litres": litres, "prix_litre": prix})
        assert r.status_code == 400
        # Même format que toutes les erreurs : le frontend affiche "message"
        assert r.json()["message"].startswith("litres") or r.json()["message"].startswith("prix_litre")

    def test_statistiques(self, api, admin):
        stats = api.get("/carburant/stats", headers=admin).json()
        assert {"totalLitres", "coutTotal", "coutMois", "parVehicule", "evolutionMensuelle"} <= stats.keys()


class TestDepenses:
    def test_cycle_complet(self, api, admin, vehicule):
        r = api.post("/depenses", headers=admin, json={"vehicule_id": vehicule["id"], "categorie": "peage",
                                                        "montant": 15000, "date_depense": "2026-10-03"})
        assert r.status_code == 201
        filtre = api.get("/depenses", headers=admin, params={"vehicule_id": vehicule["id"]}).json()
        assert [d["id"] for d in filtre] == [r.json()["id"]]
        assert api.delete(f"/depenses/{r.json()['id']}", headers=admin).status_code == 200

    def test_montant_invalide(self, api, admin, vehicule):
        r = api.post("/depenses", headers=admin, json={"vehicule_id": vehicule["id"], "categorie": "peage",
                                                        "montant": -1, "date_depense": "2026-10-03"})
        assert r.status_code == 400

    def test_statistiques(self, api, admin):
        assert api.get("/depenses/stats", headers=admin).json()["nbDepenses"] >= 0


class TestMaintenances:
    def test_maintenance_depassee_et_alerte(self, api, admin, vehicule):
        r = api.post("/maintenances", headers=admin, json={"vehicule_id": vehicule["id"], "type": "vidange",
                                                            "date_prevue": "2020-01-01", "priorite": "urgente"})
        assert r.status_code == 201
        mid = r.json()["id"]
        liste = api.get("/maintenances", headers=admin, params={"vehicule_id": vehicule["id"]}).json()
        assert liste[0]["depassee"] is True
        assert mid in [m["id"] for m in api.get("/maintenances/alertes", headers=admin).json()]

        r = api.put(f"/maintenances/{mid}/terminer", headers=admin, json={"cout_reel": 50000})
        assert r.json()["statut"] == "terminee"
        assert r.json()["date_realisee"]
        assert mid not in [m["id"] for m in api.get("/maintenances/alertes", headers=admin).json()]

    def test_champs_obligatoires(self, api, admin):
        assert api.post("/maintenances", headers=admin, json={"type": "vidange"}).status_code == 400


def test_tableau_de_bord(api, admin):
    stats = api.get("/dashboard/stats", headers=admin).json()
    for cle in ("totalVehicules", "vehiculesDisponibles", "missionsEnCours", "coutTotalMois", "documentsExpires"):
        assert isinstance(stats[cle], int | float), cle
    assert isinstance(stats["missionsParSemaine"], list)
    assert isinstance(stats["dernieresAlertes"], list)
