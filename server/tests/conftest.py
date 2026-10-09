"""
Fixtures partagées.

Les tests d'intégration testent l'API comme un client réel :
- une base MySQL vide est créée pour la session ;
- l'API est lancée dans un sous-processus uvicorn : au démarrage, elle crée le schéma avec les
  migrations Alembic et charge les données de démonstration (SEED_DEMO=1) — chaque exécution de
  la suite valide donc aussi les migrations ;
- les tests l'appellent en HTTP et en Socket.io.

MySQL de test : variables TEST_MYSQL_HOST / TEST_MYSQL_PORT / TEST_MYSQL_USER / TEST_MYSQL_PASSWORD
(défaut : 127.0.0.1:3307, root / test). Voir tests/README.md pour lancer un MySQL local avec Docker.
"""
import os
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx
import pymysql
import pytest

RACINE_SERVEUR = Path(__file__).resolve().parents[1]

MOT_DE_PASSE_DEMO = "password123"
JWT_SECRET_TEST = "secret-de-test-uniquement"

# Les modules de l'application lisent leur configuration dès l'import (app/config.py) : les tests
# unitaires doivent pouvoir les importer sans environnement préparé (CI, poste de développement).
if not os.environ.get("JWT_SECRET"):
    os.environ["JWT_SECRET"] = JWT_SECRET_TEST


def pytest_collection_modifyitems(items):
    for item in items:
        if "integration" in item.path.parts:
            item.add_marker(pytest.mark.integration)


# ── Base de données de test ────────────────────────────────────────────────────

def _config_mysql() -> dict:
    return {
        "host":     os.getenv("TEST_MYSQL_HOST", "127.0.0.1"),
        "port":     int(os.getenv("TEST_MYSQL_PORT", "3307")),
        "user":     os.getenv("TEST_MYSQL_USER", "root"),
        "password": os.getenv("TEST_MYSQL_PASSWORD", "test"),
    }


@pytest.fixture(scope="session")
def base_de_test():
    """Crée une base vide (l'API la construit au démarrage), puis la supprime en fin de session."""
    config = _config_mysql()
    nom = f"flotte_test_{uuid.uuid4().hex[:8]}"
    try:
        admin = pymysql.connect(**config, autocommit=True)
    except pymysql.err.OperationalError as err:
        pytest.exit(
            f"MySQL de test injoignable sur {config['host']}:{config['port']} ({err}). "
            "Voir server/tests/README.md.",
            returncode=2,
        )
    with admin.cursor() as cur:
        cur.execute(f"CREATE DATABASE `{nom}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")

    yield {**config, "database": nom}

    with admin.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS `{nom}`")
    admin.close()


@pytest.fixture(scope="session")
def sql(base_de_test):
    """Accès SQL direct à la base de test, pour préparer ou vérifier un état précis."""
    conn = pymysql.connect(**base_de_test, autocommit=True, cursorclass=pymysql.cursors.DictCursor)

    def executer(requete: str, params=None) -> list[dict]:
        with conn.cursor() as cur:
            cur.execute(requete, params)
            return list(cur.fetchall())

    yield executer
    conn.close()


# ── API lancée dans un sous-processus ──────────────────────────────────────────

def _port_libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def serveur(base_de_test, tmp_path_factory):
    """Démarre l'API sur un port libre et retourne son URL de base (sans /api)."""
    port = _port_libre()
    journal = tmp_path_factory.mktemp("serveur") / "uvicorn.log"
    env = {
        **os.environ,
        "DB_HOST": base_de_test["host"],
        "DB_PORT": str(base_de_test["port"]),
        "DB_USER": base_de_test["user"],
        "DB_PASSWORD": base_de_test["password"],
        "DB_NAME": base_de_test["database"],
        "JWT_SECRET": JWT_SECRET_TEST,
        "CLIENT_URL": "http://client-de-test",
        "APP_TIMEZONE": "Indian/Antananarivo",
        "STOCKAGE": "local",
        "UPLOADS_DIR": str(tmp_path_factory.mktemp("uploads")),
        # OSRM injoignable : l'API utilise immédiatement le tracé de secours (aucun accès réseau)
        "OSRM_URL": "http://127.0.0.1:9/route/v1/driving",
        # Modèles de réponse stricts : une colonne SQL absente d'un schéma fait échouer le test
        "API_SCHEMAS_STRICTS": "1",
        # Comptes et données de démonstration chargés sur la base vide
        "SEED_DEMO": "1",
        "ADMIN_EMAIL": "",
        "ADMIN_PASSWORD": "",
    }
    env.pop("MYSQL_URL", None)

    with journal.open("w") as sortie:
        processus = subprocess.Popen(
            # --proxy-headers comme en production : les tests simulent des IP clientes distinctes
            # avec X-Forwarded-For (uvicorn fait confiance à 127.0.0.1 par défaut)
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port),
             "--proxy-headers"],
            cwd=RACINE_SERVEUR, env=env, stdout=sortie, stderr=subprocess.STDOUT,
        )
    url = f"http://127.0.0.1:{port}"

    limite = time.monotonic() + 60
    while True:
        if processus.poll() is not None:
            pytest.exit(f"L'API n'a pas démarré :\n{journal.read_text()[-3000:]}", returncode=2)
        try:
            if httpx.get(f"{url}/api/health", timeout=1).status_code == 200:
                break
        except httpx.HTTPError:
            pass
        if time.monotonic() > limite:
            processus.kill()
            pytest.exit(f"L'API n'a pas répondu à temps :\n{journal.read_text()[-3000:]}", returncode=2)
        time.sleep(0.3)

    yield url

    processus.terminate()
    try:
        processus.wait(timeout=10)
    except subprocess.TimeoutExpired:
        processus.kill()


