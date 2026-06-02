import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { Truck, AlertTriangle, CheckCircle2, Clock, MapPin, Zap, X, Gauge, Route, Timer, Flag } from 'lucide-react';

const iconeCamion = L.divIcon({
  html: `
    <div style="background:#f97316;border:3px solid white;border-radius:50%;
      width:40px;height:40px;display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 10px rgba(0,0,0,0.4);">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 5v4h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    </div>`,
  iconSize: [40, 40], iconAnchor: [20, 20], className: ''
});

const COULEURS_EVT = {
  panne: '#ef4444', arret: '#eab308', controle: '#3b82f6',
  pause: '#22c55e', ralentissement: '#f97316', purple: '#a855f7'
};

const VITESSES_DISPO = [1, 5, 10, 30, 60];

function SuivreCamion({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo([position.lat, position.lng], { animate: true, duration: 0.4 });
  }, [position, map]);
  return null;
}

function formatDuree(minutes) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}min`;
}

export default function SimulationMission({ mission, onFermer }) {
  const socketRef = useRef(null);
  const [etat,              setEtat]              = useState('attente');
  const [positionCamion,    setPositionCamion]    = useState(null);
  const [traceParcouru,     setTraceParcouru]     = useState([]);
  const [traceComplet,      setTraceComplet]      = useState([]);
  const [progression,       setProgression]       = useState(0);
  const [indexActuel,       setIndexActuel]       = useState(0);
  const [evenementActuel,   setEvenementActuel]   = useState(null);
  const [historiqueEvts,    setHistoriqueEvts]    = useState([]);
  const [marqueurEvts,      setMarqueurEvts]      = useState([]);
  const [evenementsPrevus,  setEvenementsPrevus]  = useState([]);
  const [infoRoute,         setInfoRoute]         = useState(null);
  const [suivreActif,       setSuivreActif]       = useState(true);
  const [multiplicateur,    setMultiplicateur]    = useState(30);
  const [erreur,            setErreur]            = useState('');
  const [tempsDebut,        setTempsDebut]        = useState(null);
  const [tempsEcoule,       setTempsEcoule]       = useState(0);

  useEffect(() => {
    if (!tempsDebut || etat === 'termine') return;
    const t = setInterval(() => setTempsEcoule(Math.floor((Date.now() - tempsDebut) / 1000)), 1000);
    return () => clearInterval(t);
  }, [tempsDebut, etat]);

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const socket = socketRef.current;

    socket.on(`mission:${mission.id}:debut`, (data) => {
      setTraceComplet(data.route.map(p => [p.lat, p.lng]));
      setInfoRoute({ distanceKm: data.distanceKm, totalPoints: data.totalPoints });
      setEtat('en_route'); setTempsDebut(Date.now()); setMultiplicateur(data.multiplicateur || 30);
      setMarqueurEvts(data.evenements.map(e => ({ position: data.route[e.indexPoint], label: e.label, couleur: e.couleur })));
      setEvenementsPrevus(data.evenements);
    });
    socket.on(`mission:${mission.id}:position`, (data) => {
      setPositionCamion(data.position); setProgression(data.progression); setIndexActuel(data.indexActuel);
      setTraceParcouru(prev => [...prev, [data.position.lat, data.position.lng]]);
    });
    socket.on(`mission:${mission.id}:evenement`, (data) => {
      setEvenementActuel(data.evenement); setEtat('evenement');
      setHistoriqueEvts(prev => [{ ...data.evenement, heure: new Date().toLocaleTimeString('fr-FR') }, ...prev]);
    });
    socket.on(`mission:${mission.id}:reprise`, () => { setEvenementActuel(null); setEtat('en_route'); });
    socket.on(`mission:${mission.id}:termine`, () => { setEtat('termine'); setProgression(100); });
    socket.on(`mission:${mission.id}:vitesse`, (data) => setMultiplicateur(data.multiplicateur));
    socket.on(`mission:${mission.id}:erreur`, (data) => { setErreur(data.message); setEtat('attente'); });

    return () => socket.disconnect();
  }, [mission.id]);

  const demarrer = async () => {
    setErreur('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/simulation/demarrer/${mission.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) { const body = await res.json(); setErreur(body.message || 'Erreur lors du démarrage'); }
    } catch {
      setErreur('Impossible de joindre le serveur');
    }
  };

  const changerVitesse = async (v) => {
    setMultiplicateur(v);
    const token = localStorage.getItem('token');
    await fetch(`/api/simulation/vitesse/${mission.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ multiplicateur: v })
    });
  };

  const distanceKm      = infoRoute?.distanceKm || 0;
  const distParcourue   = Math.round(distanceKm * progression / 100);
  const distRestante    = Math.round(distanceKm * (100 - progression) / 100);
  const vitesseKmh      = etat === 'evenement' ? 0 : 60 * multiplicateur;
  const tempsRestantMin = vitesseKmh > 0 ? distRestante / vitesseKmh * 60 : null;
  const prochainEvts    = evenementsPrevus.filter(e => e.indexPoint > indexActuel && !e.declenche).slice(0, 3);

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column bg-dark"
         style={{ zIndex: 2000 }}>

      {/* HEADER */}
      <div className="bg-slate-900 text-white px-3 py-2 d-flex align-items-center gap-3 flex-shrink-0">
        <Truck size={20} className="text-orange-500 flex-shrink-0" />

        <div className="min-w-0 flex-shrink-0">
          <p className="fw-bold small mb-0 text-truncate" style={{ maxWidth: '180px' }}>{mission.titre}</p>
          <p className="text-slate-400 text-xs mb-0 text-truncate">{mission.lieu_depart} → {mission.lieu_destination}</p>
        </div>

        {/* Barre de progression */}
        <div className="flex-grow-1 mx-2 min-w-0">
          <div className="d-flex justify-content-between text-xs text-slate-400 mb-1">
            <span className="text-truncate" style={{ fontSize: '11px' }}>{mission.lieu_depart}</span>
            <span className="text-orange-400 fw-bold mx-1">{progression}%</span>
            <span className="text-truncate text-end" style={{ fontSize: '11px' }}>{mission.lieu_destination}</span>
          </div>
          <div className="bg-slate-700 rounded-pill" style={{ height: '8px' }}>
            <div className="bg-orange-500 rounded-pill h-100" style={{ width: `${progression}%`, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* Sélecteur vitesse */}
        <div className="d-flex align-items-center gap-1 bg-slate-800 rounded-2 p-1 flex-shrink-0">
          <span className="text-slate-400 text-xs px-1"><Gauge size={14} className="me-1" />Vitesse</span>
          {VITESSES_DISPO.map(v => (
            <button key={v} onClick={() => changerVitesse(v)}
                    className={`btn btn-sm px-2 py-1 text-xs fw-bold ${multiplicateur === v ? 'bg-orange-500 text-white' : 'text-slate-400 bg-transparent'}`}
                    style={{ fontSize: '11px' }}>
              x{v}
            </button>
          ))}
        </div>

        <div className="text-orange-400 small fw-bold flex-shrink-0">{vitesseKmh} km/h</div>

        <div className="flex-shrink-0 text-xs">
          {etat === 'en_route'  && <span className="text-success">En route</span>}
          {etat === 'evenement' && <span className="text-orange-400 animate-pulse">Arrêt</span>}
          {etat === 'termine'   && <span className="text-success">Arrivé</span>}
        </div>

        <button onClick={onFermer} className="btn btn-sm text-slate-400 flex-shrink-0 p-1">
          <X size={20} />
        </button>
      </div>

      {/* CORPS */}
      <div className="d-flex flex-grow-1 overflow-hidden">

        {/* CARTE */}
        <div className="flex-grow-1 position-relative">
          <MapContainer center={[-18.9136, 47.5362]} zoom={7}
                        style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {traceComplet.length > 1 && <Polyline positions={traceComplet} color="#94a3b8" weight={4} opacity={0.4} dashArray="10,6" />}
            {traceParcouru.length > 1 && <Polyline positions={traceParcouru} color="#f97316" weight={5} opacity={0.95} />}
            {positionCamion && (
              <Marker position={[positionCamion.lat, positionCamion.lng]} icon={iconeCamion}>
                <Popup><strong>{mission.titre}</strong><br />Progression : {progression}%</Popup>
              </Marker>
            )}
            {marqueurEvts.map((evt, i) => (
              <Marker key={i} position={[evt.position.lat, evt.position.lng]}
                      icon={L.divIcon({
                        html: `<div style="background:${COULEURS_EVT[evt.couleur]||'#6b7280'};border-radius:50%;width:10px;height:10px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
                        iconSize: [10, 10], iconAnchor: [5, 5], className: ''
                      })}>
                <Popup><span className="small">{evt.label}</span></Popup>
              </Marker>
            ))}
            {suivreActif && positionCamion && <SuivreCamion position={positionCamion} />}
          </MapContainer>

          {/* Overlay démarrer */}
          {etat === 'attente' && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center gap-3"
                 style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
              {erreur && (
                <div className="d-flex align-items-center gap-2 bg-danger bg-opacity-75 text-white px-3 py-2 rounded-2 small">
                  <AlertTriangle size={16} /> {erreur}
                </div>
              )}
              <button onClick={demarrer}
                      className="btn btn-lg d-flex align-items-center gap-3 fw-bold shadow-lg"
                      style={{ backgroundColor: '#f97316', color: 'white', padding: '1.25rem 2.5rem', borderRadius: '1rem' }}>
                <Zap size={28} /> Démarrer la mission
              </button>
              <p className="text-white-50 small">{mission.lieu_depart} → {mission.lieu_destination}</p>
            </div>
          )}

          {/* Overlay événement */}
          {etat === 'evenement' && evenementActuel && (
            <div className="position-absolute top-0 start-50 translate-middle-x mt-3 px-3"
                 style={{ zIndex: 50, width: '100%', maxWidth: '24rem' }}>
              <div className="bg-white rounded-3 shadow-lg p-3 border-start border-4"
                   style={{ borderColor: COULEURS_EVT[evenementActuel.couleur] || '#6b7280' }}>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <AlertTriangle size={20} className="flex-shrink-0" style={{ color: COULEURS_EVT[evenementActuel.couleur] }} />
                  <span className="fw-bold text-dark">{evenementActuel.label}</span>
                </div>
                <p className="text-gray-600 small mb-1">{evenementActuel.description}</p>
                <p className="text-muted text-xs mb-0 d-flex align-items-center gap-1">
                  <Clock size={12} /> Arrêt : {evenementActuel.dureeMin} min
                </p>
              </div>
            </div>
          )}

          {/* Overlay terminé */}
          {etat === 'termine' && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                 style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
              <div className="bg-white rounded-3 p-4 text-center shadow-lg" style={{ maxWidth: '20rem' }}>
                <CheckCircle2 size={64} className="text-success mb-3" />
                <h3 className="fs-4 fw-bold text-dark mb-1">Mission terminée !</h3>
                <p className="text-muted mb-1">Arrivée à {mission.lieu_destination}</p>
                {infoRoute && <p className="text-muted small">{Math.round(infoRoute.distanceKm)} km parcourus</p>}
                <button onClick={onFermer} className="btn btn-warning mt-3 text-white px-4">Fermer</button>
              </div>
            </div>
          )}

          {/* Bouton suivi */}
          <button onClick={() => setSuivreActif(!suivreActif)}
                  className={`position-absolute bottom-0 end-0 mb-3 me-3 btn btn-sm d-flex align-items-center gap-2 ${suivreActif ? 'btn-warning text-white' : 'btn-light'}`}
                  style={{ zIndex: 40 }}>
            <MapPin size={16} />
            {suivreActif ? 'Suivi activé' : 'Suivi désactivé'}
          </button>
        </div>

        {/* PANNEAU LATÉRAL */}
        <div className="bg-slate-900 text-white d-flex flex-column flex-shrink-0 overflow-hidden" style={{ width: '288px' }}>

          {/* En direct */}
          <div className="p-3 border-bottom border-slate-700">
            <h3 className="text-orange-400 text-xs fw-semibold text-uppercase mb-2 d-flex align-items-center gap-1">
              <Gauge size={14} /> En direct
            </h3>
            <div className="row g-2 text-xs mb-2">
              <div className="col-6">
                <div className="bg-slate-800 rounded-2 p-2 text-center">
                  <div className="text-orange-400 fs-5 fw-bold">{vitesseKmh}</div>
                  <div className="text-slate-400">km/h</div>
                </div>
              </div>
              <div className="col-6">
                <div className="bg-slate-800 rounded-2 p-2 text-center">
                  <div className="text-orange-400 fs-5 fw-bold">{historiqueEvts.length}</div>
                  <div className="text-slate-400">arrêts</div>
                </div>
              </div>
            </div>
            <div className="d-flex flex-column gap-1 text-xs">
              {[
                { Icon: Route, label: 'Parcouru', val: `${distParcourue} km` },
                { Icon: Flag,  label: 'Restant',  val: `${distRestante} km` },
                { Icon: Timer, label: 'Écoulé',   val: formatDuree(tempsEcoule / 60) },
                ...(tempsRestantMin !== null ? [{ Icon: Clock, label: 'Restant estimé', val: formatDuree(tempsRestantMin) }] : [])
              ].map(({ Icon, label, val }) => (
                <div key={label} className="d-flex justify-content-between text-slate-300">
                  <span className="d-flex align-items-center gap-1 text-slate-400"><Icon size={12} /> {label}</span>
                  <span className="fw-medium">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prochains événements */}
          {prochainEvts.length > 0 && (
            <div className="p-3 border-bottom border-slate-700">
              <h3 className="text-slate-400 text-xs fw-semibold text-uppercase mb-2">Prochains incidents prévus</h3>
              <div className="d-flex flex-column gap-2">
                {prochainEvts.map((evt, i) => (
                  <div key={i} className="d-flex align-items-center gap-2 text-xs">
                    <div className="rounded-circle flex-shrink-0" style={{ width: '8px', height: '8px', background: COULEURS_EVT[evt.couleur] || '#6b7280' }} />
                    <span className="text-slate-300 text-truncate">{evt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incidents */}
          <div className="px-3 pt-3 pb-1">
            <h3 className="text-orange-400 text-xs fw-semibold text-uppercase d-flex align-items-center gap-1 mb-0">
              <AlertTriangle size={14} /> Incidents
            </h3>
          </div>

          <div className="flex-grow-1 overflow-y-auto px-3 pb-3 d-flex flex-column gap-2">
            {historiqueEvts.length === 0 ? (
              <p className="text-slate-500 text-xs text-center mt-4">Aucun incident pour l'instant…</p>
            ) : (
              historiqueEvts.map((evt, i) => (
                <div key={i} className="bg-slate-800 rounded-2 p-2 border-start border-3"
                     style={{ borderColor: COULEURS_EVT[evt.couleur] || '#6b7280' }}>
                  <div className="d-flex justify-content-between align-items-start gap-1 mb-1">
                    <span className="fw-medium text-xs text-white">{evt.label}</span>
                    <span className="text-slate-500 flex-shrink-0" style={{ fontSize: '10px' }}>{evt.heure}</span>
                  </div>
                  <p className="text-slate-400 mb-1" style={{ fontSize: '11px' }}>{evt.description}</p>
                  <p className="text-slate-500 mb-0 d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                    <Clock size={10} /> {evt.dureeMin} min
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
