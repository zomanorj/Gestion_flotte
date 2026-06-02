import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './context/AuthContext';

import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Vehicules    from './pages/Vehicules';
import Chauffeurs   from './pages/Chauffeurs';
import Missions     from './pages/Missions';
import Rapports     from './pages/Rapports';
import CarteGlobale from './pages/CarteGlobale';
import Documents    from './pages/Documents';
import Carburant    from './pages/Carburant';
import Depenses     from './pages/Depenses';
import Maintenances from './pages/Maintenances';
import Planning     from './pages/Planning';
import Clients      from './pages/Clients';
import Utilisateurs from './pages/Utilisateurs';
import Paie         from './pages/Paie';

import Sidebar from './components/Sidebar';
import Navbar  from './components/Navbar';

const AppLayout = ({ children }) => (
  <div className="d-flex vh-100 overflow-hidden bg-gray-100">
    <Sidebar />
    <div className="d-flex flex-column flex-grow-1 overflow-hidden">
      <Navbar />
      <main className="flex-grow-1 overflow-y-auto p-4">
        {children}
      </main>
    </div>
  </div>
);

const AppLayoutPleinEcran = ({ children }) => (
  <div className="d-flex vh-100 overflow-hidden">
    <Sidebar />
    <div className="d-flex flex-column flex-grow-1 overflow-hidden">
      <Navbar />
      <main className="flex-grow-1 overflow-hidden">
        {children}
      </main>
    </div>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
      } />
      <Route path="/vehicules" element={
        <ProtectedRoute><AppLayout><Vehicules /></AppLayout></ProtectedRoute>
      } />
      <Route path="/chauffeurs" element={
        <ProtectedRoute><AppLayout><Chauffeurs /></AppLayout></ProtectedRoute>
      } />
      <Route path="/missions" element={
        <ProtectedRoute><AppLayout><Missions /></AppLayout></ProtectedRoute>
      } />
      <Route path="/rapports" element={
        <ProtectedRoute><AppLayout><Rapports /></AppLayout></ProtectedRoute>
      } />
      <Route path="/documents" element={
        <ProtectedRoute><AppLayout><Documents /></AppLayout></ProtectedRoute>
      } />
      <Route path="/carburant" element={
        <ProtectedRoute><AppLayout><Carburant /></AppLayout></ProtectedRoute>
      } />
      <Route path="/depenses" element={
        <ProtectedRoute><AppLayout><Depenses /></AppLayout></ProtectedRoute>
      } />
      <Route path="/maintenances" element={
        <ProtectedRoute><AppLayout><Maintenances /></AppLayout></ProtectedRoute>
      } />
      <Route path="/planning" element={
        <ProtectedRoute><AppLayout><Planning /></AppLayout></ProtectedRoute>
      } />
      <Route path="/clients" element={
        <ProtectedRoute><AppLayout><Clients /></AppLayout></ProtectedRoute>
      } />
      <Route path="/carte" element={
        <ProtectedRoute><AppLayoutPleinEcran><CarteGlobale /></AppLayoutPleinEcran></ProtectedRoute>
      } />
      <Route path="/utilisateurs" element={
        <ProtectedRoute><AppLayout><Utilisateurs /></AppLayout></ProtectedRoute>
      } />
      <Route path="/paie" element={
        <ProtectedRoute><AppLayout><Paie /></AppLayout></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
