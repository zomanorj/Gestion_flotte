/**
 * App.tsx
 * Composant racine de l'application Transport STTA.
 *
 * Configure :
 *   1. AuthProvider  : fournit l'état d'authentification à toute l'application
 *   2. BrowserRouter : fournit le contexte de navigation
 *   3. Routes        : déclare les routes publiques et protégées
 *
 * Arborescence des routes :
 *   /login          → LoginPage (publique)
 *   /               → DashboardLayout > DashboardPage (privée)
 *   /vehicules      → DashboardLayout > placeholder (Sprint 2)
 *   /chauffeurs     → DashboardLayout > placeholder (Sprint 3)
 *   /missions       → DashboardLayout > placeholder (Sprint 4)
 *   /*              → Redirection vers /
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider }    from './contexts/AuthContext'
import PrivateRoute        from './components/PrivateRoute'
import DashboardLayout     from './layouts/DashboardLayout'
import LoginPage           from './pages/LoginPage'
import DashboardPage       from './pages/DashboardPage'

// Placeholder réutilisable pour les routes des prochains sprints
function PageEnConstruction({ titre }: { titre: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-3">🚧</div>
        <p className="font-semibold text-slate-700">{titre}</p>
        <p className="text-sm text-slate-400 mt-1">Disponible dans un prochain sprint</p>
      </div>
    </div>
  )
}

function App() {
  return (
    // AuthProvider doit entourer BrowserRouter pour que les composants de route
    // puissent accéder au contexte d'authentification
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Routes publiques ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Routes privées (nécessitent une authentification) ── */}
          {/* DashboardLayout gère le <Outlet /> pour toutes les sous-routes */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            {/* Tableau de bord (index = route par défaut de "/") */}
            <Route index element={<DashboardPage />} />

            {/* Placeholders — à remplacer aux sprints suivants */}
            <Route path="vehicules"  element={<PageEnConstruction titre="Gestion de la flotte" />} />
            <Route path="chauffeurs" element={<PageEnConstruction titre="Gestion des chauffeurs" />} />
            <Route path="missions"   element={<PageEnConstruction titre="Planification des missions" />} />
            <Route path="suivi"      element={<PageEnConstruction titre="Suivi en temps réel" />} />
            <Route path="rapports"   element={<PageEnConstruction titre="Rapports et statistiques" />} />
          </Route>

          {/* ── Toute URL inconnue → redirection vers l'accueil ── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
