/**
 * App.tsx
 * Composant racine de l'application Transport STTA.
 *
 * Configure :
 *   1. AuthProvider  : fournit l'état d'authentification à toute l'application
 *   2. Toaster       : notifications toast globales (react-hot-toast)
 *   3. BrowserRouter : fournit le contexte de navigation
 *   4. Routes        : déclare les routes publiques et protégées
 *
 * Arborescence des routes :
 *   /login            → LoginPage (publique)
 *   /                 → DashboardLayout > DashboardPage (privée)
 *   /vehicles         → DashboardLayout > VehiclesPage (Sprint 2)
 *   /vehicles/:id     → DashboardLayout > VehicleDetailPage (Sprint 2)
 *   /chauffeurs       → DashboardLayout > placeholder (Sprint 3)
 *   /missions         → DashboardLayout > placeholder (Sprint 4)
 *   /*                → Redirection vers /
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster }        from 'react-hot-toast'

import { AuthProvider }       from './contexts/AuthContext'
import PrivateRoute           from './components/PrivateRoute'
import DashboardLayout        from './layouts/DashboardLayout'
import LoginPage              from './pages/LoginPage'
import DashboardPage          from './pages/DashboardPage'
import VehiclesPage           from './pages/VehiclesPage'
import VehicleDetailPage      from './pages/VehicleDetailPage'

/** Placeholder pour les routes non encore implémentées */
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
    <AuthProvider>
      {/* Toaster : rendu des notifications toast dans toute l'app */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '14px',
            borderRadius: '10px',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <BrowserRouter>
        <Routes>

          {/* ── Routes publiques ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Routes privées (token requis) ── */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            {/* Tableau de bord */}
            <Route index element={<DashboardPage />} />

            {/* Sprint 2 : Gestion de la flotte */}
            <Route path="vehicles"    element={<VehiclesPage />} />
            <Route path="vehicles/:id" element={<VehicleDetailPage />} />

            {/* Sprint 3 : Chauffeurs */}
            <Route path="chauffeurs"  element={<PageEnConstruction titre="Gestion des chauffeurs" />} />

            {/* Sprint 4 : Missions */}
            <Route path="missions"    element={<PageEnConstruction titre="Planification des missions" />} />

            {/* Sprint 5 */}
            <Route path="suivi"       element={<PageEnConstruction titre="Suivi en temps réel" />} />
            <Route path="rapports"    element={<PageEnConstruction titre="Rapports et statistiques" />} />
          </Route>

          {/* Toute URL inconnue → accueil */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
