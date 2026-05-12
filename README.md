# 🚗 Système de Gestion de Flotte

> Projet réalisé dans le cadre d'une recherche de stage — L3 Informatique
> Étudiant : Manoa | Antananarivo, Madagascar

## 🛠️ Technologies

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white&style=flat-square)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white&style=flat-square)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwind-css&logoColor=white&style=flat-square)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white&style=flat-square)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white&style=flat-square)

## ✨ Fonctionnalités

- **Gestion des véhicules** — CRUD complet, filtres par statut, alertes de maintenance (CT et vidange)
- **Gestion des chauffeurs** — CRUD, historique détaillé des missions par chauffeur
- **Missions** — Création avec vérification de disponibilité, workflow complet (planifiée → en cours → terminée/annulée), calcul automatique du coût carburant en Ariary
- **Dashboard** — Statistiques en temps réel, graphique des missions par semaine (Chart.js), carte interactive (Leaflet, centrée Madagascar)
- **Rapports & Exports** — Filtrage par période, export PDF (jsPDF) et Excel (SheetJS)
- **Authentification** — JWT avec 3 rôles (admin, gestionnaire, chauffeur)

## ⚙️ Installation

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

> **Note :** Le mot de passe `password123` doit être re-hashé avec bcrypt après l'import SQL.
> Exécutez dans le répertoire server :
> ```bash
> node -e "const b=require('bcrypt');b.hash('password123',10).then(h=>console.log(h))"
> ```
> Puis mettez à jour le champ `password_hash` des utilisateurs dans MySQL.

## 🔑 Comptes de test

| Email | Mot de passe | Rôle | Permissions |
|-------|-------------|------|-------------|
| admin@flotte.mg | password123 | Admin | Tout (CRUD complet + suppression) |
| gestionnaire@flotte.mg | password123 | Gestionnaire | CRUD véhicules, chauffeurs, missions |
| chauffeur@flotte.mg | password123 | Chauffeur | Lecture seule |

## 📁 Structure du projet

```
flotte-app/
├── database/
│   └── schema.sql           # Tables + données de test malgaches
├── server/                  # API REST Node.js + Express
│   ├── .env.example         # Template de configuration
│   ├── index.js             # Point d'entrée Express + Socket.io
│   ├── config/
│   │   └── db.js            # Pool de connexions MySQL2
│   ├── middleware/
│   │   └── authMiddleware.js # Vérification JWT + rôles
│   ├── controllers/         # Logique métier
│   │   ├── authController.js
│   │   ├── vehiculesController.js
│   │   ├── chauffeursController.js
│   │   ├── missionsController.js
│   │   └── dashboardController.js
│   └── routes/              # Endpoints API
│       ├── auth.js
│       ├── vehicules.js
│       ├── chauffeurs.js
│       ├── missions.js
│       └── dashboard.js
└── client/                  # Application React 18
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx           # Routage React Router v6
        ├── context/
        │   └── AuthContext.jsx  # État global + ProtectedRoute
        ├── services/
        │   └── api.js           # Instance axios + intercepteurs
        ├── components/
        │   ├── Sidebar.jsx      # Navigation avec badge alertes
        │   ├── Navbar.jsx       # Barre supérieure
        │   ├── StatCard.jsx     # Carte métrique réutilisable
        │   ├── MapView.jsx      # Carte Leaflet — Madagascar
        │   ├── Modal.jsx        # Fenêtre modale générique
        │   └── AlerteBadge.jsx  # Badge d'alerte de maintenance
        └── pages/
            ├── Login.jsx        # Authentification
            ├── Dashboard.jsx    # Statistiques + graphique + carte
            ├── Vehicules.jsx    # CRUD véhicules + filtres
            ├── Chauffeurs.jsx   # CRUD chauffeurs + historique
            ├── Missions.jsx     # Missions + workflow statuts
            └── Rapports.jsx     # Export PDF + Excel
```

## 🗺️ API Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/auth/login` | Connexion | Non |
| GET | `/api/auth/me` | Profil connecté | Token |
| GET | `/api/vehicules` | Liste véhicules | Non |
| GET | `/api/vehicules/alertes` | Alertes maintenance | Non |
| GET | `/api/vehicules/:id` | Détail véhicule | Non |
| POST | `/api/vehicules` | Créer véhicule | Admin/Gest. |
| PUT | `/api/vehicules/:id` | Modifier véhicule | Admin/Gest. |
| DELETE | `/api/vehicules/:id` | Supprimer véhicule | Admin |
| GET | `/api/chauffeurs` | Liste chauffeurs | Non |
| GET | `/api/chauffeurs/:id/missions` | Historique missions | Non |
| POST | `/api/chauffeurs` | Créer chauffeur | Admin/Gest. |
| GET | `/api/missions` | Liste missions | Non |
| POST | `/api/missions` | Créer mission | Admin/Gest. |
| PUT | `/api/missions/:id/statut` | Changer statut | Admin/Gest. |
| GET | `/api/dashboard/stats` | Statistiques | Token |

## 👤 Auteur

**Manoa** — Étudiant L3 Informatique — Antananarivo, Madagascar

---

*Projet portfolio réalisé avec Node.js, React 18, MySQL et TailwindCSS.*
*Données de test avec noms malgaches. Carte centrée sur Antananarivo (-18.9136, 47.5362).*
