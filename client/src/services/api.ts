/**
 * api.ts
 * Instance Axios centralisée pour toutes les requêtes vers l'API Transport STTA.
 *
 * Ce fichier configure :
 *   1. L'URL de base (depuis .env pour éviter les valeurs en dur)
 *   2. Un intercepteur de requête : attache automatiquement le token JWT
 *   3. Un intercepteur de réponse : gère les erreurs 401 (session expirée)
 *
 * Tous les services (authService, vehiculeService…) importeront cette instance.
 */

import axios from 'axios'

// Clé utilisée pour stocker le token dans localStorage
// Centralisée ici pour éviter les fautes de frappe dans d'autres fichiers
export const CLE_TOKEN_STOCKAGE = 'authToken'

// Création de l'instance axios avec la configuration commune
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
  // Délai maximum avant d'abandonner une requête (10 secondes)
  timeout: 10_000,
})

// ─────────────────────────────────────────────────────────────────────────────
// Intercepteur de REQUÊTE
// Ajoute automatiquement le token JWT à chaque requête sortante
// si l'utilisateur est connecté (token présent dans localStorage)
// ─────────────────────────────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const tokenJWT = localStorage.getItem(CLE_TOKEN_STOCKAGE)

    if (tokenJWT) {
      // Format standard HTTP : "Bearer <token>"
      config.headers.Authorization = `Bearer ${tokenJWT}`
    }

    return config
  },
  (erreur) => {
    // Erreur avant l'envoi de la requête (rare — config incorrecte)
    return Promise.reject(erreur)
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// Intercepteur de RÉPONSE
// Gère les erreurs HTTP globalement pour éviter de les répéter dans chaque appel
// ─────────────────────────────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  // Succès : on laisse passer la réponse sans modification
  (reponse) => reponse,

  (erreur) => {
    // Erreur 401 : token absent, invalide ou expiré
    // On nettoie le localStorage et on redirige vers /login
    if (erreur.response?.status === 401) {
      localStorage.removeItem(CLE_TOKEN_STOCKAGE)

      // Éviter une boucle infinie si on est déjà sur /login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    // On propage l'erreur pour que chaque appelant puisse la gérer localement si nécessaire
    return Promise.reject(erreur)
  }
)

export default apiClient
