/**
 * seed.js
 * Script de création des comptes utilisateurs de test — TransiFlow.
 *
 * Exécuter depuis le dossier server/ :
 *   node db/seed.js
 *
 * Pré-requis : fichier .env présent avec DATABASE_URL valide.
 * Ce fichier peut être commité : il ne contient que des mots de passe de test.
 */

const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
require('dotenv').config()

/* ── Connexion directe à PostgreSQL (hors pool serveur) ── */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
})

/* ── Comptes à créer ou mettre à jour ──────────────────────────────────────
   Rôles valides : 'admin' | 'gestionnaire' | 'chauffeur'
   (correspond aux rôles déclarés dans authMiddleware.js)
   ── */
const comptes = [
  {
    nom:        'Administrateur',
    email:      'admin@transiflow.app',
    motDePasse: 'Admin123!',
    role:       'admin',
  },
  {
    nom:        'Gestionnaire',
    email:      'gestionnaire@transiflow.app',
    motDePasse: 'Gest123!',
    role:       'gestionnaire',   // ⚠ 'dispatcher' n'existe pas — rôle correct : 'gestionnaire'
  },
  {
    nom:        'Chauffeur Test',
    email:      'chauffeur@transiflow.app',
    motDePasse: 'Chauf123!',
    role:       'chauffeur',
  },
]

/* ── Fonction principale ─────────────────────────────────────────────────── */
async function creerComptes() {
  console.log('🌱 Seed TransiFlow — création des comptes de test\n')

  try {
    for (const compte of comptes) {
      /* Hasher le mot de passe avec bcrypt (coût 10, recommandé OWASP) */
      const hash = await bcrypt.hash(compte.motDePasse, 10)

      /* INSERT … ON CONFLICT : crée le compte ou le remet à zéro si déjà existant */
      await pool.query(
        `INSERT INTO users (nom, email, mot_de_passe, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email)
         DO UPDATE SET
           mot_de_passe = EXCLUDED.mot_de_passe,
           role         = EXCLUDED.role,
           nom          = EXCLUDED.nom`,
        [compte.nom, compte.email, hash, compte.role]
      )

      console.log(`  ✅ [${compte.role.padEnd(12)}] ${compte.email}`)
    }

    /* ── Vérification finale : afficher les comptes présents en base ── */
    const result = await pool.query(
      'SELECT id, nom, email, role, created_at FROM users ORDER BY id'
    )
    console.log('\nComptes présents dans la table users :')
    console.table(result.rows)

  } catch (err) {
    console.error('\n❌ Erreur lors du seed :', err.message)
    process.exit(1)
  } finally {
    await pool.end()
    console.log('Connexion fermée. Seed terminé.')
  }
}

creerComptes()
