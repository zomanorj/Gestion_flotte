# 🚗 Système de Gestion de Flotte

> Projet réalisé dans le cadre d'une recherche de stage — L3 Informatique  
> Étudiant : Manoa | Antananarivo, Madagascar

## 🛠️ Technologies

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwind-css)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet)

## ✨ Fonctionnalités

- Gestion des véhicules (CRUD + alertes maintenance)
- Gestion des chauffeurs
- Création et suivi de missions
- Dashboard avec statistiques en temps réel
- Carte interactive centrée sur Madagascar
- Export PDF et Excel des rapports

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

# 2. Importer la base de données
mysql -u root -p < database/schema.sql

# 3. Configurer le backend
cp server/.env.example server/.env
# Éditer server/.env avec vos identifiants MySQL

# 4. Démarrer le backend
cd server
npm install
npm start

# 5. Démarrer le frontend (dans un autre terminal)
cd client
npm install
npm run dev

# 6. Ouvrir dans le navigateur
# http://localhost:5173
```

## 🔑 Comptes de test

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@flotte.mg | password123 | Admin |
| gestionnaire@flotte.mg | password123 | Gestionnaire |
| chauffeur@flotte.mg | password123 | Chauffeur |

## 📁 Structure du projet

```
flotte-app/
├── database/         # Script SQL (schema + données de test)
├── server/           # API REST Node.js + Express
│   ├── config/       # Connexion base de données
│   ├── controllers/  # Logique métier
│   ├── middleware/   # Authentification JWT
│   └── routes/       # Définition des endpoints
└── client/           # Application React
    └── src/
        ├── components/ # Composants réutilisables
        ├── context/    # Contexte d'authentification
        ├── pages/      # Pages de l'application
        └── services/   # Appels API axios
```

## 👤 Auteur

**Manoa** — Étudiant L3 Informatique — Antananarivo, Madagascar