@pytest.fixture(scope="session")
def api(serveur):
    """Client HTTP sur /api (sans authentification)."""
    with httpx.Client(base_url=f"{serveur}/api", timeout=30) as client:
        yield client


# ── Comptes ────────────────────────────────────────────────────────────────────

def ip_unique() -> str:
    """Adresse IP cliente fictive, pour isoler un test du compteur anti force brute par IP."""
    n = uuid.uuid4().int
    return f"10.{n % 250}.{(n >> 8) % 250}.{(n >> 16) % 250 + 1}"


def login(api, email: str, password: str, ip: str | None = None) -> httpx.Response:
    return api.post("/auth/login", json={"email": email, "password": password},
                    headers={"X-Forwarded-For": ip or ip_unique()})


def connecter(api, email: str, password: str = MOT_DE_PASSE_DEMO) -> dict:
    """Retourne les en-têtes d'authentification d'un compte (échoue clairement sinon)."""
    r = login(api, email, password)
    assert r.status_code == 200, f"login {email} : {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def admin(api):
    return connecter(api, "admin@flotte.mg")


@pytest.fixture(scope="session")
def gestionnaire(api):
    return connecter(api, "gestionnaire@flotte.mg")


@pytest.fixture(scope="session")
def chauffeur(api):
    return connecter(api, "chauffeur@flotte.mg")


def unique(prefixe: str = "t") -> str:
    """Identifiant court et unique, pour que les tests ne dépendent pas les uns des autres."""
    return f"{prefixe}{uuid.uuid4().hex[:8]}"


@pytest.fixture
def nouvel_utilisateur(api, admin):
    """Fabrique de comptes jetables : (id, email, mot de passe, en-têtes)."""

    def creer(role: str = "gestionnaire", password: str = "motdepasse1") -> dict:
        email = f"{unique('u')}@test.mg"
        r = api.post("/users", headers=admin, json={"nom": "Test", "email": email, "password": password, "role": role})
        assert r.status_code == 201, r.text
        return {"id": r.json()["id"], "email": email, "password": password,
                "headers": connecter(api, email, password)}

    return creer


# ── Données métier ─────────────────────────────────────────────────────────────

@pytest.fixture
def vehicule(api, admin):
    r = api.post("/vehicules", headers=admin, json={
        "immatriculation": unique("V-").upper(), "marque": "Isuzu", "modele": "FVR", "annee": 2022,
        "consommation_litre_km": 0.3,
    })
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def fabrique_chauffeur(api, admin):
    def creer(user_id: int | None = None) -> dict:
        r = api.post("/chauffeurs", headers=admin, json={
            "nom": "Rabe", "prenom": "Test", "telephone": "034 00 000 00",
            "numero_permis": unique("P-"), "categorie_permis": "C", "user_id": user_id,
        })
        assert r.status_code == 201, r.text
        return r.json()

    return creer


@pytest.fixture
def chauffeur_fiche(fabrique_chauffeur):
    return fabrique_chauffeur()


@pytest.fixture
def creer_mission(api, admin):
    def creer(vehicule_id: int, chauffeur_id: int, debut: str, fin: str, **extra) -> httpx.Response:
        return api.post("/missions", headers=admin, json={
            "titre": extra.pop("titre", unique("Mission ")),
            "vehicule_id": vehicule_id, "chauffeur_id": chauffeur_id,
            "lieu_depart": extra.pop("lieu_depart", "Antananarivo"),
            "lieu_destination": extra.pop("lieu_destination", "Moramanga"),
            "distance_km": extra.pop("distance_km", 100),
            "date_depart": debut, "date_retour_prevue": fin, **extra,
        })

    return creer
