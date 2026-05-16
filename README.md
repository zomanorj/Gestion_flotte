# 🚛 TransiFlow — Système de Gestion de Transport

<div align="center">

[![Live Demo](https://img.shields.io/badge/🌐_Demo_Live-transiflow--zeta.vercel.app-1E40AF?style=for-the-badge)](https://transiflow-zeta.vercel.app)
[![Backend](https://img.shields.io/badge/⚙️_API-onrender.com-22c55e?style=for-the-badge)](https://transiflow-api.onrender.com/api/health)
[![GitHub](https://img.shields.io/badge/GitHub-zomanorj-black?style=for-the-badge&logo=github)](https://github.com/zomanorj/Gestion_flotte)

**Système complet de gestion de flotte de transport**
développé pour NP AKADIN / STTA Madagascar

[🚀 Voir la démo live](https://transiflow-zeta.vercel.app) •
[📖 Health API](https://transiflow-api.onrender.com/api/health) •
[🐛 Signaler un bug](https://github.com/zomanorj/Gestion_flotte/issues)

</div>

---

## 📋 Table des matières

- [Aperçu du projet](#-aperçu-du-projet)
- [Fonctionnalités](#-fonctionnalités)
- [Stack technique](#-stack-technique)
- [Architecture](#-architecture)
- [Démo rapide](#-démo-rapide)
- [Installation locale](#-installation-locale)
- [Structure du projet](#-structure-du-projet)
- [API Documentation](#-api-documentation)
- [Auteur](#-auteur)

---

## 🎯 Aperçu du projet

TransiFlow est un **système ERP de gestion de transport** développé dans le cadre d'une candidature de stage chez **NP AKADIN / STTA Madagascar** — une société de transport d'hydrocarbures opérant avec 200 véhicules et 300 chauffeurs sur 7 régions de Madagascar.

### Chiffres clés

| Métrique | Valeur |
|----------|--------|
| 📦 Modules métier | 12 modules complets |
| 🗄️ Tables PostgreSQL | 17 tables |
| 🔌 Routes API REST | 21+ endpoints |
| 📄 Pages frontend | 25 pages |
| 🔐 Rôles utilisateurs | 3 rôles (RBAC) |
| 🗺️ Couverture | Madagascar nationale |

---

## ✨ Fonctionnalités

### 🚛 Gestion de la flotte
- CRUD complet des véhicules (camions, citernes, pickups)
- Alertes automatiques documents expirés (assurance, visite technique)
- Suivi kilométrique et historique complet par véhicule

### 👤 Gestion des chauffeurs
- Profils complets avec suivi des permis
- Alertes permis expirant bientôt
- Planning de disponibilité en temps réel
- Gestion des salaires avec paiements progressifs

### 📋 Planification des missions
- Autocomplétion des villes (API Nominatim — OpenStreetMap)
- Calcul automatique d'itinéraire réel (API OSRM — routes Madagascar)
- Calcul automatique distance km et carburant estimé
- Workflow statuts : `Brouillon` → `Planifiée` → `En cours` → `Terminée`
- Détection automatique des conflits (même véhicule/chauffeur)

### 🗺️ Suivi GPS en temps réel
- Carte interactive Madagascar (Leaflet.js + Carto)
- Simulation GPS des véhicules en mission
- 3 thèmes de carte (Sombre / Clair / Standard)
- Marqueurs animés avec halos pulsants
- Trajet réel tracé sur la carte

### 💰 Facturation & Finance
- Génération de factures avec numéro automatique (`FAC-2026-XXXX`)
- Calcul TVA automatique (20% — Madagascar)
- Paiements progressifs (acomptes MVola, virement, espèces)
- Export PDF professionnel
- Compte crédit par client avec historique de transactions
- Graphiques Recharts (dépenses, revenus, marges)

### 🏢 Gestion des clients
- Profils clients (entreprise / particulier / administration)
- NIF et STAT Madagascar
- Contrats avec tarifs négociés par km et remises
- Renouvellement automatique des contrats
- Historique complet des missions et factures

### 🔧 Maintenance préventive
- Planification par kilométrage ou date
- Alertes maintenance urgente
- Création automatique de la prochaine maintenance
- Historique des réparations avec coûts

### 🚨 Gestion des incidents
- Déclaration d'incidents (panne, accident, vol, infraction...)
- Niveaux de gravité (faible / moyen / grave / critique)
- Incident critique → véhicule mis en révision automatiquement
- Timeline de résolution avec horodatage

### 📊 Rapports avancés
- Rentabilité par mission (revenu, coûts, marge %)
- Performance par chauffeur (classement avec notes sur 10)
- Taux d'utilisation de la flotte
- Export Excel `.xlsx` avec styles professionnels
- Export PDF des rapports

### 🔐 Sécurité & Administration
- Authentification JWT (7 jours)
- Contrôle d'accès par rôle — RBAC (`admin` / `gestionnaire` / `chauffeur`)
- Rate limiting sur les routes sensibles
- Headers de sécurité (Helmet.js)
- Journal d'activité complet (audit trail)
- Corbeille avec restauration possible
- Gestion des comptes utilisateurs

---

## 🛠️ Stack technique

### Frontend
| Technologie | Version | Usage |
|-------------|---------|-------|
| React | 19.x | Framework UI |
| TypeScript | 6.x | Typage statique strict |
| Tailwind CSS | 3.x | Styles utilitaires |
| Recharts | 3.x | Graphiques et visualisations |
| Leaflet.js | 1.x | Carte interactive |
| React Router | 7.x | Navigation SPA |
| Axios | 1.x | Client HTTP |

### Backend
| Technologie | Version | Usage |
|-------------|---------|-------|
| Node.js | 20.x | Runtime JavaScript |
| Express.js | 5.x | Framework API REST |
| PostgreSQL | 15.x | Base de données relationnelle |
| JWT | 9.x | Authentification stateless |
| bcrypt.js | 3.x | Hashage des mots de passe |
| PDFKit | 0.x | Génération de PDF |
| ExcelJS | 4.x | Export Excel stylisé |
| Helmet.js | 8.x | Sécurité HTTP |

### APIs externes (100% gratuites)
| API | Usage |
|-----|-------|
| Nominatim (OpenStreetMap) | Autocomplétion et géocodage des villes |
| OSRM | Calcul d'itinéraires routiers réels |
| Carto | Tuiles cartographiques (thème sombre) |

### Déploiement
| Service | Usage |
|---------|-------|
| Vercel | Frontend — CDN mondial, HTTPS automatique |
| Render | Backend — Node.js hébergé |
| Neon.tech | PostgreSQL serverless cloud |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           FRONTEND (Vercel)                  │
│         React 19 + TypeScript                │
│    25 pages · Services · Hooks · Types       │
└──────────────────┬──────────────────────────┘
                   │ HTTPS / REST API + JWT
┌──────────────────▼──────────────────────────┐
│            BACKEND (Render)                  │
│          Node.js 20 + Express 5              │
│   21+ routes · Controllers · Models          │
│   JWT Auth · RBAC · Rate Limiting            │
└──────────────────┬──────────────────────────┘
                   │ SSL / pg pool
┌──────────────────▼──────────────────────────┐
│          BASE DE DONNÉES (Neon)              │
│         PostgreSQL 15 serverless             │
│     17 tables · 30+ index · 1 vue           │
└─────────────────────────────────────────────┘
```

---

## 🚀 Démo rapide

### Application live
🔗 **https://transiflow-zeta.vercel.app**

> ⚠️ Le backend est hébergé sur Render (plan gratuit). Le premier chargement peut prendre **30 secondes** si le service est en veille.

### Comptes de démonstration

| Rôle | Email | Mot de passe | Accès |
|------|-------|--------------|-------|
| 👑 Administrateur | admin@transiflow.app | Admin123! | Tout |
| 📋 Gestionnaire | gestionnaire@transiflow.app | Gest123! | Missions, clients, rapports |
| 🚛 Chauffeur | chauffeur@transiflow.app | Chauf123! | Ses missions uniquement |

### Parcours de démo recommandé

```
🔑 1. Connexion admin@transiflow.app
📊 2. Dashboard    → KPIs et graphiques temps réel
🚛 3. Flotte       → Ajouter / modifier un véhicule
👤 4. Chauffeurs   → Profils et alertes permis
📋 5. Missions     → Créer avec autocomplétion ville
🗺️ 6. Suivi        → Carte avec camions animés
🏢 7. Clients      → Créer un client + contrat
💰 8. Factures     → Générer et télécharger un PDF
📊 9. Rapports     → Rentabilité et performance
```

---

## 💻 Installation locale

### Prérequis

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm >= 9

### 1. Cloner le projet

```bash
git clone https://github.com/zomanorj/Gestion_flotte.git
cd Gestion_flotte
```

### 2. Base de données

```bash
psql -U postgres -c "CREATE DATABASE transport_stta;"
psql -U postgres -d transport_stta -f server/db/export_schema.sql
```

### 3. Configuration backend

```bash
cd server
cp .env.production.example .env
# Éditer .env : DATABASE_URL, JWT_SECRET, CLIENT_URL
npm install
```

### 4. Configuration frontend

```bash
cd ../client
cp .env.example .env
# Vérifier : VITE_API_URL=http://localhost:5000
npm install
```

### 5. Lancement

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000 |
| Health check | http://localhost:5000/api/health |

---

## 📁 Structure du projet

```
Gestion_flotte/
├── client/                    # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/        # Composants réutilisables
│   │   │   ├── ui/            # ConfirmModal, EmptyState...
│   │   │   ├── missions/      # MissionFormModal
│   │   │   ├── factures/      # FactureFormModal, PaiementModal
│   │   │   ├── clients/       # ClientFormModal
│   │   │   └── utilisateurs/  # UtilisateurFormModal
│   │   ├── contexts/          # AuthContext (JWT)
│   │   ├── hooks/             # usePageTitle, useConfirm
│   │   ├── pages/             # 25 pages (routes)
│   │   ├── services/          # Appels API via Axios
│   │   ├── types/             # Interfaces TypeScript
│   │   └── utils/             # formatMGA, formatDateFR
│   ├── .env.example
│   └── vercel.json            # Rewrites React Router
│
├── server/                    # Backend Node.js + Express
│   ├── controllers/           # Logique métier HTTP
│   ├── db/
│   │   ├── migrations/        # 16 migrations SQL idempotentes
│   │   ├── seed.js            # Données de test
│   │   └── export_schema.sql  # Schéma complet production
│   ├── middleware/            # authMiddleware, logMiddleware
│   ├── models/               # Requêtes PostgreSQL
│   ├── routes/               # 21+ fichiers de routes
│   ├── .env.production.example
│   └── Procfile              # Démarrage Render
│
├── DEPLOY.md                  # Guide déploiement complet
└── README.md                  # Ce fichier
```

---

## 🔌 API Documentation

### Base URL

```
Production : https://transiflow-api.onrender.com
Local      : http://localhost:5000
```

### Authentification

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@transiflow.app",
  "motDePasse": "Admin123!"
}
```

**Réponse :**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "nom": "Administrateur", "role": "admin" }
}
```

Toutes les routes protégées nécessitent le header :
```http
Authorization: Bearer <token>
```

### Routes principales

| Méthode | Route | Description | Rôle |
|---------|-------|-------------|------|
| `POST` | `/api/auth/login` | Connexion | Public |
| `GET` | `/api/vehicles` | Liste véhicules | Tous |
| `GET` | `/api/drivers` | Liste chauffeurs | Tous |
| `GET` | `/api/missions` | Liste missions | Tous |
| `GET` | `/api/clients` | Liste clients | Tous |
| `GET` | `/api/factures` | Liste factures | Tous |
| `GET` | `/api/stats/dashboard` | KPIs dashboard | Tous |
| `GET` | `/api/tracking/active` | Positions GPS actives | Tous |
| `GET` | `/api/documents/bon-livraison/:id` | PDF bon de livraison | Tous |
| `GET` | `/api/rapports/rentabilite` | Rapport rentabilité | Admin/Gest |
| `GET` | `/api/corbeille/count` | Compteur corbeille | Admin |
| `GET` | `/api/activite` | Journal d'activité | Admin |
| `GET` | `/api/health` | Statut serveur | Public |

---

## 👨‍💻 Auteur

<div align="center">

**Manoa RAJAONAH**

Étudiant en L3 Informatique — Arovy University · Madagascar · 2026

[![Email](https://img.shields.io/badge/Email-manoarajaonah05@gmail.com-red?style=flat-square&logo=gmail)](mailto:manoarajaonah05@gmail.com)
[![GitHub](https://img.shields.io/badge/GitHub-zomanorj-black?style=flat-square&logo=github)](https://github.com/zomanorj)

*Projet développé dans le cadre d'une candidature de stage chez NP AKADIN / STTA Madagascar — Mai 2026*

</div>

---

<div align="center">

⭐ **Si ce projet vous a intéressé, n'hésitez pas à mettre une étoile sur GitHub !**

Made with ❤️ in Madagascar 🇲🇬

</div>
