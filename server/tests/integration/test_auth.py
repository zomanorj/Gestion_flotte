"""Authentification : login, révocation des sessions, comptes désactivés, force brute."""
from tests.conftest import connecter, ip_unique, login


class TestLogin:
    def test_succes_sans_donnees_sensibles(self, api):
        r = login(api, "admin@flotte.mg", "password123")
        assert r.status_code == 200
        corps = r.json()
        assert corps["token"]
        assert corps["user"]["role"] == "admin"
        assert not {"password_hash", "token_version"} & corps["user"].keys()

    def test_email_insensible_a_la_casse(self, api):
        assert login(api, "  Admin@Flotte.MG ", "password123").status_code == 200

    def test_mauvais_mot_de_passe(self, api):
        r = login(api, "admin@flotte.mg", "mauvais")
        assert r.status_code == 401
        assert r.json() == {"message": "Identifiants incorrects"}

    def test_email_inconnu_meme_reponse(self, api):
        # Même code et même message : on ne révèle pas si le compte existe
        r = login(api, "inconnu@flotte.mg", "x")
        assert r.status_code == 401
        assert r.json() == {"message": "Identifiants incorrects"}

    def test_champs_manquants(self, api):
        r = api.post("/auth/login", json={})
        assert r.status_code == 400
        assert "message" in r.json()

    def test_types_invalides(self, api):
        assert api.post("/auth/login", json={"email": ["a"], "password": 1}).status_code == 400

    def test_me(self, api, admin):
        assert api.get("/auth/me", headers=admin).json()["email"] == "admin@flotte.mg"


class TestToken:
    def test_sans_token(self, api):
        r = api.get("/vehicules")
        assert r.status_code == 401
        assert r.json() == {"message": "Token manquant ou mal formaté"}

    def test_token_invalide(self, api):
        r = api.get("/vehicules", headers={"Authorization": "Bearer abc"})
        assert r.json() == {"message": "Token invalide"}

    def test_token_signe_avec_un_autre_secret(self, api):
        import jwt
        faux = jwt.encode({"id": 1, "role": "admin", "tv": 0}, "autre-secret", algorithm="HS256")
        assert api.get("/auth/me", headers={"Authorization": f"Bearer {faux}"}).status_code == 401

    def test_token_expire(self, api):
        import jwt

        from tests.conftest import JWT_SECRET_TEST
        expire = jwt.encode({"id": 1, "role": "admin", "tv": 0, "exp": 1}, JWT_SECRET_TEST, algorithm="HS256")
        r = api.get("/auth/me", headers={"Authorization": f"Bearer {expire}"})
        assert r.json() == {"message": "Session expirée, veuillez vous reconnecter"}


