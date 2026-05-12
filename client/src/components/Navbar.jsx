// Barre de navigation supérieure
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Correspondance chemin → titre de page */
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
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-gray-800">
        {TITRES[pathname] || 'CamionApp'}
      </h2>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span>Connecté en tant que</span>
        <span className="font-medium text-gray-900">{user?.nom}</span>
        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium capitalize">
          {user?.role}
        </span>
      </div>
    </header>
  );
}
