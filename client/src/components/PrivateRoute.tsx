/**
 * PrivateRoute.tsx
 * Composant de protection des routes nécessitant une authentification.
 *
 * Comportement :
 *   1. Pendant la vérification initiale du token → affiche un spinner plein écran
 *   2. Si non authentifié → redirige vers /login
 *   3. Si rôle insuffisant → redirige vers / (tableau de bord)
 *   4. Sinon → affiche les enfants normalement
 *
 * Usage :
 *   <Route path="/admin" element={<PrivateRoute roles={['admin']}><AdminPage /></PrivateRoute>} />
 */

import { Navigate } from 'react-router-dom'
import { useAuth, type Utilisateur } from '../contexts/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PrivateRouteProps {
  children: React.ReactNode
  // Liste des rôles autorisés à accéder à la route (optionnel — si absent, tout utilisateur connecté peut accéder)
  roles?: Utilisateur['role'][]
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner plein écran (affiché pendant la vérification initiale du token)
// ─────────────────────────────────────────────────────────────────────────────

function SpinnerChargement() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Cercle tournant animé */}
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Chargement en cours…</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { utilisateur, isLoading, isAuthenticated } = useAuth()

  // Cas 1 : vérification du token en cours → ne pas décider trop vite
  if (isLoading) {
    return <SpinnerChargement />
  }

  // Cas 2 : utilisateur non connecté → redirection vers la page de connexion
  if (!isAuthenticated) {
    // replace=true évite que /login s'empile sur l'historique (bouton retour propre)
    return <Navigate to="/login" replace />
  }

  // Cas 3 : rôle insuffisant → redirection vers le tableau de bord
  if (roles && utilisateur && !roles.includes(utilisateur.role)) {
    return <Navigate to="/" replace />
  }

  // Cas 4 : authentifié et rôle valide → afficher la page demandée
  return <>{children}</>
}

export default PrivateRoute
