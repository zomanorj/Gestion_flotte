// Composant racine — définition des routes de l'application
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './context/AuthContext';

// Pages
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Vehicules  from './pages/Vehicules';
import Chauffeurs from './pages/Chauffeurs';
import Missions   from './pages/Missions';
import Rapports   from './pages/Rapports';

// Layout avec sidebar
import Sidebar from './components/Sidebar';
import Navbar  from './components/Navbar';

/** Layout principal pour les pages protégées */
const AppLayout = ({ children }) => (
  <div className="flex h-screen bg-gray-100 overflow-hidden">
    <Sidebar />
    <div className="flex flex-col flex-1 overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  </div>
);

export default function App() {
  return (
    <Routes>
      {/* Route publique */}
      <Route path="/login" element={<Login />} />

      {/* Routes protégées avec layout */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/vehicules" element={
        <ProtectedRoute>
          <AppLayout><Vehicules /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/chauffeurs" element={
        <ProtectedRoute>
          <AppLayout><Chauffeurs /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/missions" element={
        <ProtectedRoute>
          <AppLayout><Missions /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/rapports" element={
        <ProtectedRoute>
          <AppLayout><Rapports /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Redirection par défaut */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
