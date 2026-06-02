import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, CheckCheck, AlertTriangle, Wrench, FileText, MapPin, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { io } from 'socket.io-client';

const TITRES = {
  '/':             'Tableau de bord — Flotte de Camions',
  '/vehicules':    'Gestion des Camions',
  '/chauffeurs':   'Gestion des Chauffeurs',
  '/missions':     'Missions de Transport',
  '/carte':        'Carte Globale de la Flotte',
  '/rapports':     'Rapports & Exports',
  '/utilisateurs': 'Gestion des utilisateurs',
  '/paie':         'Paie des chauffeurs'
};

const ICONE_NOTIF = {
  document_expiration: FileText,
  maintenance_urgente: Wrench,
  mission_demarree:    MapPin,
  mission_terminee:    MapPin,
  default:             AlertTriangle
};

const COULEUR_NOTIF = {
  document_expiration: 'text-orange-500',
  maintenance_urgente: 'text-red-500',
  mission_demarree:    'text-blue-500',
  mission_terminee:    'text-green-500',
  default:             'text-gray-500'
};

const fmtDateRelative = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
};

export default function Navbar() {
  const { pathname } = useLocation();
  const { user }     = useAuth();

  const [notifs,    setNotifs]   = useState([]);
  const [nonLues,   setNonLues]  = useState(0);
  const [ouvert,    setOuvert]   = useState(false);
  const dropdownRef = useRef(null);
  const socketRef   = useRef(null);

  const chargerNotifs = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifs(data.notifications || []);
      setNonLues(data.non_lues || 0);
    } catch { /* silencieux */ }
  };

  useEffect(() => {
    chargerNotifs();

    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    socketRef.current.on('notification:nouvelle', (notif) => {
      setNotifs(prev => [notif, ...prev].slice(0, 50));
      setNonLues(prev => prev + 1);
    });

    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener('mousedown', handleOutside);

    return () => {
      socketRef.current?.disconnect();
      document.removeEventListener('mousedown', handleOutside);
    };
  }, []);

  const marquerLue = async (notif) => {
    if (notif.est_lue) return;
    try {
      await api.patch(`/notifications/${notif.id}/read`);
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, est_lue: true } : n));
      setNonLues(prev => Math.max(0, prev - 1));
    } catch { /* silencieux */ }
  };

  const marquerToutesLues = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, est_lue: true })));
      setNonLues(0);
    } catch { /* silencieux */ }
  };

  const supprimerNotif = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifs(prev => prev.filter(n => n.id !== id));
    } catch { /* silencieux */ }
  };

  return (
    <header className="bg-white border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-shrink-0">
      <h2 className="fs-5 fw-semibold text-gray-800 mb-0">
        {TITRES[pathname] || 'CamionApp'}
      </h2>

      <div className="d-flex align-items-center gap-3">
        {/* Cloche notifications */}
        <div className="position-relative" ref={dropdownRef}>
          <button onClick={() => setOuvert(!ouvert)}
                  className="btn btn-light btn-sm position-relative p-2 rounded-3 border"
                  title="Notifications">
            <Bell size={18} className={nonLues > 0 ? 'text-orange-500' : 'text-gray-600'} />
            {nonLues > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-circle bg-danger"
                    style={{ fontSize: '10px', minWidth: '18px', height: '18px', lineHeight: '18px', padding: 0 }}>
                {nonLues > 99 ? '99+' : nonLues}
              </span>
            )}
          </button>

          {ouvert && (
            <div className="position-absolute end-0 mt-2 bg-white border rounded-3 shadow-lg"
                 style={{ width: '360px', zIndex: 1050, maxHeight: '480px', display: 'flex', flexDirection: 'column' }}>
              <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
                <span className="fw-semibold text-dark small">Notifications</span>
                {nonLues > 0 && (
                  <button onClick={marquerToutesLues}
                          className="btn btn-link p-0 small text-primary d-flex align-items-center gap-1">
                    <CheckCheck size={14} /> Tout marquer lu
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-grow-1">
                {notifs.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    <Bell size={32} className="mb-2 opacity-25 d-block mx-auto" />
                    Aucune notification
                  </div>
                ) : (
                  notifs.slice(0, 20).map((n) => {
                    const Icone   = ICONE_NOTIF[n.type]   || ICONE_NOTIF.default;
                    const couleur = COULEUR_NOTIF[n.type] || COULEUR_NOTIF.default;
                    return (
                      <div key={n.id} onClick={() => marquerLue(n)}
                           className={`d-flex align-items-start gap-3 px-3 py-2 border-bottom
                                      ${!n.est_lue ? 'bg-blue-50' : ''}`}
                           style={{ cursor: 'pointer' }}>
                        <div className={`flex-shrink-0 mt-1 ${couleur}`}><Icone size={16} /></div>
                        <div className="flex-grow-1 min-w-0">
                          <p className={`small mb-0 ${!n.est_lue ? 'fw-semibold text-dark' : 'text-gray-700'}`}>
                            {n.titre}
                          </p>
                          <p className="text-xs text-muted mb-0 mt-1">{n.message}</p>
                          <p className="text-xs text-muted mb-0" style={{ opacity: 0.7 }}>
                            {fmtDateRelative(n.created_at)}
                          </p>
                        </div>
                        <button onClick={(e) => supprimerNotif(e, n.id)}
                                className="btn btn-link p-0 flex-shrink-0 text-muted">
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

        {/* Infos utilisateur */}
        <div className="d-flex align-items-center gap-3 small text-gray-600">
          <span className="d-none d-sm-inline">Connecté en tant que</span>
          <span className="fw-medium text-dark">{user?.nom}</span>
          <span className="badge rounded-pill bg-blue-100 text-blue-700 text-capitalize">
            {user?.role}
          </span>
        </div>
      </div>
    </header>
  );
}
