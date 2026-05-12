// Barre de navigation latérale fixe
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Car, LayoutDashboard, Truck, Users, MapPin,
  FileText, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/** Retourne les initiales à partir d'un nom complet */
const initiales = (nom) =>
  nom ? nom.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) : '?';

/** Lien de navigation avec style actif automatique */
const NavItem = ({ to, Icon, label, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative
       ${isActive
         ? 'bg-blue-600 text-white'
         : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
    }
  >
    <Icon className="w-5 h-5 flex-shrink-0" />
    <span>{label}</span>
    {badge > 0 && (
      <span className="absolute right-3 top-2 bg-red-500 text-white text-xs font-bold
                       rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
        {badge}
      </span>
    )}
  </NavLink>
);

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();
  const [nbAlertes, setNbAlertes] = useState(0);

  // Récupération du nombre d'alertes non lues pour le badge
  useEffect(() => {
    api.get('/vehicules/alertes')
      .then(({ data }) => setNbAlertes(data.length))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-gray-900 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-white text-xl font-bold flex items-center gap-2">
          <Car className="w-6 h-6 text-blue-400" />
          <span>FlotteApp</span>
        </h1>
        <p className="text-gray-400 text-xs mt-1">Gestion de Flotte — Madagascar</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavItem to="/"           Icon={LayoutDashboard} label="Tableau de bord" />
        <NavItem to="/vehicules"  Icon={Truck}           label="Véhicules" badge={nbAlertes} />
        <NavItem to="/chauffeurs" Icon={Users}           label="Chauffeurs" />
        <NavItem to="/missions"   Icon={MapPin}          label="Missions" />
        <NavItem to="/rapports"   Icon={FileText}        label="Rapports" />
      </nav>

      {/* Profil utilisateur + déconnexion */}
      <div className="border-t border-gray-700 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center
                          text-white font-bold text-sm flex-shrink-0">
            {initiales(user?.nom || '')}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">{user?.nom}</p>
            <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400
                     hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
