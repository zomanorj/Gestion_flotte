"""Documents administratifs : statut d'expiration, upload, remplacement et suppression des fichiers."""
from datetime import date, timedelta

import pytest

PDF = ("assurance.pdf", b"%PDF-1.4 contenu", "application/pdf")


@pytest.fixture
def document(api, admin, vehicule):
    r = api.post("/documents", headers=admin, json={
        "vehicule_id": vehicule["id"], "type": "assurance", "numero": "ASS-1",
        "date_emission": "2026-01-01", "date_expiration": "2099-01-01",
    })
    assert r.status_code == 201, r.text
    return r.json()


def _upload(api, headers, doc_id, fichier=PDF):
    return api.post(f"/documents/{doc_id}/fichier", headers=headers, files={"fichier": fichier})


@pytest.mark.parametrize("decalage,statut", [(-1, "expire"), (10, "expire_bientot"), (60, "valide")])
def test_statut_calcule(api, admin, vehicule, decalage, statut):
    expiration = (date.today() + timedelta(days=decalage)).isoformat()
    r = api.post("/documents", headers=admin, json={
        "vehicule_id": vehicule["id"], "type": "vignette", "date_emission": "2020-01-01", "date_expiration": expiration,
    })
    assert r.json()["statut"] == statut
    alertes = [d["id"] for d in api.get("/documents/alertes", headers=admin).json()]
    assert (r.json()["id"] in alertes) == (statut != "valide")


def test_champs_obligatoires(api, admin):
    assert api.post("/documents", headers=admin, json={"type": "assurance"}).status_code == 400


def test_upload_et_telechargement(api, admin, chauffeur, document):
    r = _upload(api, admin, document["id"])
    assert r.status_code == 200
    url = r.json()["fichier_url"]
    assert url.startswith("/uploads/documents/")

    fichier = api.get(url, headers=chauffeur)
    assert fichier.content == PDF[1]
    assert fichier.headers["content-type"] == "application/pdf"
    assert "attachment" in fichier.headers["content-disposition"]
    assert fichier.headers["x-content-type-options"] == "nosniff"


def test_chemin_de_fichier_impose_par_le_client_ignore(api, admin, vehicule):
    r = api.post("/documents", headers=admin, json={
        "vehicule_id": vehicule["id"], "type": "assurance", "date_emission": "2026-01-01",
        "date_expiration": "2099-01-01", "fichier_url": "/uploads/documents/autre.pdf", "fichier_nom": "x",
    })
    assert r.json()["fichier_url"] is None and r.json()["fichier_nom"] is None


def test_modifier_un_document_conserve_son_fichier(api, admin, document):
    url = _upload(api, admin, document["id"]).json()["fichier_url"]
    r = api.put(f"/documents/{document['id']}", headers=admin, json={
        "vehicule_id": document["vehicule_id"], "type": "assurance",
        "date_emission": "2026-01-01", "date_expiration": "2099-06-01", "fichier_url": None,
    })
    assert r.json()["fichier_url"] == url
    assert api.get(url, headers=admin).status_code == 200


def test_remplacement_supprime_l_ancien_fichier(api, admin, document):
    ancien = _upload(api, admin, document["id"]).json()["fichier_url"]
    nouveau = _upload(api, admin, document["id"], ("v2.pdf", b"%PDF-v2", "application/pdf")).json()["fichier_url"]
    assert nouveau != ancien
    assert api.get(ancien, headers=admin).status_code == 404
    assert api.get(nouveau, headers=admin).content == b"%PDF-v2"


def test_suppression_du_document_supprime_le_fichier(api, admin, document):
    url = _upload(api, admin, document["id"]).json()["fichier_url"]
    assert api.delete(f"/documents/{document['id']}", headers=admin).status_code == 200
    assert api.get(url, headers=admin).status_code == 404


@pytest.mark.parametrize("nom", ["script.exe", "page.html", "image.svg", "sans_extension"])
def test_types_refuses(api, admin, document, nom):
    assert _upload(api, admin, document["id"], (nom, b"x", "application/octet-stream")).status_code == 400


def test_taille_maximale(api, admin, document):
    gros = ("gros.pdf", b"0" * (10 * 1024 * 1024 + 1), "application/pdf")
    assert _upload(api, admin, document["id"], gros).status_code == 413


def test_upload_sans_fichier_ou_document_inexistant(api, admin):
    assert api.post("/documents/1/fichier", headers=admin).status_code == 400
    assert _upload(api, admin, 999999).status_code == 404


@pytest.mark.parametrize("chemin", ["/uploads/..%2F..%2Fmain.py", "/uploads/documents/..%2F..%2F..%2Fmain.py",
                                    "/uploads/%2e%2e/main.py"])
def test_sortie_du_dossier_d_upload_impossible(api, admin, chemin):
    assert api.get(chemin, headers=admin).status_code == 404
