"""Notifications : visibilité par destinataire et état lu / supprimé propre à chaque utilisateur."""
import pytest


@pytest.fixture
def notif_gestion(sql):
    """Notification destinée à l'équipe de gestion (user_id NULL)."""
    sql("INSERT INTO notifications (type, titre, message) VALUES ('test', 'Alerte gestion', 'm')")
    return sql("SELECT LAST_INSERT_ID() AS id")[0]["id"]


def _ids(api, headers, **params):
    return [n["id"] for n in api.get("/notifications", headers=headers, params=params).json()["notifications"]]


def _non_lues(api, headers):
    return api.get("/notifications", headers=headers).json()["non_lues"]


def test_gestion_voit_les_alertes_de_gestion(api, admin, gestionnaire, chauffeur, notif_gestion):
    assert notif_gestion in _ids(api, admin)
    assert notif_gestion in _ids(api, gestionnaire)
    assert notif_gestion not in _ids(api, chauffeur)


def test_notification_personnelle(api, admin, nouvel_utilisateur, sql):
    u = nouvel_utilisateur("chauffeur")
    sql("INSERT INTO notifications (type, titre, message, user_id) VALUES ('test', 'Pour toi', 'm', %s)", [u["id"]])
    nid = sql("SELECT LAST_INSERT_ID() AS id")[0]["id"]
    assert nid in _ids(api, u["headers"])
    assert nid not in _ids(api, admin)


def test_lecture_propre_a_chaque_utilisateur(api, admin, gestionnaire, notif_gestion):
    avant_admin, avant_gestionnaire = _non_lues(api, admin), _non_lues(api, gestionnaire)

    assert api.patch(f"/notifications/{notif_gestion}/read", headers=admin).status_code == 200

    assert _non_lues(api, admin) == avant_admin - 1
    assert _non_lues(api, gestionnaire) == avant_gestionnaire
    lue = next(n for n in api.get("/notifications", headers=admin).json()["notifications"] if n["id"] == notif_gestion)
    assert lue["est_lue"] is True
    assert notif_gestion not in _ids(api, admin, non_lues="true")


def test_lire_deux_fois_ne_change_rien(api, admin, notif_gestion):
    api.patch(f"/notifications/{notif_gestion}/read", headers=admin)
    avant = _non_lues(api, admin)
    api.patch(f"/notifications/{notif_gestion}/read", headers=admin)
    assert _non_lues(api, admin) == avant


def test_suppression_propre_a_chaque_utilisateur(api, admin, gestionnaire, notif_gestion):
    assert api.delete(f"/notifications/{notif_gestion}", headers=admin).status_code == 200
    assert notif_gestion not in _ids(api, admin)
    assert notif_gestion in _ids(api, gestionnaire)


def test_tout_marquer_lu(api, nouvel_utilisateur, notif_gestion):
    u = nouvel_utilisateur("gestionnaire")
    assert _non_lues(api, u["headers"]) > 0
    api.patch("/notifications/read-all", headers=u["headers"])
    assert _non_lues(api, u["headers"]) == 0


def test_chauffeur_ne_touche_pas_aux_alertes_de_gestion(api, admin, chauffeur, notif_gestion):
    assert api.patch(f"/notifications/{notif_gestion}/read", headers=chauffeur).status_code == 404
    assert api.delete(f"/notifications/{notif_gestion}", headers=chauffeur).status_code == 404
    assert notif_gestion in _ids(api, admin)


def test_notification_inexistante(api, admin):
    assert api.patch("/notifications/999999/read", headers=admin).status_code == 404
