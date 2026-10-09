"""Contrat de l'API : documentation OpenAPI, format des erreurs, types des réponses, schémas complets."""
import pytest

from app.schemas import comptes, flotte, operations


class TestDocumentation:
    @pytest.fixture(scope="class")
    def spec(self, serveur):
        import httpx
        return httpx.get(f"{serveur}/openapi.json").json()

    def test_pages_de_documentation(self, serveur):
        import httpx
        assert httpx.get(f"{serveur}/docs").status_code == 200
        assert httpx.get(f"{serveur}/redoc").status_code == 200

    def test_chaque_reponse_json_est_decrite(self, spec):
        sans_modele = []
        for chemin, operations_ in spec["paths"].items():
            for methode, op in operations_.items():
                succes = op["responses"].get("200") or op["responses"].get("201")
                contenu = succes.get("content", {}).get("application/json")
                if contenu is not None and not contenu.get("schema"):
                    sans_modele.append(f"{methode.upper()} {chemin}")
        assert sans_modele == []

    def test_chaque_corps_de_requete_est_decrit(self, spec):
        for chemin, operations_ in spec["paths"].items():
            for methode, op in operations_.items():
                if methode in ("post", "put", "patch") and "requestBody" in op:
                    contenu = op["requestBody"]["content"]
                    schema = (contenu.get("application/json") or contenu.get("multipart/form-data"))["schema"]
                    assert schema, f"{methode.upper()} {chemin}"

    def test_erreurs_et_authentification_documentees(self, spec):
        op = spec["paths"]["/api/vehicules"]["post"]
        assert {"400", "401", "403", "409"} <= op["responses"].keys()
        assert "HTTPBearer" in spec["components"]["securitySchemes"]
        assert {"Véhicules", "Missions", "Paie"} <= {t["name"] for t in spec["tags"]}

    def test_valeurs_autorisees_exposees(self, spec):
        statut = spec["components"]["schemas"]["StatutVehicule"]
        assert statut["enum"] == ["disponible", "en_mission", "en_panne", "maintenance"]


class TestErreursDeValidation:
    def test_format_et_message_francais(self, api, admin):
        r = api.post("/vehicules", headers=admin, json={"immatriculation": "X", "marque": "a", "modele": "b",
                                                         "annee": "deux-mille", "statut": "vole"})
        assert r.status_code == 400
        corps = r.json()
        champs = {e["champ"]: e["message"] for e in corps["erreurs"]}
        assert champs["annee"] == "annee doit être un nombre entier"
        assert champs["statut"].startswith("Valeur invalide pour statut")
        assert corps["message"] in champs.values()

    def test_corps_absent(self, api, admin):
        r = api.post("/clients", headers=admin)
        assert r.status_code == 400
        assert r.json()["message"]

    def test_json_invalide(self, api, admin):
        r = api.post("/clients", headers={**admin, "Content-Type": "application/json"}, content=b"{pas du json")
        assert r.status_code == 400

    def test_parametre_de_filtre_vide_ignore(self, api, admin):
        # Le frontend envoie ?statut= pour "tous"
        assert api.get("/vehicules?statut=", headers=admin).status_code == 200
        assert api.get("/documents?vehicule_id=&type=", headers=admin).status_code == 200

    def test_parametre_de_filtre_invalide(self, api, admin):
        r = api.get("/vehicules?statut=vole", headers=admin)
        assert r.status_code == 400
        assert r.json()["message"].startswith("Valeur invalide pour statut")

    @pytest.mark.parametrize("chemin", ["/paie/2026/13", "/paie/2026/0", "/paie/1800/1"])
    def test_periode_de_paie_invalide(self, api, admin, chemin):
        assert api.get(chemin, headers=admin).status_code == 400


