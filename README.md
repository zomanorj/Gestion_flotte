# Transport STTA — Système de Gestion de Flotte

Application web de gestion de transport développée pour **NP AKADIN / STTA Madagascar**.

## Stack technique

| Couche      | Technologie                        |
|-------------|----------------------------------- |
| Frontend    | React 19 + TypeScript + Vite       |
| Style       | Tailwind CSS v3                    |
| Routing     | React Router DOM v7                |
| HTTP Client | Axios                              |
| Backend     | Node.js + Express 5                |
| Base de données | PostgreSQL                     |
| Auth        | JSON Web Token (JWT) + bcryptjs    |

## Structure du projet

```
transport-stta/
├── client/                  ← Application React
│   ├── src/
│   │   ├── components/      ← Composants réutilisables
│   │   ├── pages/           ← Pages de l'application
│   │   └── App.tsx          ← Routeur principal
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                  ← API REST Node.js/Express
│   ├── db/
│   │   ├── schema.sql       ← Schéma PostgreSQL
│   │   └── seed.sql         ← Données de test
│   ├── server.js            ← Point d'entrée du serveur
│   ├── .env.example         ← Modèle de configuration
│   └── package.json
│
├── .gitignore
└── README.md
```

## Lancer le projet en développement

### 1. Prérequis

- Node.js >= 18
- PostgreSQL >= 14

### 2. Base de données

```bash
# Créer la base de données
createdb transport_stta

# Créer les tables
psql -U postgres -d transport_stta -f server/db/schema.sql

# Insérer les données de test
psql -U postgres -d transport_stta -f server/db/seed.sql
```

### 3. Serveur (API)

```bash
cd server
cp .env.example .env     # Remplir les valeurs dans .env
npm install
npm run dev              # Démarre avec nodemon sur le port 5000
```

### 4. Client (React)

```bash
cd client
npm install
npm run dev              # Démarre Vite sur le port 5173
```

L'application est accessible sur : **http://localhost:5173**

## Comptes de test

| Email                    | Mot de passe | Rôle          |
|--------------------------|--------------|---------------|
| admin@stta.mg            | admin1234    | Administrateur |
| gestionnaire@stta.mg     | gest1234     | Gestionnaire  |
| chauffeur@stta.mg        | chauf1234    | Chauffeur     |

## Roadmap des sprints

- [x] **Sprint 0** — Initialisation du projet et architecture de base
- [ ] **Sprint 1** — Authentification (login / logout / JWT)
- [ ] **Sprint 2** — Gestion des véhicules (CRUD)
- [ ] **Sprint 3** — Gestion des chauffeurs (CRUD)
- [ ] **Sprint 4** — Planification des missions
- [ ] **Sprint 5** — Tableau de bord et rapports

---

*Développé dans le cadre d'un stage L3 Informatique — NP AKADIN / STTA Madagascar*
