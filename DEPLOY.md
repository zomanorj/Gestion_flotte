# Guide de déploiement — TransiFlow

Stack : **Neon.tech** (PostgreSQL) · **Render** (Backend) · **Vercel** (Frontend)

---

## 1. Base de données — Neon.tech (gratuit)

1. Aller sur https://neon.tech et créer un compte gratuit
2. Créer un nouveau projet → nommer le projet `transiflow`
3. Copier la **connection string** (format) :
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Ouvrir l'onglet **SQL Editor** dans le dashboard Neon
5. Coller tout le contenu de `server/db/export_schema.sql` et exécuter
6. Vérifier : la liste des tables doit apparaître dans le panneau gauche

> Comptes créés automatiquement :
> - `admin@transiflow.app` / `Admin123!`
> - `gestionnaire@transiflow.app` / `Gest123!`
> - `chauffeur@transiflow.app` / `Chauf123!`

---

## 2. Backend — Render (gratuit)

1. Aller sur https://render.com et créer un compte gratuit
2. Cliquer **New → Web Service**
3. Connecter le dépôt GitHub `zomanorj/Gestion_flotte`
4. Paramètres :

   | Champ | Valeur |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `node server.js` |

5. Section **Environment Variables** — ajouter :

   | Clé | Valeur |
   |---|---|
   | `DATABASE_URL` | Connection string Neon copiée à l'étape 1 |
   | `JWT_SECRET` | Chaîne aléatoire 64+ caractères (ex: générer sur https://generate-secret.vercel.app/64) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_URL` | `https://transiflow.vercel.app` *(adapter selon URL Vercel réelle)* |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |

6. Cliquer **Create Web Service** — attendre 5-10 minutes
7. Copier l'URL de déploiement : `https://transiflow-api.onrender.com`

> ⚠️ Plan gratuit Render : le service se met en veille après 15 min d'inactivité.
> Premier chargement peut prendre ~30s. Utiliser https://uptimerobot.com pour maintenir le service actif.

---

## 3. Frontend — Vercel (gratuit)

1. Aller sur https://vercel.com et créer un compte gratuit
2. Cliquer **Add New → Project**
3. Importer le dépôt GitHub `zomanorj/Gestion_flotte`
4. Paramètres :

   | Champ | Valeur |
   |---|---|
   | Root Directory | `client` |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

5. Section **Environment Variables** — ajouter :

   | Clé | Valeur |
   |---|---|
   | `VITE_API_URL` | URL Render copiée à l'étape 2 (ex: `https://transiflow-api.onrender.com`) |

6. Cliquer **Deploy** — attendre 2-3 minutes
7. URL finale : `https://transiflow.vercel.app`

> Note : le fichier `client/vercel.json` configure les redirections React Router.
> Sans lui, les routes `/vehicles`, `/missions` etc. retourneraient 404.

---

## 4. Vérification finale

Après les 3 déploiements :

- [ ] `https://transiflow.vercel.app` charge la page de login
- [ ] Connexion avec `admin@transiflow.app` / `Admin123!` fonctionne
- [ ] Redirection vers le dashboard après login
- [ ] Le dashboard affiche les statistiques
- [ ] Créer un véhicule fonctionne
- [ ] Créer une mission fonctionne

---

## 5. Mettre à jour après modifications

```bash
# Pousser les modifications sur GitHub
git add -A
git commit -m "feat: ..."
git push origin main
```

Render et Vercel se redéploient automatiquement après chaque push sur `main`.

---

## 6. Variables d'environnement locales

Fichiers à créer localement (non committés) :

**`server/.env`** :
```env
PORT=5000
DATABASE_URL=postgresql://postgres:motdepasse@localhost:5432/transport_stta
JWT_SECRET=stta_dev_jwt_secret_key_2024
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**`client/.env`** (ou `.env.local`) :
```env
VITE_API_URL=http://localhost:5000
```
