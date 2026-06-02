import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TITRES = {
  '/':           'Tableau de bord — Flotte de Camions',
  '/vehicules':  'Gestion des Camions',
  '/chauffeurs': 'Gestion des Chauffeurs',
  '/missions':   'Missions de Transport',
  '/carte':      'Carte Globale de la Flotte',
  '/rapports':   'Rapports & Exports'
};

export default function Navbar() {
  const { pathname } = useLocation();
  const { user }     = useAuth();

  return (
    <header className="bg-white border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-shrink-0">
      <h2 className="fs-5 fw-semibold text-gray-800 mb-0">
        {TITRES[pathname] || 'CamionApp'}
      </h2>
      <div className="d-flex align-items-center gap-3 small text-gray-600">
        <span>Connecté en tant que</span>
        <span className="fw-medium text-dark">{user?.nom}</span>
        <span className="badge rounded-pill bg-blue-100 text-blue-700 text-capitalize">
          {user?.role}
        </span>
      </div>
    </header>
  );
}
