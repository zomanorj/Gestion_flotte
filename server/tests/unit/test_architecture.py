"""
Règles de dépendance entre couches, vérifiées sur les imports réels du code.

    routers/       HTTP uniquement : schémas, services, dépendances d'authentification
    services/      règles métier : repositories, schémas, exceptions — jamais FastAPI
    repositories/  SQL uniquement : db — jamais services, schémas ni FastAPI

Un test qui échoue ici signale une fuite de responsabilité (SQL dans un router, HTTP dans un
service…), pas un problème de style.
"""
import ast
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[2] / "app"


def _modules(dossier: str) -> list[Path]:
    return sorted(p for p in (APP / dossier).glob("*.py") if p.name != "__init__.py")


def _imports(fichier: Path) -> set[str]:
    """Modules importés, en chemin absolu dans le paquet (ex. 'app.repositories.missions', 'fastapi')."""
    paquet = "app." + fichier.parent.name if fichier.parent != APP else "app"
    noms = set()
    for noeud in ast.walk(ast.parse(fichier.read_text())):
        if isinstance(noeud, ast.Import):
            noms.update(alias.name for alias in noeud.names)
        elif isinstance(noeud, ast.ImportFrom):
            if noeud.level:
                base = paquet.split(".")[: len(paquet.split(".")) - (noeud.level - 1)]
                module = ".".join(base + ([noeud.module] if noeud.module else []))
                noms.add(module)
                noms.update(f"{module}.{alias.name}" for alias in noeud.names)
            else:
                noms.add(noeud.module)
    return noms


def _ids(fichiers: list[Path]) -> list[str]:
    return [f"{f.parent.name}/{f.name}" for f in fichiers]


def _interdits(fichier: Path, prefixes: tuple[str, ...]) -> list[str]:
    """Imports du fichier qui tombent dans l'un des paquets interdits."""
    return sorted(i for i in _imports(fichier) if any(i == p or i.startswith(p + ".") for p in prefixes))


MOTS_SQL = ("SELECT ", "INSERT INTO", "UPDATE ", "DELETE FROM")


def _contient_du_sql(fichier: Path) -> bool:
    """Chaînes du code (pas les commentaires) contenant une instruction SQL."""
    return any(isinstance(n, ast.Constant) and isinstance(n.value, str) and any(m in n.value for m in MOTS_SQL)
               for n in ast.walk(ast.parse(fichier.read_text())))


ROUTERS, SERVICES, REPOSITORIES = _modules("routers"), _modules("services"), _modules("repositories")


@pytest.mark.parametrize("fichier", ROUTERS, ids=_ids(ROUTERS))
def test_un_router_ne_fait_pas_de_sql(fichier):
    assert _interdits(fichier, ("app.db", "app.repositories")) == []
    assert not _contient_du_sql(fichier)


@pytest.mark.parametrize("fichier", SERVICES, ids=_ids(SERVICES))
def test_un_service_ignore_http(fichier):
    assert _interdits(fichier, ("fastapi", "starlette", "app.routers", "app.utils")) == []


@pytest.mark.parametrize("fichier", REPOSITORIES, ids=_ids(REPOSITORIES))
def test_un_repository_ne_fait_que_du_sql(fichier):
    assert _interdits(fichier, ("fastapi", "starlette", "app.services", "app.schemas", "app.routers",
                                "app.socket", "app.exceptions")) == []


def test_les_services_ne_contiennent_pas_de_sql():
    """Le SQL est réservé aux repositories (les services composent des appels de repository)."""
    assert [f.name for f in SERVICES if _contient_du_sql(f)] == []


def test_l_analyse_des_imports_fonctionne():
    """Garde-fou du test lui-même : il doit bien voir les imports relatifs."""
    imports = _imports(APP / "services" / "missions.py")
    assert "app.repositories.missions" in imports
    assert "app.db" in imports
    assert _contient_du_sql(APP / "repositories" / "missions.py")


def test_seule_la_configuration_lit_l_environnement():
    """Toute variable d'environnement passe par app/config.py (validée au démarrage)."""
    fichiers = [f for f in APP.rglob("*.py") if f.name != "config.py"] + [APP.parent / "main.py"]
    lecteurs = []
    for fichier in fichiers:
        for noeud in ast.walk(ast.parse(fichier.read_text())):
            if isinstance(noeud, ast.Attribute) and isinstance(noeud.value, ast.Name) and noeud.value.id == "os" \
                    and noeud.attr in ("getenv", "environ"):
                lecteurs.append(str(fichier.relative_to(APP.parent)))
    assert lecteurs == []
