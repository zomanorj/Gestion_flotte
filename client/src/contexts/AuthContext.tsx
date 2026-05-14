/**
 * AuthContext.tsx
 * Contexte React pour la gestion de l'état d'authentification global.
 *
 * Ce contexte fournit à toute l'application :
 *   - L'utilisateur connecté (ou null si non connecté)
 *   - Le statut de chargement initial (vérification du token existant)
 *   - Les fonctions login(), logout(), et la vérification automatique au montage
 *
 * Pattern utilisé : Context + custom hook (useAuth) pour simplifier l'usage.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'

import apiClient, { CLE_TOKEN_STOCKAGE } from '../services/api'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Profil minimal de l'utilisateur connecté */
export interface Utilisateur {
  id:    number
  nom:   string
  email: string
  role:  'admin' | 'gestionnaire' | 'chauffeur'
}

/** Valeurs exposées par le contexte à tous les composants enfants */
interface AuthContextType {
  utilisateur:     Utilisateur | null
  isLoading:       boolean
  isAuthenticated: boolean
  login:           (email: string, motDePasse: string) => Promise<void>
  logout:          () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Création du contexte
// ─────────────────────────────────────────────────────────────────────────────

// null initial : protège contre l'usage hors du provider (détecté dans useAuth)
const AuthContext = createContext<AuthContextType | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AuthProvider
 * Entoure l'application pour fournir l'état d'authentification à tous les composants.
 * À placer au plus haut niveau dans App.tsx (autour de BrowserRouter).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur]   = useState<Utilisateur | null>(null)
  // isLoading = true au démarrage : on vérifie si un token valide existe déjà
  const [isLoading, setIsLoading]       = useState(true)

  // Au montage de l'application : vérifier si l'utilisateur était déjà connecté
  useEffect(() => {
    verifierSessionExistante()
  }, [])

  /**
   * verifierSessionExistante
   * Appelé une seule fois au démarrage : si un token est dans localStorage,
   * on appelle /api/auth/me pour récupérer le profil utilisateur correspondant.
   * Si le token est expiré ou invalide, l'intercepteur 401 nettoie tout.
   */
  const verifierSessionExistante = async () => {
    const tokenStocke = localStorage.getItem(CLE_TOKEN_STOCKAGE)

    if (!tokenStocke) {
      // Pas de token : l'utilisateur n'était pas connecté, rien à faire
      setIsLoading(false)
      return
    }

    try {
      // Le token est ajouté automatiquement par l'intercepteur de requête
      const { data } = await apiClient.get<{ user: Utilisateur }>('/api/auth/me')
      setUtilisateur(data.user)
    } catch {
      // Token invalide ou expiré : on réinitialise (l'intercepteur 401 supprime déjà le token)
      setUtilisateur(null)
    } finally {
      // Que la vérification réussisse ou échoue, isLoading passe à false
      setIsLoading(false)
    }
  }

  /**
   * login
   * Envoie les identifiants au serveur, stocke le token JWT reçu,
   * et met à jour l'état utilisateur dans le contexte.
   *
   * @throws Error si les identifiants sont incorrects (propagée au composant appelant)
   */
  const login = async (email: string, motDePasse: string): Promise<void> => {
    const { data } = await apiClient.post<{ token: string; user: Utilisateur }>(
      '/api/auth/login',
      { email, motDePasse }
    )

    // Persistance du token pour survivre aux rechargements de page
    localStorage.setItem(CLE_TOKEN_STOCKAGE, data.token)
    setUtilisateur(data.user)
  }

  /**
   * logout
   * Supprime le token du localStorage et réinitialise l'état utilisateur.
   * La redirection vers /login est gérée par PrivateRoute ou manuellement.
   */
  const logout = (): void => {
    localStorage.removeItem(CLE_TOKEN_STOCKAGE)
    setUtilisateur(null)
  }

  return (
    <AuthContext.Provider
      value={{
        utilisateur,
        isLoading,
        isAuthenticated: utilisateur !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook personnalisé
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useAuth
 * Hook pour accéder au contexte d'authentification depuis n'importe quel composant.
 *
 * @throws Error si utilisé en dehors d'un AuthProvider
 * @example
 *   const { utilisateur, logout } = useAuth()
 */
export function useAuth(): AuthContextType {
  const contexte = useContext(AuthContext)

  if (contexte === null) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un <AuthProvider>')
  }

  return contexte
}
