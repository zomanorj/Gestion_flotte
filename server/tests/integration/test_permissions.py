"""Contrôle d'accès : authentification obligatoire, droits par rôle, données confidentielles."""
import pytest

# Toutes les lectures exigent un token (aucune donnée publique)
LECTURES = [
    "/vehicules", "/vehicules/alertes", "/chauffeurs", "/missions", "/missions/planning",
    "/dashboard/stats", "/documents", "/documents/alertes", "/carburant", "/carburant/stats",
    "/depenses", "/depenses/stats", "/maintenances", "/maintenances/alertes", "/clients",
    "/clients/1/missions", "/notifications", "/missions/miennes", "/auth/me",
]

# Écritures réservées à la gestion (admin + gestionnaire)
ECRITURES_GESTION = [
    ("post", "/vehicules"), ("put", "/vehicules/1"), ("post", "/chauffeurs"), ("put", "/chauffeurs/1"),
    ("post", "/missions"), ("put", "/missions/1/statut"), ("post", "/documents"), ("put", "/documents/1"),
    ("post", "/carburant"), ("put", "/carburant/1"), ("post", "/depenses"), ("put", "/depenses/1"),
    ("post", "/maintenances"), ("put", "/maintenances/1"), ("put", "/maintenances/1/terminer"),
    ("post", "/clients"), ("put", "/clients/1"),
    ("get", "/paie/2026/1"), ("get", "/paie/chauffeur/1/2026/1"), ("patch", "/paie/chauffeur/1/salaire"),
]

# Suppressions et gestion des comptes réservées à l'admin
ACTIONS_ADMIN = [
    ("delete", "/vehicules/1"), ("delete", "/chauffeurs/1"), ("delete", "/missions/1"),
    ("delete", "/documents/1"), ("delete", "/carburant/1"), ("delete", "/depenses/1"),
    ("delete", "/maintenances/1"), ("delete", "/clients/1"),
    ("get", "/users"), ("post", "/users"), ("put", "/users/1"), ("delete", "/users/1"),
]


def _appel(api, methode, chemin, headers=None):
    kwargs = {"headers": headers or {}}
    if methode in ("post", "put", "patch"):
        kwargs["json"] = {}
    return getattr(api, methode)(chemin, **kwargs)


@pytest.mark.parametrize("chemin", LECTURES)
def test_lecture_sans_token_refusee(api, chemin):
    assert api.get(chemin).status_code == 401


@pytest.mark.parametrize("chemin", LECTURES)
def test_lecture_autorisee_au_chauffeur(api, chauffeur, chemin):
    assert api.get(chemin, headers=chauffeur).status_code == 200


@pytest.mark.parametrize("methode,chemin", ECRITURES_GESTION + ACTIONS_ADMIN)
def test_ecritures_interdites_au_chauffeur(api, chauffeur, methode, chemin):
    assert _appel(api, methode, chemin, chauffeur).status_code == 403


@pytest.mark.parametrize("methode,chemin", ACTIONS_ADMIN)
def test_actions_admin_interdites_au_gestionnaire(api, gestionnaire, methode, chemin):
    assert _appel(api, methode, chemin, gestionnaire).status_code == 403


def test_fichiers_uploades_sans_token(api):
    assert api.get("/uploads/documents/x.pdf").status_code == 401


class TestBulletinDePaie:
    def test_chauffeur_telecharge_son_bulletin(self, api, chauffeur, sql):
        mien = sql("SELECT c.id FROM chauffeurs c JOIN users u ON u.id = c.user_id "
                   "WHERE u.email = 'chauffeur@flotte.mg'")[0]["id"]
        r = api.get(f"/paie/chauffeur/{mien}/2026/1/pdf", headers=chauffeur)
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")

    def test_chauffeur_ne_telecharge_pas_le_bulletin_d_un_autre(self, api, chauffeur, chauffeur_fiche):
        r = api.get(f"/paie/chauffeur/{chauffeur_fiche['id']}/2026/1/pdf", headers=chauffeur)
        assert r.status_code == 403

    def test_chauffeur_inexistant_meme_reponse(self, api, chauffeur):
        # 403 et non 404 : on ne révèle pas quels identifiants existent
        assert api.get("/paie/chauffeur/999999/2026/1/pdf", headers=chauffeur).status_code == 403

    def test_gestion_telecharge_tous_les_bulletins(self, api, gestionnaire, chauffeur_fiche):
        r = api.get(f"/paie/chauffeur/{chauffeur_fiche['id']}/2026/1/pdf", headers=gestionnaire)
        assert r.status_code == 200


class TestSalairesConfidentiels:
    def test_salaires_des_autres_masques_pour_un_chauffeur(self, api, chauffeur, chauffeur_fiche):
        liste = api.get("/chauffeurs", headers=chauffeur).json()
        autre = next(c for c in liste if c["id"] == chauffeur_fiche["id"])
        assert "salaire_base" not in autre and "prime_mission" not in autre
        assert "salaire_base" not in api.get(f"/chauffeurs/{chauffeur_fiche['id']}", headers=chauffeur).json()

    def test_chauffeur_voit_son_propre_salaire(self, api, fabrique_chauffeur, nouvel_utilisateur):
        u = nouvel_utilisateur("chauffeur")
        fiche = fabrique_chauffeur(user_id=u["id"])
        assert "salaire_base" in api.get(f"/chauffeurs/{fiche['id']}", headers=u["headers"]).json()

    def test_salaires_visibles_par_la_gestion(self, api, gestionnaire, chauffeur_fiche):
        assert "salaire_base" in api.get(f"/chauffeurs/{chauffeur_fiche['id']}", headers=gestionnaire).json()

    def test_masquage_aussi_en_pagination(self, api, chauffeur, sql):
        moi = sql("SELECT id FROM users WHERE email = 'chauffeur@flotte.mg'")[0]["id"]
        page = api.get("/chauffeurs?paginate=true&limit=200", headers=chauffeur).json()
        for fiche in page["data"]:
            assert ("salaire_base" in fiche) == (fiche["user_id"] == moi)


class TestComptes:
    def test_un_utilisateur_ne_change_pas_le_mot_de_passe_d_un_autre(self, api, nouvel_utilisateur):
        u = nouvel_utilisateur("chauffeur")
        assert api.patch("/users/1/password", headers=u["headers"], json={"password": "piratage12"}).status_code == 403

    def test_admin_ne_se_retrograde_pas(self, api, admin):
        moi = api.get("/auth/me", headers=admin).json()["id"]
        assert api.put(f"/users/{moi}", headers=admin, json={"role": "gestionnaire"}).status_code == 403
        assert api.put(f"/users/{moi}", headers=admin, json={"is_active": False}).status_code == 403
        assert api.delete(f"/users/{moi}", headers=admin).status_code == 403

    def test_role_invalide(self, api, admin, nouvel_utilisateur):
        u = nouvel_utilisateur()
        assert api.put(f"/users/{u['id']}", headers=admin, json={"role": "superadmin"}).status_code == 400

    @pytest.mark.parametrize("password", ["", "1234567", None])
    def test_mot_de_passe_trop_court(self, api, admin, password):
        r = api.post("/users", headers=admin, json={"nom": "x", "email": "court@test.mg", "password": password,
                                                    "role": "chauffeur"})
        assert r.status_code == 400

    def test_email_en_double(self, api, admin):
        r = api.post("/users", headers=admin, json={"nom": "x", "email": "ADMIN@flotte.mg", "password": "motdepasse1",
                                                    "role": "chauffeur"})
        assert r.status_code == 409
