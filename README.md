# 🚛 Système de Gestion de Transport — STTA / NP AKADIN

## 📋 Présentation

Application web full-stack de gestion de flotte de transport développée dans le cadre d'un stage L3 Informatique chez **NP AKADIN / STTA Madagascar**.

Le système permet de gérer l'intégralité des opérations de transport :
- Suivi de la flotte de véhicules et de leurs documents
- Gestion des chauffeurs et de leurs permis
- Planification et suivi des missions de livraison
- Suivi GPS en temps réel des véhicules en mission
- Génération de documents PDF (bons de livraison, rapports)
- Export Excel des données avec statistiques analytiques

## 🛠 Stack technique

| Technologie  | Version | Usage                         |
|-------------|---------|-------------------------------|
| React       | 18.x    | Interface utilisateur          |
| TypeScript  | 5.x     | Typage statique               |
| Tailwind CSS| 3.x     | Styles utilitaires            |
| Vite        | 5.x     | Bundler et dev server         |
| Node.js     | 20.x    | Runtime backend               |
| Express     | 4.x     | API REST                      |
| PostgreSQL  | 15.x    | Base de données relationnelle |
| Recharts    | 2.x     | Graphiques interactifs        |
| Leaflet.js  | 1.x     | Carte interactive GPS         |
| PDFKit      | 0.x     | Génération de PDF             |
| ExcelJS     | 4.x     | Export de fichiers Excel      |
| JWT         | 9.x     | Authentification              |

## ✅ Prérequis

- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

## 🚀 Installation et lancement

### 1. Cloner le projet

```bash
git clone [url-repo]
cd GESTION-FLOTTE
```

### 2. Configuration de la base de données

```bash
psql -U postgres
CREATE DATABASE transport_stta;
\q
psql -U postgres -d transport_stta -f server/db/schema.sql
psql -U postgres -d transport_stta -f server/db/seed.sql
```

### 3. Configuration des variables d'environnement

```bash
cd server
cp .env.example .env
```

Contenu du fichier `.env` :

```env
PORT=5000
DATABASE_URL=postgresql://postgres:motdepasse@localhost:5432/transport_stta
JWT_SECRET=votre_secret_jwt_tres_long_et_aleatoire
NODE_ENV=development
```

### 4. Installation des dépendances

```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 5. Lancement

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

- Frontend : [http://localhost:5173](http://localhost:5173)
- Backend  : [http://localhost:5000](http://localhost:5000)

## 👤 Comptes de test

| Email                | Mot de passe | Rôle           |
|----------------------|--------------|----------------|
| admin@stta.mg        | Admin123!    | Administrateur |
| gestionnaire@stta.mg | Gest123!     | Gestionnaire   |
| chauffeur@stta.mg    | Chauf123!    | Chauffeur      |

## 📁 Structure du projet

```
GESTION-FLOTTE/
├── client/                    Frontend React + TypeScript
│   └── src/
│       ├── components/        Composants réutilisables
│       │   ├── drivers/       Modal chauffeur
│       │   ├── missions/      Modal mission + stepper statut
│       │   ├── ui/            EmptyState et autres UI
│       │   └── vehicles/      Modal véhicule
│       ├── contexts/          AuthContext (état d'authentification)
│       ├── hooks/             useVehicles, useDrivers, useMissions
│       ├── layouts/           DashboardLayout (sidebar + header)
│       ├── pages/             Pages de l'application
│       ├── services/          Appels API (axios)
│       │   ├── api.ts         Instance axios centralisée
│       │   ├── vehicleService.ts
│       │   ├── driverService.ts
│       │   ├── missionService.ts
│       │   ├── documentService.ts
│       │   ├── trackingService.ts
│       │   ├── statsService.ts
│       │   └── exportService.ts
│       ├── types/             Interfaces TypeScript
│       └── utils/             Fonctions utilitaires
└── server/                    Backend Node.js + Express
    ├── controllers/           Logique métier
    ├── db/                    Schema SQL et seeds
    │   ├── schema.sql
    │   ├── seed.sql
    │   └── migrations/
    ├── middleware/            Auth JWT et RBAC
    ├── models/                Requêtes SQL
    └── routes/                Définition des routes API
```

## 🎯 Fonctionnalités par module

### 🚗 Gestion de la flotte
- CRUD complet des véhicules (camion, citerne, pickup, autre)
- Suivi du kilométrage et de la capacité de charge
- Gestion des documents (assurance, visite technique)
- Alertes automatiques pour les documents expirant sous 30 jours
- Archivage (soft delete)

### 👨‍✈️ Gestion des chauffeurs
- CRUD complet des chauffeurs
- Suivi des permis de conduire et dates d'expiration
- Alertes automatiques pour les permis expirant
- Vérification de disponibilité pour les missions
- Statuts : actif, en congé, inactif

### 📋 Missions de transport
- Planification des missions avec assignation véhicule + chauffeur
- Workflow de statuts : Brouillon → Planifiée → En cours → Terminée
- Détection des conflits (véhicule/chauffeur déjà assigné)
- Vue calendrier hebdomadaire
- Filtres avancés par statut, date, véhicule, chauffeur

### 🗺️ Suivi GPS en temps réel
- Carte interactive Leaflet avec positions en direct
- Liste des véhicules en mission avec statut
- Mise à jour automatique toutes les 10 secondes
- Marqueurs personnalisés par statut de mission

### 📄 Documents
- Génération automatique de bons de livraison PDF
- Rapports de missions sur période personnalisable
- Téléchargement direct depuis l'interface

### 📊 Rapports & Exports
- Tableau de bord avec KPIs en temps réel
- Graphiques d'activité (LineChart, BarChart, PieChart) via Recharts
- Statistiques par période (7j, 30j, 3 mois, personnalisé)
- Export Excel des missions, véhicules et chauffeurs
- Fichiers .xlsx stylisés avec couleurs et totaux

### 🔐 Authentification & Sécurité
- Authentification JWT (JSON Web Token)
- Contrôle d'accès par rôle (RBAC)
- Sessions persistantes via localStorage
- Expiration automatique des tokens

## 📸 Captures d'écran

> Dashboard | Flotte | Chauffeurs | Missions | Suivi GPS | Rapports

## 👨‍💻 Auteur

Développé dans le cadre d'un **stage L3 Informatique**
NP AKADIN / STTA Madagascar — 2025

---

*Projet académique — Stage de fin d'études L3 Informatique*
