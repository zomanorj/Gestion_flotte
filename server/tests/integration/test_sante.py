"""Comportements transverses : santé, format des erreurs, fuseau horaire, migrations."""


def test_sante(api):
    assert api.get("/health").json() == {"status": "OK", "message": "Serveur flotte opérationnel"}


def test_route_inconnue(api, admin):
    r = api.get("/nexiste-pas", headers=admin)
    assert r.status_code == 404
    assert r.json() == {"message": "Route introuvable"}


def test_parametre_invalide_au_format_api(api, admin):
    r = api.get("/vehicules/pas-un-nombre", headers=admin)
    assert r.status_code == 400
    assert "message" in r.json()


def test_session_mysql_au_fuseau_de_l_application(api, admin, vehicule, chauffeur_fiche, creer_mission):
    """date_retour_reelle = NOW() côté MySQL doit être l'heure de Madagascar, pas celle du serveur."""
    from datetime import datetime, timedelta

    from app.temps import maintenant

    m = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2020-03-01T08:00", "2020-03-01T20:00").json()
    for statut in ("en_cours", "terminee"):
        api.put(f"/missions/{m['id']}/statut", headers=admin, json={"statut": statut})
    terminees = api.get("/missions", headers=admin, params={"statut": "terminee"}).json()
    retour = datetime.fromisoformat(next(x for x in terminees if x["id"] == m["id"])["date_retour_reelle"])
    assert abs(retour - maintenant()) < timedelta(minutes=2)


def test_migrations_appliquees(sql):
    colonnes = {r["COLUMN_NAME"] for r in sql(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'")}
    assert {"is_active", "token_version"} <= colonnes
    assert sql("SHOW TABLES LIKE 'notification_etats'")
