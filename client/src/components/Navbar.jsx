import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, CheckCheck, AlertTriangle, Wrench, FileText, MapPin, X, Menu, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useEvenement } from '../hooks/useEvenement';
import { formaterDate } from '../utils/format';
import { emplacement } from '../navigation';
import { useEcriture, useNotifications, useRafraichir } from '../requetes';

const ICONE_NOTIF = {
  document_expiration: FileText,
  maintenance_urgente: Wrench,
  mission_demarree:    MapPin,
  mission_terminee:    MapPin,
  default:             AlertTriangle,
};

// Couleur d'état seulement pour ce qui demande une action (document, maintenance)
const TON_NOTIF = {
  document_expiration: 'ton-attention',
  maintenance_urgente: 'ton-danger',
  mission_terminee:    'ton-succes',
};

const dateRelative = (valeur) => {
  const diff = Math.floor((Date.now() - new Date(valeur)) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return formaterDate(valeur);
};

const JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
// « Vendredi 9 octobre » : majuscule au jour seulement
const aujourdhui = () => { const t = JOUR.format(new Date()); return t.charAt(0).toUpperCase() + t.slice(1); };

export default function Navbar({ menuOuvert = false, onMenu }) {
  const { pathname } = useLocation();
  const ici = emplacement(pathname);

  const [ouvert, setOuvert] = useState(false);
  const panneauRef = useRef(null);

  const { data } = useNotifications();
  const notifs  = data?.notifications ?? [];
  const nonLues = data?.non_lues ?? 0;
  const rafraichir = useRafraichir();

  const lire     = useEcriture('notifications', (id) => api.patch(`/notifications/${id}/read`));
  const toutLire = useEcriture('notifications', () => api.patch('/notifications/read-all'));
  const masquer  = useEcriture('notifications', (id) => api.delete(`/notifications/${id}`));

  // Événements temps réel : les données concernées sont rechargées depuis l'API, si bien
  // que toutes les pages ouvertes et les badges restent à jour, y compris quand la
  // modification vient d'un autre utilisateur.
  useEvenement('notification:nouvelle', () => {
    rafraichir('notifications', 'documents', 'maintenances', 'vehicules');
  });
  useEvenement('mission:nouvelle', () => rafraichir('missions', 'planning', 'tableau-de-bord'));
  useEvenement('mission:statut', () => {
    rafraichir('missions', 'planning', 'vehicules', 'chauffeurs', 'tableau-de-bord', 'paie');
  });

  // Le panneau se ferme au clic à l'extérieur, avec Échap et au changement de page
  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => { if (panneauRef.current && !panneauRef.current.contains(e.target)) setOuvert(false); };
    const touche = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);
  useEffect(() => { setOuvert(false); }, [pathname]);

  return (
    <header className="barre-haut d-flex align-items-center gap-2 px-3 px-lg-4 flex-shrink-0">
      {/* Menu : ouvre la barre latérale sous 992 px */}
      <button type="button" onClick={onMenu} aria-label="Ouvrir le menu"
              aria-controls="barre-laterale" aria-expanded={menuOuvert}
              className="btn btn-icone d-lg-none">
        <Menu size={20} />
      </button>

      {/* Fil d'Ariane : section, puis page */}
      <nav aria-label="Fil d'Ariane" className="flex-grow-1 min-w-0">
        <ol className="fil-ariane">
          {ici && <li className="d-none d-sm-flex">{ici.section}<ChevronRight size={14} aria-hidden="true" /></li>}
          <li aria-current="page" className="text-truncate">{ici?.page || 'FlotteApp'}</li>
        </ol>
      </nav>

      <span className="date-du-jour d-none d-xl-inline">{aujourdhui()}</span>

      {/* Notifications */}
      <div className="position-relative" ref={panneauRef}>
        <button type="button" onClick={() => setOuvert(!ouvert)}
                className="btn btn-icone position-relative"
                title="Notifications" aria-label="Notifications" aria-expanded={ouvert} aria-haspopup="true">
          <Bell size={18} />
          {nonLues > 0 && <span className="pastille-compteur">{nonLues > 99 ? '99+' : nonLues}</span>}
        </button>

        {ouvert && (
          <div className="panneau-notifications apparition" role="dialog" aria-label="Notifications">
            <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
              <span className="fw-semibold">Notifications</span>
              {nonLues > 0 && (
                <button type="button" onClick={() => toutLire.mutate()}
                        className="btn btn-link btn-sm p-0 d-flex align-items-center gap-1">
                  <CheckCheck size={14} /> Tout marquer comme lu
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-grow-1">
              {notifs.length === 0 ? (
                <div className="text-center py-5 px-3 text-muted">
                  <Bell size={28} strokeWidth={1.5} className="mb-2 opacity-50" />
                  <p className="mb-0 small">Aucune notification</p>
                </div>
              ) : (
                notifs.slice(0, 20).map((n) => {
                  const Icone = ICONE_NOTIF[n.type] || ICONE_NOTIF.default;
                  return (
                    <div key={n.id} className={`notification${n.est_lue ? '' : ' non-lue'}`}>
                      <button type="button" className="notification-corps"
                              onClick={() => { if (!n.est_lue) lire.mutate(n.id); }}>
                        <span className={`notification-icone ${TON_NOTIF[n.type] || ''}`}><Icone size={15} /></span>
                        <span className="flex-grow-1 min-w-0 text-start">
                          <span className="d-block notification-titre">{n.titre}</span>
                          <span className="d-block text-muted small">{n.message}</span>
                          <span className="d-block text-muted text-xs mt-1">{dateRelative(n.created_at)}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => masquer.mutate(n.id)}
                              className="btn btn-icone btn-icone-sm" aria-label="Masquer la notification">
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
