# Tests du backend

```
tests/
├── unit/          Sans base ni réseau (< 2 s) : règles métier, services avec repositories simulés,
│                  schémas, sécurité, et règles d'architecture entre couches
└── integration/   L'API complète, appelée en HTTP et en Socket.io
```

`unit/test_architecture.py` analyse les imports du code : un router qui importe `db` ou un
repository, un service qui importe FastAPI, ou du SQL hors des repositories fait échouer la CI.

Les tests d'intégration créent une base MySQL jetable, y exécutent les scripts du dépôt
(`database/schema.sql`, migrations, `seed_demo.sql`), lancent l'API dans un sous-processus,
puis suppriment la base. Aucun accès Internet n'est nécessaire (OSRM est désactivé : l'API
utilise son tracé de secours).

## Lancer les tests en local

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt

# MySQL de test (en mémoire, jetable) sur le port 3307
docker run -d --name flotte-test-db -e MYSQL_ROOT_PASSWORD=test -p 3307:3306 --tmpfs /var/lib/mysql mysql:8.0

.venv/bin/pytest                       # toute la suite
.venv/bin/pytest tests/unit            # tests unitaires seulement (sans MySQL)
.venv/bin/pytest -k chevauchement      # un sous-ensemble par mot-clé
.venv/bin/ruff check .                 # lint
```

Variables optionnelles : `TEST_MYSQL_HOST`, `TEST_MYSQL_PORT`, `TEST_MYSQL_USER`, `TEST_MYSQL_PASSWORD`
(défaut : `127.0.0.1:3307`, `root` / `test`).

## Écrire un test

- Chaque test crée ses propres données via les fixtures (`vehicule`, `fabrique_chauffeur`, `creer_mission`,
  `nouvel_utilisateur`…) et des identifiants uniques (`unique()`) : les tests sont indépendants et leur
  ordre n'a pas d'importance.
- Les comptes de démo sont disponibles via les fixtures `admin`, `gestionnaire`, `chauffeur`.
- La fixture `sql` donne un accès direct à la base pour préparer un état impossible à obtenir par l'API.
- Un test qui provoque volontairement des échecs de connexion doit utiliser son propre compte
  (`nouvel_utilisateur`) : les helpers `login` / `connecter` simulent déjà une IP distincte par appel.
