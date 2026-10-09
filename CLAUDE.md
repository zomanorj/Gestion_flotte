# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FlotteApp: a full-stack app for managing a transport fleet in Madagascar (vehicles, drivers, missions, live GPS simulation, fuel, expenses, maintenance, documents, payroll). The code, comments, identifiers, API routes and DB columns are in **French** (`vehicules`, `chauffeurs`, `verifierToken`, `appliquerMigrations`…). Keep using French names and French comments to match. Money is in Ariary.

Two independent projects with no root manifest:
- `server/`: Python 3.12 + FastAPI + python-socketio + aiomysql (the API was migrated from Express; the contract with the client was kept identical)
- `client/`: React 18 + Vite 5 + Bootstrap 5 (ES modules, `.jsx`)

## Commands

```bash
# Backend (port 5000), needs server/.env (copy from server/.env.example)
cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd server && .venv/bin/uvicorn main:app --reload --port 5000

# Frontend (port 5173); Vite proxies /api and /socket.io to localhost:5000
cd client && npm install && npm run dev
cd client && npm run build                  # outputs client/dist

# Full stack in Docker (MySQL 8 + API + nginx client) → http://localhost:8080
docker compose up --build
docker compose down -v                      # also wipes the DB and uploads volumes
```

Backend tests and lint (details in `server/tests/README.md`):

```bash
cd server && .venv/bin/pip install -r requirements-dev.txt
docker run -d --name flotte-test-db -e MYSQL_ROOT_PASSWORD=test -p 3307:3306 --tmpfs /var/lib/mysql mysql:8.0
.venv/bin/pytest                                   # all (needs the MySQL above)
.venv/bin/pytest tests/unit                        # no DB needed
.venv/bin/pytest tests/integration/test_missions.py::TestChevauchements -q   # single class/test
.venv/bin/ruff check .
```

Integration tests create a throwaway database from the repo's SQL files (so SQL changes are tested too), start uvicorn in a subprocess with `--proxy-headers`, and call it over HTTP/Socket.io. Tests must create their own data through the fixtures in `tests/conftest.py` (`unique()` ids) and never depend on order; tests that trigger failed logins use their own account. CI (`.github/workflows/ci.yml`) runs ruff, pytest, the frontend build and a Docker stack smoke test. No frontend tests or linter yet. Swagger is at `/docs`.

Demo accounts (`admin@`, `gestionnaire@`, `chauffeur@flotte.mg`, all `password123`) exist only when `database/seed_demo.sql` is loaded (Docker does it when `SEED_DEMO=1`, the default). Without seed, the first admin is created at startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (`initialiser_admin` in `migrations.py`).

## Database

- MySQL 5.7+. `server/app/db.py` wraps an aiomysql pool: `await db.query(sql, params)` → list of dicts, `db.query_one`, `db.execute` (returns `lastrowid`). Writes touching several rows/tables go in `async with db.transaction() as tx:` (same methods on `tx`), with `SELECT … FOR UPDATE` on the rows whose state is checked. It uses `MYSQL_URL` when set (Railway); otherwise `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`. MySQL 8 auth needs the `cryptography` package.
- SQL uses PyMySQL `%s` placeholders. When `params` is passed, literal `%` in the SQL must be doubled; queries with `DATE_FORMAT(..., '%Y-%m')` or `LIKE CONCAT('%', …)` are run without params so the `%` stays as is.
- `DECIMAL` values are converted to `float` in `db.py`, so they come out as JSON numbers and can be used directly in Python arithmetic.
- Each session runs `SET time_zone` to the offset of `APP_TIMEZONE` (default `Indian/Antananarivo`), so `NOW()`/`CURDATE()` are local time even though containers run in UTC. In Python use `app/temps.py` (`maintenant()`, `aujourdhui()`), never `date.today()`/`datetime.now()`.
- SQL files hold structure only; all demo data lives in `database/seed_demo.sql`. Never add `INSERT`/`TRUNCATE` to the schema or migration files.
- New install: `database/schema.sql`, then the `migrate_*.sql` files in the order of `database/docker-init.sh` (that script is what the Docker MySQL runs on first start). SQL files must stay compatible with MySQL 5.7/8: no MariaDB-only `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` (see the helper procedures in `migrate_phase3.sql`).
- `railway_import.sql` (root and `database/`, identical) is the concatenation of those files without `CREATE DATABASE`/`USE`; regenerate it when a source SQL file changes.
- **Schema changes go through `server/app/migrations.py`.** On startup (FastAPI lifespan), `appliquer_migrations()` runs idempotent helpers (`ajouter_colonne`, `ajouter_index`, `table_existe`) before requests are served. Add new columns, tables and indexes there so existing databases (including production) upgrade on the next boot.

