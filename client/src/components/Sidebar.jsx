import { NavLink, useNavigate } from 'react-router-dom';
import {
  Truck, LayoutDashboard, Users, MapPin,
  FileText, LogOut, Map, FileCheck, Fuel, Receipt, Wrench, Calendar, Building2,
  Wallet, UserCog, SlidersHorizontal, X, ClipboardList
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlertesDocuments, useAlertesMaintenances, useAlertesVehicules } from '../requetes';
import { precharger } from '../pages/registre';

const initiales = (nom) =>
  nom ? nom.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) : '?';

// Survol ou focus clavier : la page est téléchargée avant le clic
const NavItem = ({ to, Icon, label, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `sidebar-link${isActive ? ' active' : ''}`
    }
    onMouseEnter={() => precharger(to)}
    onFocus={() => precharger(to)}
  >
    <Icon size={18} className="flex-shrink-0" />
    <span>{label}</span>
    {badge > 0 && (
      <span className="badge rounded-circle bg-danger ms-auto"
            style={{ fontSize: '0.65rem', minWidth: '1.2rem' }}>
        {badge}
      </span>
    )}
  </NavLink>
);

/**
 * Navigation principale. Sur grand écran, colonne toujours visible ; sous 992 px, tiroir ouvert
 * par le bouton menu de la barre du haut (`ouvert`), refermé par `onFermer`.
 */
export default function Sidebar({ ouvert = false, onFermer }) {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();
  // Badges d'alerte : partagés avec les pages via le cache, rafraîchis après chaque modification
  const nbAlertes       = useAlertesVehicules().data?.length ?? 0;
  const nbDocsExpires   = useAlertesDocuments().data?.length ?? 0;
  const nbMaintUrgentes = useAlertesMaintenances().data?.length ?? 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className={`voile-menu${ouvert ? ' ouvert' : ''}`} onClick={onFermer} aria-hidden="true" />
      <aside id="barre-laterale" aria-label="Navigation principale"
             className={`barre-laterale bg-gray-900 d-flex flex-column flex-shrink-0${ouvert ? ' ouverte' : ''}`}>
        {/* Logo */}
        <div className="px-4 py-3 border-bottom border-gray-700 d-flex align-items-start justify-content-between">
          <div>
            <h1 className="text-white fs-5 fw-bold d-flex align-items-center gap-2 mb-0">
              <Truck size={22} className="text-blue-400" />
              <span>CamionApp</span>
            </h1>
            <p className="text-gray-400 text-xs mt-1 mb-0">Flotte de Camions — Madagascar</p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer le menu"
                  className="btn btn-sm text-gray-400 d-lg-none bouton-icone p-0 border-0">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        {/* Un lien touché referme le tiroir, y compris celui de la page déjà affichée */}
        <nav className="flex-grow-1 px-2 py-3 overflow-y-auto d-flex flex-column gap-1"
             onClick={(e) => { if (e.target.closest('a')) onFermer?.(); }}>
          {user?.role === 'chauffeur' && (
            <NavItem to="/mes-missions" Icon={ClipboardList} label="Mes missions"  />
          )}
          <NavItem to="/"           Icon={LayoutDashboard} label="Tableau de bord"  />
          <NavItem to="/vehicules"  Icon={Truck}           label="Véhicules"       badge={nbAlertes}  />
          <NavItem to="/chauffeurs" Icon={Users}           label="Chauffeurs"  />
          <NavItem to="/missions"   Icon={MapPin}          label="Missions"  />
          <NavItem to="/carte"      Icon={Map}             label="Carte globale"  />
          <NavItem to="/documents"  Icon={FileCheck}       label="Documents"       badge={nbDocsExpires}  />
          <NavItem to="/carburant"    Icon={Fuel}        label="Carburant"  />
          <NavItem to="/depenses"     Icon={Receipt}     label="Dépenses"  />
          <NavItem to="/maintenances" Icon={Wrench}      label="Maintenances"  badge={nbMaintUrgentes}  />
          <NavItem to="/planning"     Icon={Calendar}    label="Planning"  />
          <NavItem to="/clients"      Icon={Building2}   label="Clients"  />
          <NavItem to="/rapports"     Icon={FileText}    label="Rapports"  />
          {(user?.role === 'admin' || user?.role === 'gestionnaire') && (
            <>
              <NavItem to="/paie"       Icon={Wallet}            label="Paie"  />
              <NavItem to="/parametres" Icon={SlidersHorizontal} label="Paramètres"  />
            </>
          )}
          {user?.role === 'admin' && (
            <NavItem to="/utilisateurs" Icon={UserCog} label="Utilisateurs"  />
          )}
        </nav>

        {/* Profil + déconnexion */}
        <div className="border-top border-gray-700 px-3 py-3">
          <div className="d-flex align-items-center gap-2 mb-2">
            <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center
                            text-white fw-bold small flex-shrink-0"
                 style={{ width: '36px', height: '36px' }}>
              {initiales(user?.nom || '')}
            </div>
            <div className="overflow-hidden">
              <p className="text-white small fw-medium mb-0 text-truncate">{user?.nom}</p>
              <p className="text-gray-400 text-xs text-capitalize mb-0">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm w-100 d-flex align-items-center gap-2 text-gray-400"
            style={{ backgroundColor: 'transparent', border: 'none' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor='#1f2937'; e.currentTarget.style.color='#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='#9ca3af'; }}
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
