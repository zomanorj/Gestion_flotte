# Système de Gestion de Flotte de Camions

> Projet réalisé dans le cadre d'une recherche de stage — L3 Informatique
> Étudiant : Manoa | Antananarivo, Madagascar

## Technologies

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white&style=flat-square)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white&style=flat-square)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwind-css&logoColor=white&style=flat-square)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white&style=flat-square)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white&style=flat-square)

## Fonctionnalités

- **Gestion des camions** — CRUD complet avec type, tonnage et numéro de châssis, alertes de maintenance (CT et vidange)
- **Gestion des chauffeurs poids lourds** — CRUD, historique détaillé des missions par chauffeur
- **Missions de transport** — Création avec vérification de disponibilité, suivi du poids chargé, workflow (planifiée → en cours → terminée/annulée), calcul automatique du coût carburant en Ariary
- **Dashboard** — Statistiques en temps réel, graphique des missions par semaine (Chart.js), carte interactive (Leaflet, centrée Madagascar)
- **Rapports & Exports** — Filtrage par période, export PDF (jsPDF) et Excel (SheetJS)
- **Authentification** — JWT avec 3 rôles (admin, gestionnaire, chauffeur)

## Installation

### Prérequis

- Node.js v18+
- MySQL 8+
- Git

### Étapes

```bash
# 1. Cloner le projet
git clone https://github.com/TON_USERNAME/flotte-app
cd flotte-app

# 2. Importer la base de données (crée flotte_db + données de test)
mysql -u root -p < database/schema.sql

# 3. Configurer le backend
cp server/.env.example server/.env
# Éditer server/.env avec vos identifiants MySQL

# 4. Démarrer le backend
cd server
npm install
npm start

# 5. Démarrer le frontend (nouveau terminal)
cd client
npm install
npm run dev

# 6. Ouvrir dans le navigateur
# http://localhost:5173
```

> **Note :** Régénérer les hash bcrypt pour `password123` :
> ```bash
> node -e "const b=require('bcrypt');b.hash('password123',10).then(h=>console.log(h))"
> ```
> Puis mettre à jour le champ `password_hash` dans MySQL.

## Comptes de test

| Email | Mot de passe | Rôle | Permissions |
|-------|-------------|------|-------------|
| admin@flotte.mg | password123 | Admin | Tout (CRUD complet + suppression) |
| gestionnaire@flotte.mg | password123 | Gestionnaire | CRUD camions, chauffeurs, missions |
| chauffeur@flotte.mg | password123 | Chauffeur | Lecture seule |

## Flotte de démonstration

| Immatriculation | Marque | Modèle | Type | Tonnage |
|----------------|--------|--------|------|---------|
| MAD-001-24 | Mercedes | Actros | Tracteur | 32,5 T |
| MAD-002-24 | Volvo | FH16 | Tracteur | 36 T |
| MAD-003-24 | MAN | TGX | Porteur | 28 T |
| MAD-004-24 | Scania | R500 | Benne | 40 T |
| MAD-005-24 | Renault | T520 | Frigorifique | 30 T |

## Structure du projet

```
flotte-app/
├── database/
│   └── schema.sql           # Tables + données camions malgaches
├── server/                  # API REST Node.js + Express
│   ├── .env.example
│   ├── index.js             # Point d'entrée Express + Socket.io
│   ├── config/db.js         # Pool MySQL2
│   ├── middleware/authMiddleware.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── vehiculesController.js  # Gestion des camions
│   │   ├── chauffeursController.js
│   │   ├── missionsController.js   # Missions de transport
│   │   └── dashboardController.js
│   └── routes/
└── client/                  # Application React 18
    └── src/
        ├── components/
        │   ├── Sidebar.jsx   # Navigation (CamionApp)
        │   ├── Navbar.jsx
        │   ├── StatCard.jsx
        │   ├── MapView.jsx   # Carte Leaflet — Madagascar
        │   ├── Modal.jsx
        │   └── AlerteBadge.jsx
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx  # Stats flotte de camions
            ├── Vehicules.jsx  # Gestion des camions (type, tonnage, châssis)
            ├── Chauffeurs.jsx
            ├── Missions.jsx   # Transport + poids chargé
            └── Rapports.jsx
```

## API Endpoints principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion |
| GET | `/api/vehicules` | Liste des camions |
| GET | `/api/vehicules/alertes` | Camions nécessitant maintenance |
| POST | `/api/vehicules` | Enregistrer un nouveau camion |
| GET | `/api/missions` | Liste des missions de transport |
| POST | `/api/missions` | Créer une mission de transport |
| PUT | `/api/missions/:id/statut` | Mettre à jour le statut |
| GET | `/api/dashboard/stats` | Statistiques globales |

## Auteur

**Manoa** — Étudiant L3 Informatique — Antananarivo, Madagascar
