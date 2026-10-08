"""Missions : disponibilité des ressources, cycle de vie, concurrence, coûts et documents."""
import asyncio

import httpx
import pytest


def _statut(api, admin, ressource, id_):
    return api.get(f"/{ressource}/{id_}", headers=admin).json()["statut"]


class TestCreation:
    def test_creation(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        r = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2031-01-10T08:00", "2031-01-11T18:00")
        assert r.status_code == 201
        m = r.json()
        assert m["statut"] == "planifiee"
        assert m["immatriculation"] == vehicule["immatriculation"]
        assert m["date_depart"] == "2031-01-10T08:00:00"
        # Planifier ne bloque pas encore le camion : il reste disponible jusqu'au départ
        assert _statut(api, admin, "vehicules", vehicule["id"]) == "disponible"

    def test_champs_obligatoires(self, api, admin):
        assert api.post("/missions", headers=admin, json={"titre": "x"}).status_code == 400

    @pytest.mark.parametrize("debut,fin", [
        ("2031-02-10T08:00", "2031-02-09T08:00"),   # retour avant départ
        ("2031-02-10T08:00", "2031-02-10T08:00"),   # durée nulle
    ])
    def test_periode_invalide(self, vehicule, chauffeur_fiche, creer_mission, debut, fin):
        r = creer_mission(vehicule["id"], chauffeur_fiche["id"], debut, fin)
        assert r.status_code == 400

    def test_date_mal_formee(self, vehicule, chauffeur_fiche, creer_mission):
        r = creer_mission(vehicule["id"], chauffeur_fiche["id"], "demain", "2031-02-10T08:00")
        assert r.status_code == 400
        assert "date_depart" in r.json()["message"]

    def test_ressources_inexistantes(self, vehicule, chauffeur_fiche, creer_mission):
        assert creer_mission(999999, chauffeur_fiche["id"], "2031-03-01", "2031-03-02").status_code == 404
        assert creer_mission(vehicule["id"], 999999, "2031-03-01", "2031-03-02").status_code == 404

    def test_camion_en_panne(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        api.put(f"/vehicules/{vehicule['id']}", headers=admin, json={"statut": "en_panne"})
        r = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2031-03-01", "2031-03-02")
        assert r.status_code == 409
        assert "en_panne" in r.json()["message"]

    def test_chauffeur_en_conge(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        api.put(f"/chauffeurs/{chauffeur_fiche['id']}", headers=admin, json={"statut": "conge"})
        assert creer_mission(vehicule["id"], chauffeur_fiche["id"], "2031-03-01", "2031-03-02").status_code == 409


class TestChevauchements:
    @pytest.fixture
    def mission_existante(self, vehicule, chauffeur_fiche, creer_mission):
        r = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2031-05-10T08:00", "2031-05-12T18:00",
                          titre="Livraison existante")
        assert r.status_code == 201
        return r.json()

    @pytest.mark.parametrize("debut,fin", [
        ("2031-05-11T08:00", "2031-05-13T08:00"),   # chevauche la fin
        ("2031-05-09T08:00", "2031-05-10T09:00"),   # chevauche le début
        ("2031-05-10T12:00", "2031-05-11T12:00"),   # incluse
        ("2031-05-09T00:00", "2031-05-14T00:00"),   # englobante
    ])
    def test_meme_camion_refuse(self, mission_existante, fabrique_chauffeur, creer_mission, debut, fin):
        r = creer_mission(mission_existante["vehicule_id"], fabrique_chauffeur()["id"], debut, fin)
        assert r.status_code == 409
        assert "Livraison existante" in r.json()["message"]

    def test_meme_chauffeur_refuse(self, api, admin, mission_existante, creer_mission):
        autre = api.post("/vehicules", headers=admin, json={
            "immatriculation": f"AUTRE-{mission_existante['id']}", "marque": "a", "modele": "b", "annee": 2020}).json()
        r = creer_mission(autre["id"], mission_existante["chauffeur_id"], "2031-05-11T08:00", "2031-05-11T20:00")
        assert r.status_code == 409
        assert "chauffeur" in r.json()["message"]

    @pytest.mark.parametrize("debut,fin", [
        ("2031-05-12T18:00", "2031-05-13T18:00"),   # commence exactement à la fin
        ("2031-05-09T08:00", "2031-05-10T08:00"),   # finit exactement au début
        ("2031-06-01T08:00", "2031-06-02T08:00"),   # sans rapport
    ])
    def test_periodes_jointives_ou_disjointes_acceptees(self, mission_existante, creer_mission, debut, fin):
        r = creer_mission(mission_existante["vehicule_id"], mission_existante["chauffeur_id"], debut, fin)
        assert r.status_code == 201, r.text

    def test_mission_annulee_libere_le_creneau(self, api, admin, mission_existante, creer_mission):
        api.put(f"/missions/{mission_existante['id']}/statut", headers=admin, json={"statut": "annulee"})
        r = creer_mission(mission_existante["vehicule_id"], mission_existante["chauffeur_id"],
                          "2031-05-11T08:00", "2031-05-11T20:00")
        assert r.status_code == 201

    def test_mission_en_cours_en_retard_bloque_jusqu_a_maintenant(self, api, admin, vehicule, fabrique_chauffeur,
                                                                  creer_mission, sql):
        # Mission en cours dont le retour prévu est déjà passé : le camion n'est toujours pas rentré
        r = creer_mission(vehicule["id"], fabrique_chauffeur()["id"], "2020-01-01T08:00", "2020-01-02T08:00")
        api.put(f"/missions/{r.json()['id']}/statut", headers=admin, json={"statut": "en_cours"})
        r = creer_mission(vehicule["id"], fabrique_chauffeur()["id"], "2020-01-05T08:00", "2099-01-01T08:00")
        assert r.status_code == 409

    def test_creations_simultanees_un_seul_succes(self, serveur, admin, vehicule, fabrique_chauffeur):
        """Cinq requêtes parallèles sur le même créneau : le verrouillage n'en laisse passer qu'une."""
        chauffeurs = [fabrique_chauffeur()["id"] for _ in range(5)]

        async def lancer():
            async with httpx.AsyncClient(base_url=f"{serveur}/api", timeout=30) as client:
                return await asyncio.gather(*(
                    client.post("/missions", headers=admin, json={
                        "titre": "Concurrente", "vehicule_id": vehicule["id"], "chauffeur_id": c,
                        "lieu_depart": "Antananarivo", "lieu_destination": "Toamasina",
                        "date_depart": "2031-08-01T08:00", "date_retour_prevue": "2031-08-02T08:00",
                    })
                    for c in chauffeurs
                ))

        codes = sorted(r.status_code for r in asyncio.run(lancer()))
        assert codes == [201, 409, 409, 409, 409]


class TestCycleDeVie:
    @pytest.fixture
    def mission(self, vehicule, chauffeur_fiche, creer_mission):
        return creer_mission(vehicule["id"], chauffeur_fiche["id"], "2031-09-01T08:00", "2031-09-02T08:00",
                             distance_km=200).json()

    def _changer(self, api, admin, mission, statut):
        return api.put(f"/missions/{mission['id']}/statut", headers=admin, json={"statut": statut})

    def test_parcours_complet_et_ressources(self, api, admin, mission):
        assert self._changer(api, admin, mission, "en_cours").status_code == 200
        assert _statut(api, admin, "vehicules", mission["vehicule_id"]) == "en_mission"
        assert _statut(api, admin, "chauffeurs", mission["chauffeur_id"]) == "en_mission"

        r = self._changer(api, admin, mission, "terminee")
        assert r.status_code == 200
        # 200 km × 0,3 L/km × 5200 Ar
        assert r.json()["cout_carburant"] == pytest.approx(312000)
        assert r.json()["date_retour_reelle"]
        assert _statut(api, admin, "vehicules", mission["vehicule_id"]) == "disponible"
        assert _statut(api, admin, "chauffeurs", mission["chauffeur_id"]) == "disponible"

    @pytest.mark.parametrize("chemin", [["terminee"], ["en_cours", "en_cours"], ["annulee", "en_cours"],
                                        ["en_cours", "terminee", "annulee"]])
    def test_transitions_interdites(self, api, admin, mission, chemin):
        *etapes, interdite = chemin
        for statut in etapes:
            assert self._changer(api, admin, mission, statut).status_code == 200
        assert self._changer(api, admin, mission, interdite).status_code == 409

    def test_statut_invalide(self, api, admin, mission):
        assert self._changer(api, admin, mission, "planifiee").status_code == 400
        assert self._changer(api, admin, mission, None).status_code == 400

    def test_annulation_en_cours_libere_les_ressources(self, api, admin, mission):
        self._changer(api, admin, mission, "en_cours")
        self._changer(api, admin, mission, "annulee")
        assert _statut(api, admin, "vehicules", mission["vehicule_id"]) == "disponible"

    def test_statut_manuel_conserve_a_la_fin(self, api, admin, mission):
        """Un camion déclaré en panne pendant la mission reste en panne à la clôture."""
        self._changer(api, admin, mission, "en_cours")
        api.put(f"/vehicules/{mission['vehicule_id']}", headers=admin, json={"statut": "en_panne"})
        self._changer(api, admin, mission, "terminee")
        assert _statut(api, admin, "vehicules", mission["vehicule_id"]) == "en_panne"

    def test_depart_refuse_si_camion_en_panne(self, api, admin, mission):
        api.put(f"/vehicules/{mission['vehicule_id']}", headers=admin, json={"statut": "en_panne"})
        assert self._changer(api, admin, mission, "en_cours").status_code == 409
        # Rien n'a été modifié : la transaction a été annulée
        planifiees = api.get("/missions?statut=planifiee&debut=2031-09-01&fin=2031-09-01", headers=admin).json()
        assert mission["id"] in [m["id"] for m in planifiees]

    def test_suppression_d_une_mission_en_cours(self, api, admin, mission):
        self._changer(api, admin, mission, "en_cours")
        assert api.delete(f"/missions/{mission['id']}", headers=admin).status_code == 200
        assert _statut(api, admin, "vehicules", mission["vehicule_id"]) == "disponible"
        assert api.delete(f"/missions/{mission['id']}", headers=admin).status_code == 404


class TestLecture:
    def test_filtres_et_pagination(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        m = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2032-03-15T08:00", "2032-03-16T08:00").json()
        liste = api.get("/missions?statut=planifiee&debut=2032-03-01&fin=2032-03-31", headers=admin).json()
        assert [x["id"] for x in liste] == [m["id"]]
        page = api.get("/missions?paginate=true&limit=1&debut=2032-03-01&fin=2032-03-31", headers=admin).json()
        assert page["total"] == 1 and page["pages"] == 1 and len(page["data"]) == 1

    def test_planning(self, api, admin, vehicule, chauffeur_fiche, creer_mission):
        m = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2032-04-01T08:00", "2032-04-02T08:00").json()
        evenement = next(e for e in api.get("/missions/planning", headers=admin).json() if e["id"] == m["id"])
        assert evenement["color"] == "#f59e0b"
        assert evenement["title"].startswith(vehicule["immatriculation"])

    def test_bon_de_livraison(self, api, chauffeur, vehicule, chauffeur_fiche, creer_mission):
        m = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2032-05-01T08:00", "2032-05-02T08:00",
                          notes="Riz\n20 sacs").json()
        r = api.get(f"/missions/{m['id']}/bon-livraison", headers=chauffeur)
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content.startswith(b"%PDF")
        assert api.get("/missions/999999/bon-livraison", headers=chauffeur).status_code == 404
