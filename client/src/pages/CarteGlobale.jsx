import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { Truck, RefreshCw, ChevronLeft, ChevronRight, MapPin, AlertTriangle, Clock, Gauge } from 'lucide-react';
import api from '../services/api';

const PALETTE = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#eab308', '#06b6d4', '#ec4899'];
const couleurParIndex = (index) => PALETTE[index % PALETTE.length];

function creerIcone(couleur, initiale) {
  return L.divIcon({
    html: `
      <div style="background:${couleur};border:3px solid white;border-radius:50%;
        width:44px;height:44px;display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px rgba(0,0,0,0.4);font-weight:bold;font-size:14px;color:white;font-family:monospace;"
      >${initiale}</div>`,
    iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -26], className: ''
  });
}

function CentrerSur({ cible }) {
  const map = useMap();
  useEffect(() => {
    if (cible) map.setView([cible.lat, cible.lng], 11, { animate: true, duration: 1 });
  }, [cible, map]);
  return null;
}

function formatTemps(sec) {
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min`;
  return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}min`;
}

export default function CarteGlobale() {
  const socketRef = useRef(null);
  const [camions,               setCamions]               = useState({});
  const [indicesCouleur,        setIndicesCouleur]        = useState({});
  const [cible,                 setCible]                 = useState(null);
  const [panneauOuvert,         setPanneauOuvert]         = useState(true);
  const [derniereMaj,           setDerniereMaj]           = useState(null);
  const [chargement,            setChargement]            = useState(true);
  const [multiplicateurs,       setMultiplicateurs]       = useState({});
  const [multiplicateurGlobal,  setMultiplicateurGlobal]  = useState(30);

  const getCouleur = useCallback((missionId) => {
    setIndicesCouleur(prev => {
      if (prev[missionId] !== undefined) return prev;
      return { ...prev, [missionId]: Object.keys(prev).length };
    });
    return indicesCouleur[missionId] ?? 0;
  }, [indicesCouleur]);

  const chargerActifs = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await api.get('/simulation/actives');
      const nouvellesDonnees = {};
      const nouveauxIndices  = {};
      data.forEach((c, i) => {
        nouveauxIndices[c.missionId] = i;
        const initiale = (c.immatriculation || '?').replace(/[^A-Z0-9]/gi, '').charAt(0).toUpperCase();
        nouvellesDonnees[c.missionId] = { ...c, trace: c.position ? [[c.position.lat, c.position.lng]] : [], couleur: couleurParIndex(i), initiale };
      });
      setCamions(nouvellesDonnees); setIndicesCouleur(nouveauxIndices);
    } catch { /* aucune simulation active */ } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerActifs();
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const socket = socketRef.current;

    socket.on('flotte:positions', (positions) => {
      setDerniereMaj(new Date());
      setMultiplicateurs(prev => {
        const updated = { ...prev };
        positions.forEach(c => { if (c.multiplicateur !== undefined) updated[c.missionId] = c.multiplicateur; });
        return updated;
      });
      setCamions(prev => {
        const suivant = { ...prev };
        positions.forEach((c) => {
          const id = c.missionId;
          const existant = suivant[id];
          const indexCouleur = existant ? Object.keys(suivant).indexOf(id) : Object.keys(suivant).length;
          const initiale = (c.immatriculation || '?').replace(/[^A-Z0-9]/gi, '').charAt(0).toUpperCase();
          suivant[id] = {
            ...existant, ...c,
            couleur:  existant?.couleur || couleurParIndex(indexCouleur),
            initiale: existant?.initiale || initiale,
            trace: existant?.trace ? [...existant.trace.slice(-499), [c.position.lat, c.position.lng]] : [[c.position.lat, c.position.lng]]
          };
        });
        const idsActifs = positions.map(p => p.missionId);
        Object.keys(suivant).forEach(id => { if (!idsActifs.includes(id)) delete suivant[id]; });
        return suivant;
      });
    });

    return () => socket.disconnect();
  }, [chargerActifs]);

  const camionsList = Object.values(camions);
  const nbEnMission = camionsList.length;

  const changerVitesseGlobale = async (v) => {
    setMultiplicateurGlobal(v);
    for (const c of camionsList) {
      setMultiplicateurs(prev => ({ ...prev, [c.missionId]: v }));
      try { await api.post(`/simulation/vitesse/${c.missionId}`, { multiplicateur: v }); } catch { /* ok */ }
    }
  };

  const changerVitesseCamion = async (missionId, v) => {
    setMultiplicateurs(prev => ({ ...prev, [missionId]: v }));
    try { await api.post(`/simulation/vitesse/${missionId}`, { multiplicateur: v }); } catch { /* ok */ }
  };

  return (
    <div className="d-flex h-100 overflow-hidden position-relative">

      {/* PANNEAU LATÉRAL */}
      <div className={`d-flex flex-column bg-slate-900 text-white flex-shrink-0 overflow-hidden`}
           style={{ width: panneauOuvert ? '288px' : '0px', transition: 'width 0.3s' }}>

        <div className="p-3 border-bottom border-slate-700 flex-shrink-0">
          <div className="d-flex align-items-center justify-content-between mb-1">
            <h2 className="fw-bold small d-flex align-items-center gap-2 mb-0">
              <Truck size={16} className="text-orange-500" /> Camions en mission
            </h2>
            <span className="badge bg-warning text-dark rounded-pill">{nbEnMission}</span>
          </div>
          {derniereMaj && (
            <p className="text-slate-500 mb-1" style={{ fontSize: '11px' }}>
              <Clock size={12} className="me-1" />
              Mis à jour {derniereMaj.toLocaleTimeString('fr-FR')}
            </p>
          )}
          <button onClick={chargerActifs}
                  className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-1 bg-slate-800 text-slate-300 border-0"
                  style={{ fontSize: '12px' }}>
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>

        <div className="flex-grow-1 overflow-y-auto p-2 d-flex flex-column gap-2">
          {chargement ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-warning" role="status" />
            </div>
          ) : camionsList.length === 0 ? (
            <div className="text-center py-4 text-slate-500 small">
              <Truck size={40} className="mb-2 opacity-25 d-block mx-auto" />
              <p className="mb-0">Aucune simulation active</p>
              <p className="text-xs mt-1 mb-0">Démarrez une mission depuis la page Missions</p>
            </div>
          ) : (
            camionsList.map((c) => (
              <div key={c.missionId} className="bg-slate-800 rounded-3 p-3 border-start border-3"
                   style={{ borderColor: c.couleur }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold small flex-shrink-0"
                       style={{ width: '32px', height: '32px', background: c.couleur }}>
                    {c.initiale}
                  </div>
                  <div className="min-w-0">
                    <p className="fw-bold small font-monospace mb-0 text-truncate">{c.immatriculation}</p>
                    <p className="text-slate-400 text-xs mb-0 text-truncate">{c.chauffeur_nom}</p>
                  </div>
                  {c.enPause && (
                    <span className="ms-auto badge rounded-pill bg-warning bg-opacity-25 text-orange-400 flex-shrink-0" style={{ fontSize: '10px' }}>Arrêt</span>
                  )}
                </div>

                <p className="text-slate-300 text-xs mb-2 text-truncate">{c.titre}</p>

                <div className="mb-2">
                  <div className="d-flex justify-content-between mb-1" style={{ fontSize: '10px', color: '#94a3b8' }}>
                    <span className="text-truncate">{c.lieu_depart}</span>
                    <span className="fw-bold text-white mx-1">{c.progression}%</span>
                    <span className="text-truncate text-end">{c.lieu_destination}</span>
                  </div>
                  <div className="bg-slate-700 rounded-pill" style={{ height: '6px' }}>
                    <div className="rounded-pill h-100" style={{ width: `${c.progression}%`, background: c.couleur, transition: 'width 0.5s' }} />
                  </div>
                </div>

                <div className="d-flex align-items-center gap-3 mb-2" style={{ fontSize: '11px', color: '#94a3b8' }}>
                  <span className="d-flex align-items-center gap-1"><Gauge size={12} /> {c.enPause ? '0' : c.vitesse} km/h</span>
                  <span className="d-flex align-items-center gap-1">
                    <MapPin size={12} /> {Math.round((c.distanceKm || 0) * c.progression / 100)} / {Math.round(c.distanceKm || 0)} km
                  </span>
                </div>

                {c.evenementActuel && (
                  <div className="d-flex align-items-center gap-2 bg-slate-700 rounded-2 px-2 py-1 mb-2" style={{ fontSize: '11px' }}>
                    <AlertTriangle size={12} className="text-orange-400 flex-shrink-0" />
                    <span className="text-orange-300 text-truncate">{c.evenementActuel.label}</span>
                  </div>
                )}

                <div className="d-flex align-items-center gap-1 mb-2">
                  <span className="text-slate-500 me-1" style={{ fontSize: '10px' }}>Vitesse :</span>
                  {[1, 5, 10, 30, 60].map(v => (
                    <button key={v} onClick={() => changerVitesseCamion(c.missionId, v)}
                            className={`btn border-0 px-1 py-0 fw-bold ${(multiplicateurs[c.missionId] || 30) === v ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                            style={{ fontSize: '10px', borderRadius: '4px' }}>
                      x{v}
                    </button>
                  ))}
                </div>

                <button onClick={() => setCible({ ...c.position, _ts: Date.now() })}
                        className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-1 bg-slate-700 text-slate-300 border-0"
                        style={{ fontSize: '12px' }}>
                  <MapPin size={12} /> Centrer la carte
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bouton toggle panneau */}
      <button onClick={() => setPanneauOuvert(!panneauOuvert)}
              className="position-absolute top-50 translate-middle-y btn bg-slate-800 text-white border-0 d-flex align-items-center justify-content-center"
              style={{ left: panneauOuvert ? '288px' : '0px', width: '24px', height: '48px', borderRadius: '0 6px 6px 0', zIndex: 50, transition: 'left 0.3s' }}>
        {panneauOuvert ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* CARTE */}
      <div className="flex-grow-1 position-relative">
        <MapContainer center={[-18.9136, 47.5362]} zoom={7} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {camionsList.map((c) => (
            <div key={c.missionId}>
              {c.trace && c.trace.length > 1 && <Polyline positions={c.trace} color={c.couleur} weight={4} opacity={0.85} />}
              {c.position && (
                <Marker position={[c.position.lat, c.position.lng]} icon={creerIcone(c.couleur, c.initiale)}>
                  <Tooltip permanent direction="top" offset={[0, -26]}
                           className="bg-slate-900 text-white border-0 shadow-lg text-xs fw-bold" opacity={1}>
                    {c.immatriculation} · {c.progression}%
                  </Tooltip>
                  <Popup maxWidth={220}>
                    <div className="small d-flex flex-column gap-1">
                      <p className="fw-bold fs-6 font-monospace mb-0">{c.immatriculation}</p>
                      <p className="text-muted mb-0">Chauffeur : {c.chauffeur_nom}</p>
                      <p className="fw-medium mb-0">{c.titre}</p>
                      <p className="text-muted mb-0">{c.lieu_depart} → {c.lieu_destination}</p>
                      <div className="d-flex justify-content-between pt-1 border-top">
                        <span>Progression : <strong>{c.progression}%</strong></span>
                        <span>Vitesse : <strong>{c.enPause ? 0 : c.vitesse} km/h</strong></span>
                      </div>
                      {c.evenementActuel && <p className="text-warning fw-medium mb-0">{c.evenementActuel.label}</p>}
                    </div>
                  </Popup>
                </Marker>
              )}
            </div>
          ))}

          {cible && <CentrerSur cible={cible} />}
        </MapContainer>

        {/* Overlay top-right */}
        <div className="position-absolute top-0 end-0 m-3 d-flex align-items-center gap-2 flex-wrap justify-content-end" style={{ zIndex: 40 }}>
          {nbEnMission > 0 && (
            <div className="d-flex align-items-center gap-1 bg-slate-900 bg-opacity-90 rounded-3 p-2 shadow border border-slate-700">
              <span className="text-slate-400 text-xs px-1 d-flex align-items-center gap-1">
                <Gauge size={12} /> Tous
              </span>
              {[1, 5, 10, 30, 60].map(v => (
                <button key={v} onClick={() => changerVitesseGlobale(v)}
                        className={`btn border-0 px-2 py-1 rounded-2 text-xs fw-bold ${multiplicateurGlobal === v ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 bg-transparent'}`}>
                  x{v}
                </button>
              ))}
            </div>
          )}

          <div className="bg-slate-900 bg-opacity-90 text-white px-3 py-2 rounded-3 shadow d-flex align-items-center gap-2 small border border-slate-700">
            <Truck size={16} className="text-orange-500" />
            <span className="fw-bold">{nbEnMission}</span>
            <span className="text-slate-400">camion{nbEnMission > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Message si vide */}
        {!chargement && nbEnMission === 0 && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center pointer-events-none">
            <div className="bg-white bg-opacity-90 rounded-3 px-4 py-4 text-center shadow-lg">
              <Truck size={48} className="text-muted mb-3 d-block mx-auto" />
              <p className="text-dark fw-medium mb-1">Aucun camion en mission</p>
              <p className="text-muted small mb-0">Démarrez une simulation depuis la page Missions</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
