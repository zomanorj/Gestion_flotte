/**
 * utilisateurController.js
 * Contrôleur HTTP pour la gestion des utilisateurs — TransiFlow.
 *
 * Fonctions exportées :
 *   - getUtilisateurs    : liste paginée (admin)
 *   - getUtilisateur     : détail (admin)
 *   - createUtilisateur  : création (admin)
 *   - updateUtilisateur  : modification (admin)
 *   - reinitialiserMdp   : réinitialiser le mot de passe (admin)
 *   - desactiverCompte   : désactiver un compte (admin)
 *   - getMonProfil       : profil de l'utilisateur connecté (tous)
 *   - updateMonProfil    : modifier son propre profil (tous)
 *   - changerMonMdp      : changer son propre mot de passe (tous)
 */

const bcrypt           = require('bcryptjs')
const utilisateurModel = require('../models/utilisateurModel')
const { logActivite }  = require('../middleware/logMiddleware')

const ROLES_VALIDES = ['admin', 'gestionnaire', 'chauffeur']

// ─────────────────────────────────────────────────────────────────────────────
// getUtilisateurs
// Liste paginée avec filtres (admin uniquement).
// ─────────────────────────────────────────────────────────────────────────────

async function getUtilisateurs(req, res) {
  try {
    const { search, role, statut, page, limit } = req.query
    const resultats = await utilisateurModel.findAll({
      search,
      role,
      statut,
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 10,
    })

    res.json({
      succes: true,
      donnees: resultats.utilisateurs,
      pagination: {
        total: resultats.total,
        page:  resultats.page,
        limit: resultats.limit,
        pages: Math.ceil(resultats.total / resultats.limit),
      },
    })
  } catch (erreur) {
    console.error('❌ utilisateurController.getUtilisateurs :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération des utilisateurs' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getUtilisateur
// Détail d'un utilisateur par ID (admin uniquement).
// ─────────────────────────────────────────────────────────────────────────────

async function getUtilisateur(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const utilisateur = await utilisateurModel.findById(id)
    if (!utilisateur) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable' })

    res.json({ succes: true, donnees: utilisateur })
  } catch (erreur) {
    console.error('❌ utilisateurController.getUtilisateur :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération de l\'utilisateur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createUtilisateur
// Crée un nouvel utilisateur (admin uniquement).
// Valide : email unique, mot de passe min 8 chars, rôle valide.
// ─────────────────────────────────────────────────────────────────────────────

async function createUtilisateur(req, res) {
  try {
    const { nom, email, mot_de_passe, role, driver_id, telephone } = req.body

    // Validation des champs obligatoires
    const erreurs = []
    if (!nom || !nom.trim())          erreurs.push('Le nom est obligatoire')
    if (!email || !email.trim())      erreurs.push('L\'email est obligatoire')
    if (!mot_de_passe)                erreurs.push('Le mot de passe est obligatoire')
    if (mot_de_passe && mot_de_passe.length < 8) erreurs.push('Le mot de passe doit contenir au moins 8 caractères')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erreurs.push('Format d\'email invalide')
    if (role && !ROLES_VALIDES.includes(role)) erreurs.push(`Rôle invalide. Valeurs acceptées : ${ROLES_VALIDES.join(', ')}`)

    if (erreurs.length > 0) {
      return res.status(400).json({ succes: false, message: 'Erreurs de validation', erreurs })
    }

    const nouvelUtilisateur = await utilisateurModel.create({
      nom, email, mot_de_passe, role, driver_id, telephone,
    })

    // Journaliser la création
    logActivite({
      userId:      req.user.id,
      action:      'creation',
      entite:      'users',
      entiteId:    nouvelUtilisateur.id,
      description: `Création de l'utilisateur ${nouvelUtilisateur.nom} (${nouvelUtilisateur.email})`,
      req,
    })

    res.status(201).json({
      succes:  true,
      message: 'Utilisateur créé avec succès',
      donnees: nouvelUtilisateur,
    })
  } catch (erreur) {
    if (erreur.code === 'EMAIL_DEJA_UTILISE') {
      return res.status(409).json({ succes: false, message: erreur.message })
    }
    console.error('❌ utilisateurController.createUtilisateur :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la création de l\'utilisateur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateUtilisateur
// Modifie un utilisateur existant (admin uniquement).
// ─────────────────────────────────────────────────────────────────────────────

async function updateUtilisateur(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const { email, role } = req.body
    const erreurs = []

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erreurs.push('Format d\'email invalide')
    if (role && !ROLES_VALIDES.includes(role)) erreurs.push(`Rôle invalide. Valeurs acceptées : ${ROLES_VALIDES.join(', ')}`)

    if (erreurs.length > 0) {
      return res.status(400).json({ succes: false, message: 'Erreurs de validation', erreurs })
    }

    const utilisateurMaj = await utilisateurModel.update(id, req.body)
    if (!utilisateurMaj) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable ou aucune modification' })

    logActivite({
      userId:      req.user.id,
      action:      'modification',
      entite:      'users',
      entiteId:    id,
      description: `Modification de l'utilisateur ID ${id}`,
      req,
    })

    res.json({ succes: true, message: 'Utilisateur mis à jour avec succès', donnees: utilisateurMaj })
  } catch (erreur) {
    console.error('❌ utilisateurController.updateUtilisateur :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la mise à jour de l\'utilisateur' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// reinitialiserMdp
// Génère un nouveau mot de passe aléatoire et le retourne (admin uniquement).
// Le mot de passe est affiché UNE SEULE FOIS — ne jamais le stocker en clair.
// ─────────────────────────────────────────────────────────────────────────────

async function reinitialiserMdp(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    const nouveauMotDePasse = await utilisateurModel.reinitialiserMotDePasse(id)
    if (!nouveauMotDePasse) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable' })

    logActivite({
      userId:      req.user.id,
      action:      'reinitialisation_mdp',
      entite:      'users',
      entiteId:    id,
      description: `Réinitialisation du mot de passe de l'utilisateur ID ${id}`,
      req,
    })

    res.json({
      succes:  true,
      message: 'Mot de passe réinitialisé avec succès',
      donnees: { nouveauMotDePasse },
    })
  } catch (erreur) {
    console.error('❌ utilisateurController.reinitialiserMdp :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la réinitialisation du mot de passe' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// desactiverCompte
// Passe le statut d'un compte à 'inactif' (admin uniquement).
// ─────────────────────────────────────────────────────────────────────────────

async function desactiverCompte(req, res) {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ succes: false, message: 'ID invalide' })

    // Empêcher l'admin de se désactiver lui-même
    if (id === req.user.id) {
      return res.status(400).json({ succes: false, message: 'Impossible de désactiver votre propre compte' })
    }

    const utilisateurDesactive = await utilisateurModel.desactiver(id)
    if (!utilisateurDesactive) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable' })

    logActivite({
      userId:      req.user.id,
      action:      'desactivation',
      entite:      'users',
      entiteId:    id,
      description: `Désactivation du compte utilisateur ID ${id}`,
      req,
    })

    res.json({ succes: true, message: 'Compte désactivé avec succès', donnees: utilisateurDesactive })
  } catch (erreur) {
    console.error('❌ utilisateurController.desactiverCompte :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la désactivation du compte' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMonProfil
// Retourne le profil de l'utilisateur connecté (tous rôles).
// ─────────────────────────────────────────────────────────────────────────────

async function getMonProfil(req, res) {
  try {
    const utilisateur = await utilisateurModel.findById(req.user.id)
    if (!utilisateur) return res.status(404).json({ succes: false, message: 'Profil introuvable' })

    res.json({ succes: true, donnees: utilisateur })
  } catch (erreur) {
    console.error('❌ utilisateurController.getMonProfil :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la récupération du profil' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateMonProfil
// Modifie le profil de l'utilisateur connecté (nom, email, téléphone).
// ─────────────────────────────────────────────────────────────────────────────

async function updateMonProfil(req, res) {
  try {
    const { nom, email, telephone } = req.body
    const erreurs = []

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erreurs.push('Format d\'email invalide')

    if (erreurs.length > 0) {
      return res.status(400).json({ succes: false, message: 'Erreurs de validation', erreurs })
    }

    const profilMaj = await utilisateurModel.update(req.user.id, { nom, email, telephone })
    if (!profilMaj) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable' })

    res.json({ succes: true, message: 'Profil mis à jour avec succès', donnees: profilMaj })
  } catch (erreur) {
    console.error('❌ utilisateurController.updateMonProfil :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors de la mise à jour du profil' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// changerMonMdp
// Change le mot de passe de l'utilisateur connecté après vérification de l'ancien.
// ─────────────────────────────────────────────────────────────────────────────

async function changerMonMdp(req, res) {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body

    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({ succes: false, message: 'Les deux mots de passe sont requis' })
    }

    if (nouveauMotDePasse.length < 8) {
      return res.status(400).json({ succes: false, message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' })
    }

    // Récupérer le mot de passe haché actuel
    const utilisateur = await utilisateurModel.findByEmail(req.user.email)
    if (!utilisateur) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable' })

    // Vérifier l'ancien mot de passe
    const mdpCorrect = await bcrypt.compare(ancienMotDePasse, utilisateur.mot_de_passe)
    if (!mdpCorrect) {
      return res.status(401).json({ succes: false, message: 'L\'ancien mot de passe est incorrect' })
    }

    await utilisateurModel.changerMotDePasse(req.user.id, nouveauMotDePasse)

    res.json({ succes: true, message: 'Mot de passe changé avec succès' })
  } catch (erreur) {
    console.error('❌ utilisateurController.changerMonMdp :', erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur lors du changement de mot de passe' })
  }
}

module.exports = {
  getUtilisateurs,
  getUtilisateur,
  createUtilisateur,
  updateUtilisateur,
  reinitialiserMdp,
  desactiverCompte,
  getMonProfil,
  updateMonProfil,
  changerMonMdp,
}
