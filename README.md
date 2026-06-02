# FlotteApp — Système de Gestion de Flotte

> Projet de portfolio réalisé en L3 Informatique — Antananarivo, Madagascar  
> Auteur : Manoa

---

## Présentation

FlotteApp est une application web full-stack de gestion de flotte de transport développée dans le contexte malgache. Elle couvre l'ensemble du cycle opérationnel d'une entreprise de transport : planification des missions, suivi des véhicules en temps réel, gestion administrative, finances et ressources humaines.

Le projet a été structuré en trois phases successives, chacune ajoutant une couche de complexité fonctionnelle et technique, de la gestion métier de base jusqu'aux modules ERP (paie, utilisateurs, notifications temps réel).

---

## Stack technique

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white&style=flat-square)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-4479A1?logo=mysql&logoColor=white&style=flat-square)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-7952B3?logo=bootstrap&logoColor=white&style=flat-square)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white&style=flat-square)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white&style=flat-square)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white&style=flat-square)
![FullCalendar](https://img.shields.io/badge/FullCalendar-6-4285F4?style=flat-square)
![PDFKit](https://img.shields.io/badge/PDFKit-PDF-red?style=flat-square)

| Couche | Technologies |
|--------|-------------|
| Frontend | React 18, Vite, Bootstrap 5, Leaflet, FullCalendar, Recharts, jsPDF, SheetJS |
| Backend | Node.js, Express 4, Socket.io 4, JWT, bcrypt, Multer, PDFKit |
| Base de données | MySQL 5.7+ (pool de connexions via mysql2) |
| Temps réel | Socket.io — simulation GPS, notifications push |
| Cartographie | Leaflet + OpenStreetMap, calcul de routes OSRM |

---

## Fonctionnalités

### Gestion de la flotte

| Module | Détail |
|--------|--------|
| Véhicules | CRUD complet — immatriculation, marque, modèle, tonnage, kilométrage, statut, alertes maintenance |
| Chauffeurs | CRUD — numéro de permis, catégorie, salaire de base, prime par mission, historique |
| Missions | Workflow planifiée → en cours → terminée / annulée, calcul de distance automatique via OSRM, coût carburant en Ariary, association client optionnelle |
| Clients | CRUD entreprises et particuliers, historique des missions par client |

### Suivi en temps réel

| Module | Détail |
|--------|--------|
| Carte globale | Tous les camions actifs sur une carte Leaflet centrée sur Madagascar, positions mises à jour via Socket.io, sélecteur de vitesse x1 / x5 / x10 / x30 / x60 global et par véhicule |
| Simulation GPS | Déplacement progressif le long d'une route réelle (OSRM), événements aléatoires (pauses, incidents), broadcast Socket.io vers tous les clients connectés |
| Notifications | Alertes push temps réel (expiration de documents, maintenances urgentes, démarrage de mission) persistées en base et émises via Socket.io |

### Finances et opérations

| Module | Détail |
|--------|--------|
| Carburant | Suivi des pleins — litres, prix au litre, station, kilométrage, consommation réelle calculée, statistiques mensuelles |
| Dépenses | Catégorisation (péage, amende, pneus, pièces, main-d'œuvre, parking…), statistiques par véhicule et évolution mensuelle |
| Bon de livraison | Génération PDF côté serveur (PDFKit) — en-tête, trajet, références camion / chauffeur / client, zone de signatures |
| Rapports | Filtrage par période, export PDF (jsPDF) et export Excel (SheetJS) |

### Ressources humaines et administration

| Module | Détail |
|--------|--------|
| Paie | Calcul mensuel par chauffeur : salaire de base + primes par mission + bonus kilométrique (tranches de 500 km) + cotisation CNAPS 1 % — génération du bulletin PDF |
| Utilisateurs | CRUD des comptes (admin uniquement) — activation / désactivation, réinitialisation du mot de passe, liaison avec le profil chauffeur |
| Maintenances | Planification (vidange, freins, pneus, révision…), quatre niveaux de priorité, modal de clôture avec coût réel et date effective |
| Documents | Gestion des pièces administratives (carte grise, assurance, vignette, visite technique), upload de fichier, alertes d'expiration dans la Sidebar |
| Planning | Calendrier FullCalendar — vues mois / semaine / jour, code couleur par statut, popup détail au clic |

### Sécurité

Authentification stateless par token JWT (expiration 24 h). Trois rôles appliqués côté serveur sur chaque route :

| Rôle | Permissions |
|------|-------------|
| admin | Toutes les opérations, y compris suppression et gestion des utilisateurs |
| gestionnaire | Création et modification — aucune suppression |
| chauffeur | Lecture seule |

---

## Architecture

```
flotte-app/
├── database/
│   ├── schema.sql                     # Schéma initial + données de démonstration
│   ├── migrate_modules.sql            # Carburant, dépenses, documents
│   ├── migrate_maintenances.sql       # Maintenances planifiées
│   ├── migrate_clients.sql            # Clients + client_id sur missions
│   ├── migrate_v2.sql                 # Salaires, événements, historique carburant
│   └── migrate_phase3.sql             # Utilisateurs, paie, upload, notifications
│
├── server/                            # API REST Node.js + Express + Socket.io
│   ├── index.js                       # Point d'entrée, montage des routes, config Socket.io
│   ├── config/db.js                   # Pool de connexions MySQL2
│   ├── middleware/
│   │   └── authMiddleware.js          # verifierToken + verifierRole (JWT)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── usersController.js
│   │   ├── vehiculesController.js
│   │   ├── chauffeursController.js
│   │   ├── missionsController.js      # Inclut planning FullCalendar + bon de livraison
│   │   ├── dashboardController.js
│   │   ├── documentsController.js
│   │   ├── carburantController.js
│   │   ├── depensesController.js
│   │   ├── maintenancesController.js
│   │   ├── clientsController.js
│   │   ├── paieController.js          # Calcul + PDF bulletin
│   │   └── notificationsController.js # Lecture + marquage lu + émission Socket.io
│   ├── routes/                        # Miroir des controllers
│   └── services/
│       ├── simulationService.js       # Simulation GPS temps réel
│       ├── routeService.js            # Calcul d'itinéraire OSRM
│       ├── evenementService.js        # Événements aléatoires (pauses, incidents)
│       ├── paieService.js             # Calcul salaire, primes, CNAPS
│       └── bonLivraisonService.js     # Génération PDF (PDFKit)
│
└── client/                            # Application React 18 + Vite + Bootstrap 5
    └── src/
        ├── context/
        │   └── AuthContext.jsx        # Contexte global auth + persistance localStorage
        ├── services/api.js            # Instance Axios centralisée + intercepteur JWT
        ├── components/
        │   ├── Sidebar.jsx            # Navigation + badges alertes documents/maintenances
        │   ├── Navbar.jsx
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
            ├── CarteGlobale.jsx       # Carte temps réel + contrôles vitesse
            ├── Documents.jsx
            ├── Carburant.jsx
            ├── Depenses.jsx
            ├── Maintenances.jsx
            ├── Planning.jsx
            ├── Clients.jsx
            ├── Rapports.jsx
            ├── Utilisateurs.jsx       # Gestion des comptes (admin)
            └── Paie.jsx               # Bulletins + masse salariale
```

---

## Installation

### Prérequis

- Node.js v18+
- MySQL 5.7 ou 8+
- Git

### Étapes

```bash
# 1. Cloner le projet
git clone https://github.com/zomanorj/Gestion_flotte.git
cd Gestion_flotte

# 2. Initialiser la base de données
mysql -u root -p < database/schema.sql
mysql -u root -p flotte_db < database/migrate_modules.sql
mysql -u root -p flotte_db < database/migrate_maintenances.sql
mysql -u root -p flotte_db < database/migrate_clients.sql
mysql -u root -p flotte_db < database/migrate_v2.sql
mysql -u root -p flotte_db < database/migrate_phase3.sql

# 3. Configurer le backend
cp server/.env.example server/.env
# Renseigner DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET, CLIENT_URL

# 4. Démarrer le backend
cd server && npm install && npm run dev

# 5. Démarrer le frontend (nouveau terminal)
cd client && npm install && npm run dev

# L'application est disponible sur http://localhost:5173
```

### Variables d'environnement (`server/.env`)

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=mot_de_passe
DB_NAME=flotte_db
JWT_SECRET=chaine_secrete_longue_et_aleatoire
PORT=5000
CLIENT_URL=http://localhost:5173
```

---

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@flotte.mg | password123 | Admin |
| gestionnaire@flotte.mg | password123 | Gestionnaire |
| chauffeur@flotte.mg | password123 | Chauffeur |

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

### Simulation

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/simulation/demarrer/:id` | Lancer la simulation GPS d'une mission |
| POST | `/api/simulation/vitesse/:id` | Modifier le multiplicateur de vitesse |
| GET | `/api/simulation/villes` | Liste des villes de Madagascar |
| POST | `/api/simulation/route` | Calculer distance et durée via OSRM |

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