## Backend architecture

- `server/main.py` builds the FastAPI app, mounts one router per module from `app/routers/` at `/api/<module>`, and wraps it in `socketio.ASGIApp`, so the exported `app` serves both the API and `/socket.io`. `redirect_slashes=False`: collection routes are declared as `""` (e.g. `/api/vehicules`, not `/api/vehicules/`).
- **Schemas** (`app/schemas/`): every endpoint declares a Pydantic request model and `response_model`. Inputs extend `Entree` (unknown fields ignored, `""` → None via the `Vide` validator and the `Texte`/`TexteOpt`/`IdOpt`/`MontantOpt`… types in `commun.py`; put constraints on the inner type of an optional, never on `X | None`). Update models give every field a default of `None` and are applied with `champs_fournis()` + `clause_set()`: absent = unchanged, present (even empty) = written; NOT NULL columns are typed without `None` so sending them empty is a 400. Outputs extend `Sortie` and must list every column of their table (enforced by `test_schema_couvre_toutes_les_colonnes`; `API_SCHEMAS_STRICTS=1` in tests makes any unlisted column a 500). Enums in `schemas/enums.py` mirror the DB ENUMs exactly.
- Routers use `Routeur` (`app/utils.py`), which forces `response_model_exclude_unset`: a response contains exactly the columns the SQL selected, so one model serves list, detail and summary variants. Filters are typed query params (`Annotated[Enum | None, Vide]` so `?statut=` means "all"); pagination is the `Pagination` dependency.
- **Response contract with the React client** (keep it when adding endpoints):
  - Errors are `{"message": "..."}`. Raise `ErreurApi(status, message)` from `app/erreurs.py`, never `HTTPException` (it would produce `{"detail": ...}`). Validation errors (400) are translated to French by `message_validation()` and add `erreurs: [{champ, message}]`; business rules that belong to a single payload (date order, password length) go in schema validators with a French `ValueError` message.
  - Unknown routes return 404 `{"message": "Route introuvable"}`, and unhandled exceptions return 500 `{"message": "Erreur interne du serveur"}`.
- **Auth/roles** (`app/auth.py`): `verifier_token` (JWT HS256 Bearer) reloads the user from the DB on every request and returns `{id, nom, email, role}` with the role from the DB. It rejects inactive accounts and tokens whose `tv` claim differs from `users.token_version`; call `revoquer_tokens()` (and `socket.deconnecter_utilisateur()` after commit) when a password, role or active flag changes. Use the shortcuts `Connecte`, `Gestionnaire` (admin + gestionnaire) and `Admin` in `dependencies=[...]`. Every endpoint requires a token. Convention: reads for all roles, create/update for `Gestionnaire`, delete for `Admin`. Data about one chauffeur (payslip, salary fields) is visible to management or to the chauffeur whose `chauffeurs.user_id` matches.
- Login is rate-limited in memory (`app/limiteur.py`, per email and per IP); bcrypt runs in a thread (`hacher_mdp`/`verifier_mdp` are async). The client IP comes from `X-Forwarded-For` via `uvicorn --proxy-headers` + `FORWARDED_ALLOW_IPS`.
- **Socket.io** (`app/socket.py`): connections must send `auth: { token }` (the client uses `creerSocket()` from `services/api.js`). Each socket joins `user:<id>` and `role:<role>` rooms; target emits with `to=`. Use the shared `sio` and `await sio.emit(...)`. Events:
  - `mission:nouvelle`, `mission:statut` (routers/missions)
  - `notification:nouvelle` (services/notifications): `user_id` NULL means management (admin + gestionnaire), otherwise one user. Read/deleted state is per user in `notification_etats`; `notifications.est_lue` is legacy and unused.
  - `flotte:positions` (broadcast every second while simulations are running)
  - `mission:<id>:debut|position|evenement|reprise|vitesse|termine|erreur` (services/simulation)
