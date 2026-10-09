# FlotteApp — Système de Gestion de Flotte

> Projet de portfolio réalisé en L3 Informatique — Antananarivo, Madagascar  
> Auteur : Manoa

---

## Présentation

FlotteApp est une application web full-stack de gestion de flotte de transport développée dans le contexte malgache. Elle couvre l'ensemble du cycle opérationnel d'une entreprise de transport : planification des missions, suivi des véhicules en temps réel, gestion administrative, finances et ressources humaines.

Le projet a été structuré en trois phases successives, chacune ajoutant une couche de complexité fonctionnelle et technique, de la gestion métier de base jusqu'aux modules ERP (paie, utilisateurs, notifications temps réel).

---

## Stack technique

[![CI](https://github.com/zomanorj/Gestion_flotte/actions/workflows/ci.yml/badge.svg)](https://github.com/zomanorj/Gestion_flotte/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white&style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white&style=flat-square)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-4479A1?logo=mysql&logoColor=white&style=flat-square)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-7952B3?logo=bootstrap&logoColor=white&style=flat-square)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white&style=flat-square)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white&style=flat-square)
![FullCalendar](https://img.shields.io/badge/FullCalendar-6-4285F4?style=flat-square)
![ReportLab](https://img.shields.io/badge/ReportLab-PDF-red?style=flat-square)

| Couche | Technologies |
|--------|-------------|
| Frontend | React 18, Vite, Bootstrap 5 (thème Sass en niveaux de gris), TanStack Query, FullCalendar, Chart.js, jsPDF, SheetJS — pages chargées à la demande (138 Ko compressés au premier chargement) |
| Backend | Python 3.12, FastAPI, python-socketio, PyJWT, bcrypt, ReportLab |
| Base de données | MySQL 5.7+ (pool de connexions async via aiomysql) |
| Temps réel | Socket.io (python-socketio, compatible socket.io-client v4) — notifications push, mise à jour des écrans à chaque changement de mission |

---

## Fonctionnalités

### Gestion de la flotte

| Module | Détail |
|--------|--------|
| Véhicules | CRUD complet — immatriculation, marque, modèle, tonnage, kilométrage, statut, alertes maintenance |
| Chauffeurs | CRUD — numéro de permis, catégorie, salaire de base, prime par mission, historique |
| Missions | Workflow planifiée → en cours → terminée / annulée, distance saisie avec coût carburant estimé en Ariary, association client optionnelle |
| Clients | CRUD entreprises et particuliers, historique des missions par client |

### Suivi en temps réel

| Module | Détail |
|--------|--------|
| Notifications | Alertes push temps réel (expiration de documents, maintenances urgentes, démarrage de mission) persistées en base et émises via Socket.io |

### Finances et opérations

| Module | Détail |
|--------|--------|
| Carburant | Suivi des pleins — litres, prix au litre, station, kilométrage, consommation réelle calculée, statistiques mensuelles |
| Dépenses | Catégorisation (péage, amende, pneus, pièces, main-d'œuvre, parking…), statistiques par véhicule et évolution mensuelle |
| Bon de livraison | Génération PDF côté serveur (ReportLab) — en-tête, trajet, références camion / chauffeur / client, zone de signatures |
| Rapports | Filtrage par période, export PDF (jsPDF) et export Excel (SheetJS) |

### Ressources humaines et administration

| Module | Détail |
|--------|--------|
| Paie | Calcul mensuel par chauffeur : salaire de base + primes par mission + bonus kilométrique (tranches de 500 km) + cotisation CNAPS 1 % — génération du bulletin PDF |
| Utilisateurs | CRUD des comptes (admin uniquement) — activation / désactivation, réinitialisation du mot de passe, liaison avec le profil chauffeur |
| Maintenances | Planification (vidange, freins, pneus, révision…), quatre niveaux de priorité, modal de clôture avec coût réel et date effective |
| Documents | Gestion des pièces administratives (carte grise, assurance, vignette, visite technique), upload de fichier, alertes d'expiration dans la Sidebar |
| Paramètres | Prix du gasoil, barème de paie (salaire et prime par défaut, bonus kilométrique, taux CNAPS) et seuils d'alerte, modifiables par l'administrateur sans redéploiement, avec historique des modifications |
| Planning | Calendrier FullCalendar — vues mois / semaine / jour, code couleur par statut, popup détail au clic |

### Sécurité

Authentification par token JWT (expiration 24 h). Trois rôles appliqués côté serveur sur chaque route :

| Rôle | Permissions |
|------|-------------|
| admin | Toutes les opérations, y compris suppression et gestion des utilisateurs |
| gestionnaire | Création et modification — aucune suppression |
| chauffeur | Lecture seule ; arrive sur « Mes missions » (en cours, à venir, historique, bon de livraison) ; ne voit ni les salaires des autres chauffeurs ni les alertes de gestion, et ne peut télécharger que son propre bulletin de paie |

- Chaque requête vérifie que le compte est toujours actif : désactiver un compte, changer son rôle ou son mot de passe révoque immédiatement ses sessions (y compris ses connexions temps réel).
- Socket.io exige un token valide ; les notifications sont envoyées uniquement à leurs destinataires, avec un état lu / supprimé propre à chaque utilisateur.
- Connexion protégée contre la force brute : 5 échecs par compte ou 20 par adresse IP en 15 minutes déclenchent un blocage temporaire (HTTP 429).
- Missions : un camion ou un chauffeur ne peut pas être affecté à deux missions actives sur des périodes qui se chevauchent ; les changements de statut suivent un cycle de vie strict (planifiée → en cours → terminée, ou annulée) et sont faits en transaction.

---

## Architecture

```
flotte-app/
├── server/                            # API REST Python + FastAPI + Socket.io
│   ├── main.py                        # Point d'entrée : app FastAPI + Socket.io (ASGI), migrations, CORS
│   ├── migrations/versions/           # Migrations du schéma (Alembic), appliquées au démarrage
│   ├── donnees/demo.sql               # Données de démonstration (SEED_DEMO=1)
│   ├── requirements.txt
│   ├── Procfile                       # Commande de démarrage (Railway)
│   └── app/
│       ├── db.py                      # Pool aiomysql, transactions (MYSQL_URL ou variables DB_*)
│       ├── migrations.py              # Application des migrations, reprise des bases historiques
│       ├── auth.py                    # JWT, vérification du compte à chaque requête, rôles
│       ├── exceptions.py              # Exceptions métier (introuvable, conflit, accès refusé…)
│       ├── erreurs.py                 # Traduction en réponses HTTP { message }
│       ├── schemas/                   # Modèles Pydantic des requêtes et réponses
│       ├── routers/                   # Couche HTTP : un router par module, sans SQL
│       ├── services/                  # Règles métier : missions, paie, documents, comptes…
│       ├── repositories/              # Accès aux données : uniquement du SQL
│       ├── pdf/                       # Rendu des bons de livraison et bulletins de paie
│       ├── socket.py                  # Socket.io authentifié (rooms par utilisateur et rôle)
│       └── stockage.py                # Fichiers uploadés : disque ou S3
│
└── client/                            # Application React 18 + Vite + Bootstrap 5
    └── src/
        ├── context/
        │   └── AuthContext.jsx        # Contexte global auth + persistance localStorage
        ├── services/
        │   ├── api.js                 # Instance Axios centralisée + intercepteur JWT
        │   └── socket.js              # Connexion Socket.io unique pour la session
        ├── requetes/                  # Accès aux données (TanStack Query) : cache et invalidation
        ├── hooks/                     # useDiffere, useEvenement, useMediaQuery
        ├── utils/format.js            # Formats communs : dates, montants, kilomètres
        ├── components/
        │   ├── Sidebar.jsx            # Navigation (tiroir sur mobile) + badges d'alerte
        │   ├── Navbar.jsx             # Titre, bouton menu sur mobile, notifications
        │   ├── Modal.jsx
        │   ├── ConfirmModal.jsx       # Modal de confirmation stylisé (remplace window.confirm)
        │   ├── StatCard.jsx
        │   └── Toast.jsx              # Notifications toast + hook useToast
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx          # KPI globaux + graphique missions
            ├── Vehicules.jsx
            ├── Chauffeurs.jsx
            ├── Missions.jsx
            ├── Documents.jsx
            ├── Carburant.jsx
            ├── Depenses.jsx
            ├── Maintenances.jsx
            ├── Planning.jsx
            ├── Clients.jsx
            ├── Rapports.jsx
            ├── Utilisateurs.jsx       # Gestion des comptes (admin)
            ├── Paie.jsx               # Bulletins + masse salariale
            ├── Parametres.jsx         # Paramètres métier (admin)
            └── MesMissions.jsx        # Missions du chauffeur connecté, pensée pour le téléphone
```

---

## Installation

### Avec Docker (recommandé)

Prérequis : Docker et Docker Compose.

```bash
git clone https://github.com/zomanorj/Gestion_flotte.git
cd Gestion_flotte
docker compose up --build
# L'application est disponible sur http://localhost:8080
# Documentation de l'API (Swagger) : http://localhost:5000/docs
```

Au démarrage, l'API crée ou met à jour le schéma de la base (migrations versionnées) puis charge les données de démonstration si la base est vide. nginx sert le client React et relaie `/api` et `/socket.io` vers le backend. Les données MySQL et les fichiers uploadés sont gardés dans des volumes Docker (`docker compose down -v` remet tout à zéro).

Variables optionnelles (dans un fichier `.env` à la racine) : `JWT_SECRET`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `APP_PORT` (8080 par défaut), `API_PORT` (5000 par défaut, Swagger), `SEED_DEMO` (1 par défaut : données et comptes de démonstration), `ADMIN_EMAIL` / `ADMIN_PASSWORD` (premier administrateur quand `SEED_DEMO=0`).

### Sans Docker

#### Prérequis

- Python 3.12+
- Node.js v18+ (frontend uniquement)
- MySQL 5.7 ou 8+
- Git

#### Étapes

```bash
# 1. Cloner le projet
git clone https://github.com/zomanorj/Gestion_flotte.git
cd Gestion_flotte

# 2. Créer une base vide (les tables sont créées par l'API au démarrage)
mysql -u root -p -e "CREATE DATABASE flotte_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

# 3. Configurer le backend
cp server/.env.example server/.env
# Renseigner DB_*, JWT_SECRET, CLIENT_URL
# SEED_DEMO=1 pour les données de démonstration en local,
# sinon ADMIN_EMAIL / ADMIN_PASSWORD pour créer le premier administrateur

# 4. Démarrer le backend (port 5000)
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 5000

# 5. Démarrer le frontend (nouveau terminal)
cd client && npm install && npm run dev

# L'application est disponible sur http://localhost:5173
```

### Variables d'environnement (`server/.env`)

La configuration est validée au démarrage : une valeur manquante ou invalide arrête l'API avec la liste des problèmes. Avec `ENVIRONNEMENT=production`, l'API refuse en plus un `JWT_SECRET` faible (32 caractères minimum), `SEED_DEMO` et un stockage de fichiers sur le disque éphémère du conteneur. La liste complète et commentée est dans `server/.env.example`.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=mot_de_passe
DB_NAME=flotte_db
JWT_SECRET=chaine_secrete_longue_et_aleatoire
PORT=5000
CLIENT_URL=http://localhost:5173
# Production : MYSQL_URL=mysql://user:pass@host:port/db remplace les DB_*

APP_TIMEZONE=Indian/Antananarivo   # fuseau des dates métier (MySQL suit le même)
ADMIN_EMAIL=                       # premier administrateur, créé si aucun admin actif n'existe
ADMIN_PASSWORD=                    # 8 caractères minimum

STOCKAGE=local                     # local (UPLOADS_DIR) ou s3 (S3_BUCKET, S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION)
UPLOADS_DIR=
```

La liste complète et commentée est dans `server/.env.example`.

### Faire évoluer le schéma de la base

Toute modification passe par une révision Alembic dans `server/migrations/versions/`, appliquée automatiquement au démarrage de l'API (verrou MySQL : une seule instance migre à la fois).

```bash
cd server
.venv/bin/alembic revision --rev-id 0003 -m "description du changement"   # puis écrire upgrade() et downgrade()
.venv/bin/alembic upgrade head        # appliquer (sinon : au prochain démarrage)
.venv/bin/alembic downgrade -1        # défaire la dernière révision
.venv/bin/alembic history             # liste des révisions
```

### Mise en production (Railway)

- **Base** : rien à importer. Au démarrage, l'API crée le schéma sur une base vide, ou met à jour une base existante (une base créée avant les migrations versionnées est reconnue, complétée puis versionnée automatiquement).
- **Premier administrateur** : définir `ADMIN_EMAIL` et `ADMIN_PASSWORD` ; il est créé au démarrage si aucun admin actif n'existe.
- **Fichiers uploadés** : le disque d'un conteneur est effacé à chaque redéploiement. Utiliser un volume Railway monté sur `UPLOADS_DIR`, ou un stockage S3 (Cloudflare R2, AWS S3) avec `STOCKAGE=s3`.
- **Proxy** : définir `FORWARDED_ALLOW_IPS=*` pour que l'API voie l'adresse IP réelle des clients (nécessaire à la protection contre la force brute).
- **Secrets** : `JWT_SECRET` long et aléatoire, propre à la production.
- **Environnement** : définir `ENVIRONNEMENT=production`, qui active les contrôles de configuration propres à la production.

La documentation interactive de l'API est disponible sur http://localhost:5000/docs (Swagger) et `/redoc` : chaque route y décrit ses paramètres, son corps de requête, sa réponse et ses erreurs, avec un bouton *Authorize* pour tester avec un token.

Toutes les entrées sont validées (types, valeurs autorisées, longueurs, cohérence des dates). Les erreurs ont toujours le format `{"message": "..."}`, en français ; les erreurs de validation (400) détaillent chaque champ dans `erreurs: [{champ, message}]`.

---

## Tests et intégration continue

Le backend est couvert par plus de 500 tests (`server/tests/`) :

- **unitaires** : règles métier testées sans base de données (cycle de vie des missions, paie, coûts, confidentialité des salaires), sécurité, schémas, et règles d'architecture (un router ne contient pas de SQL, un service ignore HTTP) ;
- **intégration** : l'API complète appelée en HTTP et Socket.io sur une base MySQL jetable initialisée avec les scripts du dépôt (droits par rôle, chevauchement des missions y compris en concurrence, révocation des sessions, notifications, fichiers, paie).

```bash
cd server
.venv/bin/pip install -r requirements-dev.txt
docker run -d --name flotte-test-db -e MYSQL_ROOT_PASSWORD=test -p 3307:3306 --tmpfs /var/lib/mysql mysql:8.0
.venv/bin/pytest
```

Détails dans `server/tests/README.md`.

Le frontend a son lint (ESLint : règles React et hooks, aucun avertissement toléré) et ses tests (Vitest + Testing Library, sans serveur : l'API est simulée). Ils couvrent les formats, la couche de données (quelles données sont rafraîchies après une écriture), la connexion temps réel, l'authentification, la vue « Mes missions », la barre latérale, et des tests de non-régression sur des défauts corrigés (saisie qui perd le focus, réponse d'itinéraire arrivée en retard, toast qui ne se ferme pas).

```bash
cd client
npm run lint
npm test              # ou npm run test:watch pendant le développement
```

À chaque push et pull request, GitHub Actions (`.github/workflows/ci.yml`) exécute le lint et les tests du backend et du frontend, le build du frontend avec son budget de taille, puis construit et démarre la stack Docker complète.

---

## Comptes de démonstration

Disponibles uniquement si l'API a démarré avec `SEED_DEMO=1` sur une base sans aucun compte (valeur par défaut avec Docker) : elle charge alors `server/donnees/demo.sql`.

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@flotte.mg | password123 | Admin |
| gestionnaire@flotte.mg | password123 | Gestionnaire |
| chauffeur@flotte.mg | password123 | Chauffeur |

Ne jamais charger ces données en production.

---

## API — Référence des endpoints

### Authentification

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/login` | — | Connexion, retourne un token JWT |
| GET | `/api/auth/profil` | Tous | Profil de l'utilisateur connecté |

### Véhicules

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/vehicules` | — | Liste avec filtre `?statut=` |
| GET | `/api/vehicules/alertes` | — | Véhicules nécessitant une maintenance |
| POST | `/api/vehicules` | gestionnaire | Créer |
| PUT | `/api/vehicules/:id` | gestionnaire | Modifier |
| DELETE | `/api/vehicules/:id` | admin | Supprimer |

### Missions

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/missions` | — | Liste avec filtres `?statut=&debut=&fin=` |
| GET | `/api/missions/planning` | — | Format FullCalendar avec couleurs par statut |
| GET | `/api/missions/miennes` | — | Missions du chauffeur lié au compte connecté (404 sans fiche liée) |
| POST | `/api/missions` | gestionnaire | Créer |
| PUT | `/api/missions/:id/statut` | gestionnaire | Changer le statut |
| DELETE | `/api/missions/:id` | admin | Supprimer (remet camion et chauffeur disponibles) |
| GET | `/api/missions/:id/bon-livraison` | Tous | Télécharger le bon de livraison PDF |

### Paie

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/paie/:annee/:mois` | gestionnaire | Masse salariale mensuelle — toutes les fiches |
| GET | `/api/paie/:annee/:mois/:id` | gestionnaire | Fiche individuelle d'un chauffeur |
| GET | `/api/paie/:annee/:mois/:id/pdf` | gestionnaire | Télécharger le bulletin PDF |
| PUT | `/api/paie/salaire/:id` | admin | Modifier salaire de base et prime mission |

### Notifications

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/notifications` | Tous | Liste des notifications (filtre `?non_lues=1`) |
| PUT | `/api/notifications/:id/lire` | Tous | Marquer comme lue |
| PUT | `/api/notifications/lire-tout` | Tous | Marquer toutes comme lues |

### Documents

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/documents` | Liste avec filtres `?vehicule_id=&type=` |
| GET | `/api/documents/alertes` | Expirés ou expirant dans les 30 prochains jours |
| POST | `/api/documents` | Créer (upload de fichier via multipart/form-data) |
| PUT / DELETE | `/api/documents/:id` | Modifier / Supprimer |

### Statistiques et autres modules

Chaque module (carburant, dépenses, maintenances, clients, utilisateurs) expose des routes CRUD standard ainsi qu'un endpoint `/stats` ou `/alertes` selon le cas.

---

## Auteur

**Manoa** — Etudiant L3 Informatique — Antananarivo, Madagascar