class TestTypesDesReponses:
    def test_compteurs_entiers(self, api, admin):
        stats = api.get("/dashboard/stats", headers=admin).json()
        for cle in ("totalVehicules", "vehiculesDisponibles", "missionsPlanifiees", "documentsExpires"):
            assert type(stats[cle]) is int, cle

    def test_booleens(self, api, admin):
        assert all(type(u["is_active"]) is bool for u in api.get("/users", headers=admin).json())

    def test_pas_de_champ_inexistant_ajoute(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        """Un résumé de mission ne contient pas les jointures que l'endpoint ne fournit pas."""
        m = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2035-01-01T08:00", "2035-01-02T08:00").json()
        assert "chauffeur_tel" not in m and "modele" not in m
        assert m["immatriculation"] == vehicule["immatriculation"]


class TestCorrectionsDeComportement:
    def test_client_de_la_mission_enregistre(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        client = api.post("/clients", headers=admin, json={"nom": "Client mission"}).json()
        m = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2035-02-01T08:00", "2035-02-02T08:00",
                          client_id=client["id"]).json()
        assert m["client_id"] == client["id"]
        missions = api.get(f"/clients/{client['id']}/missions", headers=admin).json()["missions"]
        assert [x["id"] for x in missions] == [m["id"]]

    def test_client_inexistant_refuse(self, vehicule, chauffeur_fiche, creer_mission):
        r = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2035-03-01T08:00", "2035-03-02T08:00",
                          client_id=999999)
        assert r.status_code == 404

    def test_modifier_une_maintenance_terminee_conserve_statut_et_notes(self, api, admin, vehicule):
        m = api.post("/maintenances", headers=admin, json={"vehicule_id": vehicule["id"], "type": "freins"}).json()
        api.put(f"/maintenances/{m['id']}/terminer", headers=admin, json={"notes": "Plaquettes changées"})
        # Le formulaire d'édition n'envoie ni statut ni notes
        r = api.put(f"/maintenances/{m['id']}", headers=admin, json={
            "vehicule_id": vehicule["id"], "type": "freins", "description": "", "kilometrage_declencheur": "",
            "date_prevue": "", "cout_estime": "", "garage": "Garage Tana", "priorite": "haute"})
        assert r.status_code == 200
        assert (r.json()["statut"], r.json()["notes"], r.json()["garage"]) == ("terminee", "Plaquettes changées",
                                                                               "Garage Tana")

    def test_fiche_client_complete_conservee(self, api, admin):
        c = api.post("/clients", headers=admin, json={"nom": "Fiche", "nif": "123", "limite_credit": 500000}).json()
        r = api.put(f"/clients/{c['id']}", headers=admin, json={"nom": "Fiche renommée", "ville": "Tana"}).json()
        assert (r["nif"], r["limite_credit"], r["nom"]) == ("123", 500000, "Fiche renommée")

    def test_effacer_une_date_facultative(self, api, admin, vehicule):
        api.put(f"/vehicules/{vehicule['id']}", headers=admin, json={"date_prochain_ct": "2030-01-01"})
        r = api.put(f"/vehicules/{vehicule['id']}", headers=admin, json={"date_prochain_ct": ""})
        assert r.json()["date_prochain_ct"] is None

    def test_reference_inexistante_refusee(self, api, admin):
        r = api.post("/carburant", headers=admin, json={"vehicule_id": 999999, "date_plein": "2026-01-01",
                                                         "litres": 10, "prix_litre": 5000})
        assert r.status_code == 404

    def test_immatriculation_unique_aussi_en_modification(self, api, admin, vehicule):
        autre = api.post("/vehicules", headers=admin, json={"immatriculation": "UNIQ-2", "marque": "a",
                                                             "modele": "b", "annee": 2020}).json()
        r = api.put(f"/vehicules/{autre['id']}", headers=admin, json={"immatriculation": vehicule["immatriculation"]})
        assert r.status_code == 409


# Chaque table exposée par l'API et le schéma qui la décrit. Hors tests (mode non strict), une
# colonne absente du schéma disparaîtrait silencieusement des réponses : ce test l'empêche.
TABLES_ET_SCHEMAS = [
    ("vehicules", flotte.Vehicule),
    ("chauffeurs", flotte.Chauffeur),
    ("missions", flotte.Mission),
    ("maintenances", flotte.MaintenanceHistorique),
    ("documents", operations.Document),
    ("carburant", operations.Plein),
    ("depenses", operations.Depense),
    ("maintenances_planifiees", operations.Maintenance),
    ("clients", operations.Client),
]


@pytest.mark.parametrize("table,schema", TABLES_ET_SCHEMAS, ids=[t for t, _ in TABLES_ET_SCHEMAS])
def test_schema_couvre_toutes_les_colonnes(sql, table, schema):
    colonnes = {r["COLUMN_NAME"] for r in sql(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s",
        [table])}
    assert colonnes, table
    assert colonnes - set(schema.model_fields) == set()


def test_utilisateur_n_expose_aucune_donnee_sensible():
    assert not {"password_hash", "token_version"} & set(comptes.Utilisateur.model_fields)
