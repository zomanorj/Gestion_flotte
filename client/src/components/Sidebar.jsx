import { NavLink, useNavigate } from 'react-router-dom';
import { Truck, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlertesDocuments, useAlertesMaintenances, useAlertesVehicules } from '../requetes';
import { precharger } from '../pages/registre';
import { sectionsPour } from '../navigation';

const LIBELLES_ROLE = { admin: 'Administrateur', gestionnaire: 'Gestionnaire', chauffeur: 'Chauffeur' };

const initiales = (nom) =>
  nom ? nom.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) : '?';

// Survol ou focus clavier : la page est téléchargée avant le clic
const Lien = ({ chemin, libelle, Icone, badge }) => (
  <NavLink to={chemin} end className={({ isActive }) => `lien-nav${isActive ? ' actif' : ''}`}
           onMouseEnter={() => precharger(chemin)} onFocus={() => precharger(chemin)}>
    <Icone size={17} strokeWidth={1.75} className="flex-shrink-0" />
    <span className="text-truncate">{libelle}</span>
    {badge > 0 && <span className="badge-nav" aria-label={`${badge} alerte(s)`}>{badge}</span>}
  </NavLink>
);

/**
 * Navigation principale, groupée par section (navigation.js). Sur grand écran, colonne toujours
 * visible ; sous 992 px, tiroir ouvert par le bouton menu de la barre du haut (`ouvert`).
 */
export default function Sidebar({ ouvert = false, onFermer }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Badges d'alerte : partagés avec les pages via le cache, rafraîchis après chaque modification
  const alertes = {
    vehicules:    useAlertesVehicules().data?.length ?? 0,
    documents:    useAlertesDocuments().data?.length ?? 0,
    maintenances: useAlertesMaintenances().data?.length ?? 0,
  };

  const deconnecter = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className={`voile-menu${ouvert ? ' ouvert' : ''}`} onClick={onFermer} aria-hidden="true" />
      <aside id="barre-laterale" aria-label="Navigation principale"
             className={`barre-laterale d-flex flex-column flex-shrink-0${ouvert ? ' ouverte' : ''}`}>
        {/* Marque */}
        <div className="d-flex align-items-center justify-content-between px-3 marque">
          <div className="d-flex align-items-center gap-2">
            <span className="logo"><Truck size={18} strokeWidth={2} /></span>
            <div className="lh-sm">
              <p className="fw-semibold text-white mb-0">FlotteApp</p>
              <p className="sous-marque mb-0">Transport — Madagascar</p>
            </div>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer le menu"
                  className="btn btn-icone btn-icone-sombre d-lg-none">
            <X size={18} />
          </button>
        </div>

        {/* Navigation. Un lien touché referme le tiroir, y compris celui de la page affichée */}
        <nav className="flex-grow-1 overflow-y-auto px-2 pb-3"
             onClick={(e) => { if (e.target.closest('a')) onFermer?.(); }}>
          {sectionsPour(user?.role).map((section) => (
            <div key={section.titre} className="section-nav">
              <p className="titre-section">{section.titre}</p>
              {section.liens.map((l) => (
                <Lien key={l.chemin} {...l} badge={l.alerte ? alertes[l.alerte] : 0} />
              ))}
            </div>
          ))}
        </nav>

        {/* Profil et déconnexion */}
        <div className="profil d-flex align-items-center gap-2 px-3 py-3">
          <span className="avatar" aria-hidden="true">{initiales(user?.nom || '')}</span>
          <div className="flex-grow-1 min-w-0 lh-sm">
            <p className="text-white fw-medium mb-0 text-truncate">{user?.nom}</p>
            <p className="sous-marque mb-0">{LIBELLES_ROLE[user?.role] || user?.role}</p>
          </div>
          <button type="button" onClick={deconnecter} title="Déconnexion" aria-label="Déconnexion"
                  className="btn btn-icone btn-icone-sombre">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}
