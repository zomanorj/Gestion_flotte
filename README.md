# CamionApp — Système de Gestion de Flotte

> Projet réalisé dans le cadre d'une recherche de stage — L3 Informatique
> Étudiant : Manoa | Antananarivo, Madagascar

---

## Technologies

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white&style=flat-square)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white&style=flat-square)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwind-css&logoColor=white&style=flat-square)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white&style=flat-square)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white&style=flat-square)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white&style=flat-square)
![FullCalendar](https://img.shields.io/badge/FullCalendar-6-4285F4?style=flat-square)
![PDFKit](https://img.shields.io/badge/PDFKit-PDF-red?style=flat-square)

---

## Modules

### Gestion de la flotte
| Module | Description |
|--------|-------------|
| **Camions** | CRUD complet — immatriculation, marque, modèle, tonnage, kilométrage, statut, alertes maintenance |
| **Chauffeurs** | CRUD — numéro de permis, statut disponibilité, historique missions par chauffeur |
| **Missions** | Workflow planifiée → en cours → terminée/annulée, calcul distance automatique via ORS, coût carburant en Ariary, sélection client optionnelle |

### Suivi en temps réel
| Module | Description |
|--------|-------------|
| **Carte globale** | Tous les camions en mission sur une carte Leaflet centrée Madagascar, position mise à jour via Socket.io, boutons de vitesse x1/x5/x10/x30/x60 globale et par camion |
| **Simulation** | Simulation de trajet GPS avec événements aléatoires (pauses, incidents), calcul de route via OpenRouteService |

### Finances et opérations
| Module | Description |
|--------|-------------|
| **Carburant** | Suivi des pleins — litres, prix/litre, coût total (Ar), station, kilométrage, consommation réelle, stats mensuelles |
| **Dépenses** | Suivi par catégorie (péage, amende, lavage, pneus, pièces, main-d'œuvre, parking, divers), stats par véhicule et évolution mensuelle |
| **Bon de livraison** | Génération PDF (PDFKit) — en-tête, trajet, camion, chauffeur, client, zone signatures |

### Administration
| Module | Description |
|--------|-------------|
| **Documents** | Gestion des documents administratifs (carte grise, assurance, vignette, visite technique, autorisation transport), alertes d'expiration avec badges Sidebar |
| **Maintenances** | Planification (vidange, freins, pneus, courroie, filtres, révision générale), priorités (faible/normale/haute/urgente avec animate-pulse), modal de clôture avec coût réel |
| **Clients** | CRUD entreprises et particuliers, historique des missions par client |
| **Planning** | Calendrier FullCalendar — vues mois/semaine/jour, couleurs par statut, popup détail au clic |
| **Rapports** | Filtrage par période, export PDF (jsPDF) et Excel (SheetJS) |

### Sécurité
| Module | Description |
|--------|-------------|
| **Authentification** | JWT avec 3 rôles : admin (tout), gestionnaire (CRUD sans suppression), chauffeur (lecture seule) |

---

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

# 2. Initialiser la base de données principale
mysql -u root -p < database/schema.sql

# 3. Appliquer les migrations des modules
mysql -u root -p flotte_db < database/migrate_modules.sql
mysql -u root -p flotte_db < database/migrate_maintenances.sql
mysql -u root -p flotte_db < database/migrate_clients.sql

# 4. Configurer le backend
cp server/.env.example server/.env
# Éditer server/.env — renseigner DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET

# 5. Démarrer le backend
cd server
npm install
npm run dev        # nodemon (rechargement auto)
# ou npm start     # node classique

# 6. Démarrer le frontend (nouveau terminal)
cd client
npm install
npm run dev

# 7. Ouvrir dans le navigateur
# http://localhost:5173
```

### Variables d'environnement (`server/.env`)

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=ton_mot_de_passe
DB_NAME=flotte_db
JWT_SECRET=une_chaine_secrete_longue
PORT=5000
CLIENT_URL=http://localhost:5173
```

---

## Comptes de test

| Email | Mot de passe | Rôle | Permissions |
|-------|-------------|------|-------------|
| admin@flotte.mg | password123 | Admin | CRUD complet + suppression |
| gestionnaire@flotte.mg | password123 | Gestionnaire | Création et modification |
| chauffeur@flotte.mg | password123 | Chauffeur | Lecture seule |

> Pour régénérer les hash bcrypt :
> ```bash
> node -e "require('bcrypt').hash('password123',10).then(console.log)"
> ```

---

## Flotte de démonstration

| Immatriculation | Marque | Modèle | Tonnage | Statut |
|----------------|--------|--------|---------|--------|
| MAD-001-24 | Toyota | HiLux | — | disponible |
| MAD-002-24 | Mitsubishi | L200 | — | disponible |
| MAD-003-23 | Ford | Ranger | — | disponible |
| MAD-004-22 | Nissan | Navara | — | disponible |

---

## Structure du projet

```
flotte-app/
├── database/
│   ├── schema.sql                    # Tables principales + données initiales
│   ├── migrate_modules.sql           # Tables carburant, dépenses, documents
│   ├── migrate_maintenances.sql      # Table maintenances_planifiees
│   └── migrate_clients.sql           # Table clients + colonne missions.client_id
│
├── server/                           # API REST Node.js + Express + Socket.io
│   ├── index.js                      # Point d'entrée, montage des routes
│   ├── config/db.js                  # Pool de connexions MySQL2
│   ├── middleware/authMiddleware.js  # Vérification JWT + rôles
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── vehiculesController.js
│   │   ├── chauffeursController.js
│   │   ├── missionsController.js     # + getPlanning (FullCalendar)
│   │   ├── dashboardController.js
│   │   ├── documentsController.js
│   │   ├── carburantController.js
│   │   ├── depensesController.js
│   │   ├── maintenancesController.js
│   │   └── clientsController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── vehicules.js
│   │   ├── chauffeurs.js
│   │   ├── missions.js               # + GET /planning + GET /:id/bon-livraison
│   │   ├── dashboard.js
│   │   ├── simulation.js
│   │   ├── documents.js
│   │   ├── carburant.js
│   │   ├── depenses.js
│   │   ├── maintenances.js
│   │   └── clients.js
│   └── services/
│       ├── simulationService.js      # Simulation GPS temps réel
│       ├── routeService.js           # Calcul de route via OpenRouteService
│       ├── evenementService.js       # Événements aléatoires (pauses, incidents)
│       └── bonLivraisonService.js    # Génération PDF (PDFKit)
│
└── client/                           # Application React 18 + Vite + TailwindCSS
    └── src/
        ├── components/
        │   ├── Sidebar.jsx           # Navigation + badges alertes
        │   ├── Navbar.jsx
        │   ├── Modal.jsx
        │   ├── StatCard.jsx
        │   ├── AlerteBadge.jsx
        │   └── Toast.jsx             # Notifications toast + hook useToast
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx         # Stats + graphique missions + raccourci carte
            ├── Vehicules.jsx
            ├── Chauffeurs.jsx
            ├── Missions.jsx          # Distance auto + toast démarrage + PDF
            ├── CarteGlobale.jsx      # Carte temps réel + contrôles vitesse
            ├── Documents.jsx         # Alertes expiration
            ├── Carburant.jsx         # KPI + tableau + modal
            ├── Depenses.jsx          # KPI + tableau + badges catégorie
            ├── Maintenances.jsx      # Alertes urgentes + modal clôture
            ├── Planning.jsx          # FullCalendar mois/semaine/jour
            ├── Clients.jsx           # CRUD + historique missions
            └── Rapports.jsx          # Export PDF et Excel
```

---

## API — Endpoints principaux

### Auth
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/login` | — | Connexion, retourne un token JWT |
| GET | `/api/auth/profil` | ✓ | Profil de l'utilisateur connecté |

### Véhicules
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/vehicules` | — | Liste des camions (filtre `?statut=`) |
| GET | `/api/vehicules/alertes` | — | Camions nécessitant une maintenance |
| POST | `/api/vehicules` | gestionnaire | Créer un camion |
| PUT | `/api/vehicules/:id` | gestionnaire | Modifier un camion |
| DELETE | `/api/vehicules/:id` | admin | Supprimer un camion |

### Missions
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/missions` | — | Liste (filtres `?statut=&debut=&fin=`) |
| GET | `/api/missions/planning` | — | Format FullCalendar avec couleurs statut |
| POST | `/api/missions` | gestionnaire | Créer une mission |
| PUT | `/api/missions/:id/statut` | gestionnaire | Changer le statut |
| DELETE | `/api/missions/:id` | admin | Supprimer (remet camion/chauffeur dispo) |
| GET | `/api/missions/:id/bon-livraison` | ✓ | Télécharger le PDF |

### Documents
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/documents` | Liste (filtres `?vehicule_id=&type=`) |
| GET | `/api/documents/alertes` | Expirés ou expirant dans 30 jours |
| POST/PUT/DELETE | `/api/documents` | CRUD |

### Carburant
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/carburant` | Liste (filtres `?vehicule_id=&debut=&fin=`) |
| GET | `/api/carburant/stats` | Totaux, répartition, évolution mensuelle |
| POST/PUT/DELETE | `/api/carburant` | CRUD |

### Dépenses
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/depenses` | Liste (filtres `?vehicule_id=&categorie=&debut=&fin=`) |
| GET | `/api/depenses/stats` | Totaux mois/année, répartition, évolution |
| POST/PUT/DELETE | `/api/depenses` | CRUD |

### Maintenances
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/maintenances` | Liste (filtres `?statut=&priorite=&vehicule_id=`) |
| GET | `/api/maintenances/alertes` | Urgentes, dépassées, km atteint |
| POST/PUT | `/api/maintenances` | Créer / Modifier |
| PUT | `/api/maintenances/:id/terminer` | Clôturer avec date réelle + coût |
| DELETE | `/api/maintenances/:id` | Supprimer |

### Clients
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/clients` | Liste avec nombre de missions |
| GET | `/api/clients/:id/missions` | Historique missions d'un client |
| POST/PUT/DELETE | `/api/clients` | CRUD |

### Simulation (temps réel)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/simulation/demarrer/:id` | Lancer la simulation GPS d'une mission |
| POST | `/api/simulation/vitesse/:id` | Changer le multiplicateur de vitesse |
| GET | `/api/simulation/villes` | Liste des villes de Madagascar |
| POST | `/api/simulation/route` | Calculer distance + durée via ORS |

---

## Auteur

**Manoa** — Étudiant L3 Informatique — Antananarivo, Madagascar