class TestRevocation:
    def test_desactivation_coupe_l_acces_immediatement(self, api, admin, nouvel_utilisateur):
        u = nouvel_utilisateur()
        assert api.get("/auth/me", headers=u["headers"]).status_code == 200

        assert api.delete(f"/users/{u['id']}", headers=admin).status_code == 200

        assert api.get("/auth/me", headers=u["headers"]).status_code == 401
        r = login(api, u["email"], u["password"])
        assert r.status_code == 403
        assert "désactivé" in r.json()["message"]

    def test_compte_desactive_hors_api_refuse(self, api, nouvel_utilisateur, sql):
        """Désactivation directe en base (sans révocation des tokens) : le token doit être refusé quand même."""
        u = nouvel_utilisateur()
        sql("UPDATE users SET is_active = 0 WHERE id = %s", [u["id"]])
        r = api.get("/auth/me", headers=u["headers"])
        assert r.status_code == 401
        assert r.json() == {"message": "Compte désactivé ou supprimé"}

    def test_compte_supprime_en_base_refuse(self, api, nouvel_utilisateur, sql):
        u = nouvel_utilisateur()
        sql("DELETE FROM users WHERE id = %s", [u["id"]])
        assert api.get("/auth/me", headers=u["headers"]).status_code == 401

    def test_reactivation(self, api, admin, nouvel_utilisateur):
        u = nouvel_utilisateur()
        api.put(f"/users/{u['id']}", headers=admin, json={"is_active": False})
        api.put(f"/users/{u['id']}", headers=admin, json={"is_active": True})
        assert login(api, u["email"], u["password"]).status_code == 200

    def test_changement_de_role_revoque_les_tokens(self, api, admin, nouvel_utilisateur):
        u = nouvel_utilisateur("gestionnaire")
        api.put(f"/users/{u['id']}", headers=admin, json={"role": "chauffeur"})
        assert api.get("/auth/me", headers=u["headers"]).status_code == 401
        # Le nouveau token porte le nouveau rôle : plus de droits de gestion
        nouveau = connecter(api, u["email"], u["password"])
        assert api.post("/vehicules", headers=nouveau, json={}).status_code == 403

    def test_modification_sans_changement_de_role_garde_la_session(self, api, admin, nouvel_utilisateur):
        u = nouvel_utilisateur()
        api.put(f"/users/{u['id']}", headers=admin, json={"nom": "Renommé"})
        assert api.get("/auth/me", headers=u["headers"]).status_code == 200

    def test_changement_de_son_mot_de_passe(self, api, nouvel_utilisateur):
        u = nouvel_utilisateur("chauffeur")
        r = api.patch(f"/users/{u['id']}/password", headers=u["headers"],
                      json={"password": "nouveaumdp1", "password_actuel": u["password"]})
        assert r.status_code == 200
        assert api.get("/auth/me", headers=u["headers"]).status_code == 401
        assert api.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"}).status_code == 200
        assert login(api, u["email"], "nouveaumdp1").status_code == 200

    def test_mot_de_passe_actuel_exige_pour_un_non_admin(self, api, nouvel_utilisateur):
        u = nouvel_utilisateur("chauffeur")
        r = api.patch(f"/users/{u['id']}/password", headers=u["headers"], json={"password": "nouveaumdp1"})
        assert r.status_code == 400
        r = api.patch(f"/users/{u['id']}/password", headers=u["headers"],
                      json={"password": "nouveaumdp1", "password_actuel": "faux"})
        assert r.status_code == 401

    def test_reinitialisation_par_l_admin(self, api, admin, nouvel_utilisateur):
        u = nouvel_utilisateur()
        r = api.patch(f"/users/{u['id']}/password", headers=admin, json={"password": "parladmin1"})
        assert r.status_code == 200
        assert "token" not in r.json()  # le token renvoyé est réservé au propriétaire du compte
        assert api.get("/auth/me", headers=u["headers"]).status_code == 401
        assert login(api, u["email"], "parladmin1").status_code == 200


class TestForceBrute:
    def test_compte_bloque_apres_5_echecs(self, api, nouvel_utilisateur):
        u = nouvel_utilisateur()
        statuts = [login(api, u["email"], f"faux{i}").status_code for i in range(5)]
        assert statuts == [401] * 5

        r = login(api, u["email"], u["password"])  # même le bon mot de passe pendant le blocage
        assert r.status_code == 429
        assert int(r.headers["Retry-After"]) > 0

    def test_blocage_limite_au_compte_vise(self, api, nouvel_utilisateur):
        victime, autre = nouvel_utilisateur(), nouvel_utilisateur()
        for i in range(5):
            login(api, victime["email"], f"faux{i}")
        assert login(api, autre["email"], autre["password"]).status_code == 200

    def test_ip_bloquee_apres_20_echecs(self, api, nouvel_utilisateur):
        ip = ip_unique()
        for i in range(20):
            login(api, f"inexistant{i}@test.mg", "x", ip=ip)
        u = nouvel_utilisateur()
        assert login(api, u["email"], u["password"], ip=ip).status_code == 429
        assert login(api, u["email"], u["password"]).status_code == 200  # autre IP

    def test_succes_remet_le_compteur_a_zero(self, api, nouvel_utilisateur):
        u = nouvel_utilisateur()
        for i in range(4):
            login(api, u["email"], f"faux{i}")
        assert login(api, u["email"], u["password"]).status_code == 200
        for i in range(4):
            login(api, u["email"], f"faux{i}")
        assert login(api, u["email"], u["password"]).status_code == 200
