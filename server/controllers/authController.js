/**
 * authController.js
 * Contrôleur gérant toute la logique d'authentification : inscription, connexion,
 * et récupération du profil de l'utilisateur connecté.
 *
 * Fonctions exportées :
 *   - register : créer un nouveau compte utilisateur
 *   - login    : vérifier les identifiants et retourner un token JWT
 *   - getMe    : retourner le profil de l'utilisateur actuellement connecté
 */

const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const pool   = require('../db/connection')

// Coût du hachage bcrypt : chaque incrément double le temps de calcul.
// 10 est le minimum recommandé par OWASP pour un bon compromis sécurité/performance.
const COUT_HACHAGE_BCRYPT = 10

// Durée de validité du token JWT — lit JWT_EXPIRES_IN depuis .env, défaut 7 jours
const DUREE_TOKEN_JWT = process.env.JWT_EXPIRES_IN || '7d'


// ─────────────────────────────────────────────────────────────────────────────
// REGISTER — Créer un nouveau compte utilisateur
// ─────────────────────────────────────────────────────────────────────────────

/**
 * register
 * Crée un nouveau compte avec l'email, le nom et le mot de passe fournis.
 * Le mot de passe est TOUJOURS haché avant stockage en base (jamais en clair).
 *
 * Body attendu : { nom, email, motDePasse, role? }
 * Réponse 201  : { message, user: { id, nom, email, role } }
 * Réponse 409  : email déjà utilisé
 * Réponse 400  : champs obligatoires manquants
 */
const register = async (req, res) => {
  const { nom, email, motDePasse, role } = req.body

  // Validation basique des champs obligatoires
  if (!nom || !email || !motDePasse) {
    return res.status(400).json({
      message: 'Les champs nom, email et motDePasse sont obligatoires',
    })
  }

  try {
    // Vérifier qu'un compte avec cet email n'existe pas déjà
    const resultatEmail = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    if (resultatEmail.rows.length > 0) {
      return res.status(409).json({
        message: 'Un compte existe déjà avec cet email',
      })
    }

    // Hacher le mot de passe avant de le stocker
    // bcrypt.hash est asynchrone et sûr — ne jamais utiliser bcrypt.hashSync en production
    const motDePasseHache = await bcrypt.hash(motDePasse, COUT_HACHAGE_BCRYPT)

    // Insérer le nouvel utilisateur en base
    // RETURNING évite une 2e requête SELECT pour récupérer l'utilisateur créé
    const resultatInsertion = await pool.query(
      `INSERT INTO users (nom, email, mot_de_passe, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nom, email, role, created_at`,
      [
        nom.trim(),
        email.toLowerCase().trim(),
        motDePasseHache,
        role || 'gestionnaire', // Rôle par défaut si non précisé
      ]
    )

    const nouvelUtilisateur = resultatInsertion.rows[0]

    return res.status(201).json({
      message: 'Compte créé avec succès',
      user: nouvelUtilisateur,
    })
  } catch (erreur) {
    console.error('[register] Erreur :', erreur.message)
    return res.status(500).json({
      message: 'Erreur serveur lors de la création du compte',
    })
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// LOGIN — Vérifier les identifiants et retourner un token JWT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * login
 * Authentifie un utilisateur en vérifiant son email et son mot de passe.
 * En cas de succès, retourne un token JWT signé et les infos de l'utilisateur.
 *
 * Body attendu : { email, motDePasse }
 * Réponse 200  : { token, user: { id, nom, email, role } }
 * Réponse 401  : identifiants incorrects (message volontairement vague pour la sécurité)
 */
const login = async (req, res) => {
  const { email, motDePasse } = req.body

  if (!email || !motDePasse) {
    return res.status(400).json({
      message: 'Email et mot de passe requis',
    })
  }

  try {
    // Recherche de l'utilisateur par email (insensible à la casse)
    const resultat = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    const utilisateur = resultat.rows[0]

    // Sécurité : même message d'erreur si email inconnu ou mot de passe incorrect
    // Cela évite de révéler quels emails sont enregistrés (énumération d'utilisateurs)
    if (!utilisateur) {
      return res.status(401).json({
        message: 'Email ou mot de passe incorrect',
      })
    }

    // Comparaison sécurisée du mot de passe fourni avec le hash stocké
    const motDePasseCorrect = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe)

    if (!motDePasseCorrect) {
      return res.status(401).json({
        message: 'Email ou mot de passe incorrect',
      })
    }

    // Génération du token JWT signé avec la clé secrète
    // Le payload contient les infos minimales nécessaires (pas le mot de passe !)
    const tokenJWT = jwt.sign(
      {
        id:    utilisateur.id,
        email: utilisateur.email,
        role:  utilisateur.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: DUREE_TOKEN_JWT }
    )

    return res.json({
      token: tokenJWT,
      user: {
        id:    utilisateur.id,
        nom:   utilisateur.nom,
        email: utilisateur.email,
        role:  utilisateur.role,
      },
    })
  } catch (erreur) {
    console.error('[login] Erreur :', erreur.message)
    return res.status(500).json({
      message: 'Erreur serveur lors de la connexion',
    })
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// GET ME — Retourner le profil de l'utilisateur connecté
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getMe
 * Retourne les informations de l'utilisateur identifié par son token JWT.
 * req.user est injecté par authMiddleware avant l'appel de cette fonction.
 *
 * Réponse 200  : { user: { id, nom, email, role, created_at } }
 * Réponse 404  : utilisateur supprimé entre-temps (token valide mais user inexistant)
 */
const getMe = async (req, res) => {
  try {
    // req.user.id est extrait du token JWT par authMiddleware
    const resultat = await pool.query(
      'SELECT id, nom, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    )

    if (resultat.rows.length === 0) {
      return res.status(404).json({
        message: 'Utilisateur introuvable',
      })
    }

    return res.json({ user: resultat.rows[0] })
  } catch (erreur) {
    console.error('[getMe] Erreur :', erreur.message)
    return res.status(500).json({
      message: 'Erreur serveur',
    })
  }
}


module.exports = { register, login, getMe }