- **Simulation** (`app/services/simulation.py`): active simulations are kept **in memory** (`simulations_actives`, one asyncio task per mission) and are lost on restart. `route.py` gets road geometry from the public OSRM server (no key) and falls back to a straight line if OSRM is unreachable.
- **Periodic alerts**: a lifespan task runs `verifier_alertes_periodiques()` 5 s after startup and then every 24 h.
- **Pagination** (`Pagination` in `app/utils.py`): opt-in. It applies only when the request has `?paginate=true` (`page`, `limit` ≤ 200), and the response is then `{data, total, page, pages, limit}`. Without that flag, endpoints return a plain array. Keep that backward compatibility.
- PDFs are built with ReportLab through `app/services/pdf.py`, a wrapper whose y-axis starts at the top of the page (like the old PDFKit code): delivery note in `bon_livraison.py`, payslip in `paie.py`. Standard fonts are WinAnsi only, so characters like `→` are replaced. Payroll rules: base salary + bonus per mission + 20 000 Ar per 500 km band above 500 km − 1 % CNAPS.
- Uploads go through `app/stockage.py`: `STOCKAGE=local` (`UPLOADS_DIR`, must be a persistent volume in production) or `STOCKAGE=s3` (S3/R2). The DB stores `fichier_url = /uploads/documents/...`; only `POST /documents/{id}/fichier` writes it (create/update ignore it), old files are deleted on replace/delete, and files are served at `/api/uploads/...` behind `verifier_token` as attachments.
- Missions (`app/services/missions.py`): a truck or driver cannot have two active missions with overlapping periods, and status changes follow `TRANSITIONS`. Keep these checks inside the transaction.

## Frontend architecture

- `src/services/api.js` is the single Axios instance (`baseURL` = `VITE_API_URL` or `/api`). It adds the JWT from `localStorage`. On 401 it clears auth and redirects to `/login`. On 500 or a network error it dispatches the window events `api:erreur500` / `api:reseau`, and `App.jsx` shows them as a global banner. Always use `api`, never raw axios.
- `context/AuthContext.jsx` keeps `user`/`token` in `localStorage` and provides `useAuth()` and `<ProtectedRoute>`. Pages hide controls based on `user.role`, but the real enforcement happens on the server.
- `App.jsx` wraps each page in `AppLayout` (Sidebar + Navbar + padded scrolling main). Full-screen map pages use `AppLayoutPleinEcran`.
- Socket clients connect to `SOCKET_URL` from `services/api.js` (`VITE_SOCKET_URL`, default same origin `/`). In dev the Vite proxy forwards `/api` and `/socket.io` to port 5000; in Docker nginx (`client/nginx.conf`) does the same. Sockets are used in `Navbar` (notifications), `CarteGlobale` and `SimulationMission`.
- Protected files (PDFs, uploaded documents) must be fetched with `telechargerFichier(chemin, nom)` from `services/api.js`: a plain `<a href>` does not send the JWT.
- Shared UI: `Modal`, `ConfirmModal` (use it instead of `window.confirm`), `Toast` + `useToast`, `Pagination`, `StatCard`. Charts use chart.js / react-chartjs-2; maps use react-leaflet; the calendar uses FullCalendar; client-side exports use jsPDF + xlsx.

## Deployment

The frontend is on Vercel (`client/vercel.json` rewrites every path to `index.html` for SPA routing). Set `VITE_API_URL` and `VITE_SOCKET_URL`. The backend and MySQL are on Railway (`MYSQL_URL`); the start command is in `server/Procfile` (`uvicorn main:app --host 0.0.0.0 --port $PORT`). Set `CLIENT_URL` on the server for CORS and for the Socket.io origin. The server exits immediately if `JWT_SECRET` is missing.
