/**
 * App.tsx
 * Composant racine de l'application TransiFlow.
 *
 * Configure :
 *   1. AuthProvider  : fournit l'état d'authentification à toute l'application
 *   2. Toaster       : notifications toast globales (react-hot-toast)
 *   3. BrowserRouter : fournit le contexte de navigation
 *   4. Routes        : déclare les routes publiques et protégées
 *
 * Arborescence des routes :
 *   /login            → LoginPage (publique)
 *   /                 → DashboardLayout > DashboardPage
 *   /vehicles         → DashboardLayout > VehiclesPage
 *   /vehicles/:id     → DashboardLayout > VehicleDetailPage
 *   /drivers          → DashboardLayout > DriversPage
 *   /drivers/:id      → DashboardLayout > DriverDetailPage
 *   /missions         → DashboardLayout > MissionsPage
 *   /missions/:id     → DashboardLayout > MissionDetailPage
 *   /suivi            → DashboardLayout > SuiviPage
 *   /documents        → DashboardLayout > DocumentsPage
 *   /rapports         → DashboardLayout > RapportsPage (admin/gestionnaire)
 *   /*                → NotFoundPage
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster }                      from 'react-hot-toast'

import { AuthProvider }       from './contexts/AuthContext'
import PrivateRoute           from './components/PrivateRoute'
import DashboardLayout        from './layouts/DashboardLayout'
import LoginPage              from './pages/LoginPage'
import DashboardPage          from './pages/DashboardPage'
import VehiclesPage           from './pages/VehiclesPage'
import VehicleDetailPage      from './pages/VehicleDetailPage'
import DriversPage            from './pages/DriversPage'
import DriverDetailPage       from './pages/DriverDetailPage'
import MissionsPage           from './pages/MissionsPage'
import MissionDetailPage      from './pages/MissionDetailPage'
import SuiviPage              from './pages/SuiviPage'
import DocumentsPage          from './pages/DocumentsPage'
import RapportsPage           from './pages/RapportsPage'
import NotFoundPage           from './pages/NotFoundPage'
import FinancePage            from './pages/FinancePage'
import MaintenancePage        from './pages/MaintenancePage'
import IncidentsPage          from './pages/IncidentsPage'
import IncidentDetailPage     from './pages/IncidentDetailPage'
import ClientsPage            from './pages/ClientsPage'
import ClientDetailPage       from './pages/ClientDetailPage'
import FacturesPage           from './pages/FacturesPage'

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
            <Route path="vehicles"     element={<VehiclesPage />} />
            <Route path="vehicles/:id" element={<VehicleDetailPage />} />

            {/* Sprint 3 : Chauffeurs */}
            <Route path="drivers"     element={<DriversPage />} />
            <Route path="drivers/:id" element={<DriverDetailPage />} />

            {/* Sprint 4 : Missions */}
            <Route path="missions"       element={<MissionsPage />} />
            <Route path="missions/:id"   element={<MissionDetailPage />} />

            {/* Sprint 5 : Suivi et documents */}
            <Route path="suivi"      element={<SuiviPage />} />
            <Route path="documents"  element={<DocumentsPage />} />

            {/* Sprint 6 : Rapports & Exports (admin/gestionnaire uniquement) */}
            <Route path="rapports" element={<RapportsPage />} />

            {/* Sprint 7 : Finance, Maintenance, Incidents */}
            <Route path="finance"          element={<FinancePage />} />
            <Route path="maintenance"      element={<MaintenancePage />} />
            <Route path="incidents"        element={<IncidentsPage />} />
            <Route path="incidents/:id"    element={<IncidentDetailPage />} />

            {/* Sprint 8 : Clients et Facturation */}
            <Route path="clients"          element={<ClientsPage />} />
            <Route path="clients/:id"      element={<ClientDetailPage />} />
            <Route path="factures"         element={<FacturesPage />} />
          </Route>


          {/* Toute URL inconnue → page 404 */}
          <Route path="*" element={<NotFoundPage />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
