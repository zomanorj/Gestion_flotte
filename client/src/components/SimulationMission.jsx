// Composant de simulation de mission en temps réel — avec accélérateur de vitesse
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import {
  Truck, AlertTriangle, CheckCircle2, Clock,
  MapPin, Zap, X, Gauge, Route, Timer, Flag
} from 'lucide-react';

// Icône camion SVG pour le marqueur Leaflet
const iconeCamion = L.divIcon({
  html: `
    <div style="
      background:#f97316;border:3px solid white;border-radius:50%;
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

/** Suit le camion sur la carte */
function SuivreCamion({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo([position.lat, position.lng], { animate: true, duration: 0.4 });
  }, [position, map]);
  return null;
}

/** Formate une durée en minutes → "Xh Ymin" */
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
  const [evenementsPrevus,  setEvenementsPrevus]  = useState([]); // tous les événements du trajet
  const [infoRoute,         setInfoRoute]         = useState(null);
  const [suivreActif,       setSuivreActif]       = useState(true);
  const [multiplicateur,    setMultiplicateur]    = useState(30);
  const [erreur,            setErreur]            = useState('');
  const [tempsDebut,        setTempsDebut]        = useState(null);
  const [tempsEcoule,       setTempsEcoule]       = useState(0); // secondes

  // Timer pour mettre à jour le temps écoulé chaque seconde
  useEffect(() => {
    if (!tempsDebut || etat === 'termine') return;
    const t = setInterval(() => {
      setTempsEcoule(Math.floor((Date.now() - tempsDebut) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [tempsDebut, etat]);

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const socket = socketRef.current;

    socket.on(`mission:${mission.id}:debut`, (data) => {
      setTraceComplet(data.route.map(p => [p.lat, p.lng]));
      setInfoRoute({ distanceKm: data.distanceKm, totalPoints: data.totalPoints });
      setEtat('en_route');
      setTempsDebut(Date.now());
      setMultiplicateur(data.multiplicateur || 30);

      setMarqueurEvts(data.evenements.map(e => ({
        position: data.route[e.indexPoint],
        label: e.label, couleur: e.couleur
      })));
      setEvenementsPrevus(data.evenements); // garde la liste complète
    });

    socket.on(`mission:${mission.id}:position`, (data) => {
      setPositionCamion(data.position);
      setProgression(data.progression);
      setIndexActuel(data.indexActuel);
      setTraceParcouru(prev => [...prev, [data.position.lat, data.position.lng]]);
    });

    socket.on(`mission:${mission.id}:evenement`, (data) => {
      setEvenementActuel(data.evenement);
      setEtat('evenement');
      setHistoriqueEvts(prev => [
        { ...data.evenement, heure: new Date().toLocaleTimeString('fr-FR') },
        ...prev
      ]);
    });

    socket.on(`mission:${mission.id}:reprise`, () => {
      setEvenementActuel(null);
      setEtat('en_route');
    });

    socket.on(`mission:${mission.id}:termine`, () => {
      setEtat('termine');
      setProgression(100);
    });

    // Synchronisation du multiplicateur si changé depuis un autre client
    socket.on(`mission:${mission.id}:vitesse`, (data) => {
      setMultiplicateur(data.multiplicateur);
    });

    socket.on(`mission:${mission.id}:erreur`, (data) => {
      setErreur(data.message);
      setEtat('attente');
    });

    return () => socket.disconnect();
  }, [mission.id]);

  /** Démarre la simulation via l'API */
  const demarrer = async () => {
    setErreur('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/simulation/demarrer/${mission.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const body = await res.json();
        setErreur(body.message || 'Erreur lors du démarrage');
      }
    } catch {
      setErreur('Impossible de joindre le serveur');
    }
  };

  /** Change la vitesse de simulation */
  const changerVitesse = async (v) => {
    setMultiplicateur(v); // optimistic update
    const token = localStorage.getItem('token');
    await fetch(`/api/simulation/vitesse/${mission.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ multiplicateur: v })
    });
  };

  // Calculs temps réel
  const distanceKm       = infoRoute?.distanceKm || 0;
  const distParcourue    = Math.round(distanceKm * progression / 100);
  const distRestante     = Math.round(distanceKm * (100 - progression) / 100);
  const vitesseKmh       = etat === 'evenement' ? 0 : 60 * multiplicateur;
  const tempsRestantMin  = vitesseKmh > 0 ? distRestante / vitesseKmh * 60 : null;
  const prochainEvts     = evenementsPrevus
    .filter(e => e.indexPoint > indexActuel && !e.declenche)
    .slice(0, 3);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">

      {/* ── HEADER ── */}
      <div className="bg-slate-900 text-white px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <Truck className="w-5 h-5 text-orange-500 flex-shrink-0" />

        <div className="min-w-0 flex-shrink-0">
          <p className="font-bold text-sm leading-tight truncate max-w-[180px]">{mission.titre}</p>
          <p className="text-slate-400 text-xs truncate">{mission.lieu_depart} → {mission.lieu_destination}</p>
        </div>

        {/* Barre de progression */}
        <div className="flex-1 mx-2 min-w-0">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span className="truncate text-[11px]">{mission.lieu_depart}</span>
            <span className="text-orange-400 font-bold mx-1">{progression}%</span>
            <span className="truncate text-[11px] text-right">{mission.lieu_destination}</span>
          </div>
          <div className="bg-slate-700 rounded-full h-2">
            <div className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                 style={{ width: `${progression}%` }} />
          </div>
        </div>

        {/* Sélecteur de vitesse */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 flex-shrink-0">
          <span className="text-slate-400 text-xs px-1">
            <Gauge className="w-3.5 h-3.5 inline mr-0.5" />Vitesse
          </span>
          {VITESSES_DISPO.map(v => (
            <button key={v} onClick={() => changerVitesse(v)}
              className={`px-2 py-1 rounded text-xs font-bold transition-all
                ${multiplicateur === v
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
              x{v}
            </button>
          ))}
        </div>

        {/* Vitesse affichée */}
        <div className="text-orange-400 text-sm font-bold flex-shrink-0 min-w-[70px]">
          {vitesseKmh} km/h
        </div>

        {/* Statut */}
        <div className="flex-shrink-0 text-xs">
          {etat === 'en_route'  && <span className="text-green-400">En route</span>}
          {etat === 'evenement' && <span className="text-orange-400 animate-pulse">Arrêt</span>}
          {etat === 'termine'   && <span className="text-green-400">Arrivé</span>}
        </div>

        <button onClick={onFermer}
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-lg flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── CORPS ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* CARTE */}
        <div className="flex-1 relative">
          <MapContainer
            center={[-18.9136, 47.5362]} zoom={7}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Tracé complet (gris pointillé) */}
            {traceComplet.length > 1 && (
              <Polyline positions={traceComplet} color="#94a3b8" weight={4} opacity={0.4} dashArray="10,6" />
            )}

            {/* Tracé parcouru (orange) */}
            {traceParcouru.length > 1 && (
              <Polyline positions={traceParcouru} color="#f97316" weight={5} opacity={0.95} />
            )}

            {/* Marqueur camion */}
            {positionCamion && (
              <Marker position={[positionCamion.lat, positionCamion.lng]} icon={iconeCamion}>
                <Popup>
                  <strong>{mission.titre}</strong><br />Progression : {progression}%
                </Popup>
              </Marker>
            )}

            {/* Marqueurs événements */}
            {marqueurEvts.map((evt, i) => (
              <Marker key={i}
                position={[evt.position.lat, evt.position.lng]}
                icon={L.divIcon({
                  html: `<div style="background:${COULEURS_EVT[evt.couleur]||'#6b7280'};border-radius:50%;width:10px;height:10px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
                  iconSize: [10, 10], iconAnchor: [5, 5], className: ''
                })}>
                <Popup><span className="text-sm">{evt.label}</span></Popup>
              </Marker>
            ))}

            {suivreActif && positionCamion && <SuivreCamion position={positionCamion} />}
          </MapContainer>

          {/* Overlay "Démarrer" */}
          {etat === 'attente' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-4">
              {erreur && (
                <div className="flex items-center gap-2 bg-red-900/80 text-red-200 px-4 py-2 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4" /> {erreur}
                </div>
              )}
              <button onClick={demarrer}
                className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white
                           px-10 py-5 rounded-2xl text-xl font-bold flex items-center gap-3
                           shadow-2xl transition-all">
                <Zap className="w-7 h-7" /> Démarrer la mission
              </button>
              <p className="text-slate-400 text-sm">{mission.lieu_depart} → {mission.lieu_destination}</p>
            </div>
          )}

          {/* Overlay événement */}
          {etat === 'evenement' && evenementActuel && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
              <div className="bg-white rounded-xl shadow-2xl p-4 border-l-4"
                   style={{ borderColor: COULEURS_EVT[evenementActuel.couleur] || '#6b7280' }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0"
                    style={{ color: COULEURS_EVT[evenementActuel.couleur] }} />
                  <span className="font-bold text-gray-800">{evenementActuel.label}</span>
                </div>
                <p className="text-gray-600 text-sm">{evenementActuel.description}</p>
                <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Arrêt : {evenementActuel.dureeMin} min
                </p>
              </div>
            </div>
          )}

          {/* Overlay terminé */}
          {etat === 'termine' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-xs">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Mission terminée !</h3>
                <p className="text-gray-500 mb-1">Arrivée à {mission.lieu_destination}</p>
                {infoRoute && (
                  <p className="text-gray-400 text-sm">{Math.round(infoRoute.distanceKm)} km parcourus</p>
                )}
                <button onClick={onFermer}
                  className="mt-6 bg-orange-500 hover:bg-orange-600 text-white px-8 py-2.5 rounded-xl font-medium">
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Bouton suivi */}
          <button onClick={() => setSuivreActif(!suivreActif)}
            className={`absolute bottom-4 right-4 z-40 flex items-center gap-2
                        px-3 py-2 rounded-xl text-sm font-medium shadow-lg transition-colors
                        ${suivreActif ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
            <MapPin className="w-4 h-4" />
            {suivreActif ? 'Suivi activé' : 'Suivi désactivé'}
          </button>
        </div>

        {/* ── PANNEAU LATÉRAL ── */}
        <div className="w-72 bg-slate-900 text-white flex flex-col flex-shrink-0 overflow-hidden">

          {/* Informations en direct */}
          <div className="p-3 border-b border-slate-700 space-y-2">
            <h3 className="text-orange-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" /> En direct
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 rounded-lg p-2 text-center">
                <div className="text-orange-400 text-lg font-bold">{vitesseKmh}</div>
                <div className="text-slate-400">km/h</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-2 text-center">
                <div className="text-orange-400 text-lg font-bold">{historiqueEvts.length}</div>
                <div className="text-slate-400">arrêts</div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-1 text-slate-400">
                  <Route className="w-3 h-3" /> Parcouru
                </span>
                <span className="font-medium">{distParcourue} km</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-1 text-slate-400">
                  <Flag className="w-3 h-3" /> Restant
                </span>
                <span className="font-medium">{distRestante} km</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-1 text-slate-400">
                  <Timer className="w-3 h-3" /> Écoulé
                </span>
                <span className="font-medium">{formatDuree(tempsEcoule / 60)}</span>
              </div>
              {tempsRestantMin !== null && (
                <div className="flex justify-between text-slate-300">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3" /> Restant estimé
                  </span>
                  <span className="font-medium">{formatDuree(tempsRestantMin)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Prochains événements prévus */}
          {prochainEvts.length > 0 && (
            <div className="p-3 border-b border-slate-700">
              <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Prochains incidents prévus
              </h3>
              <div className="space-y-1.5">
                {prochainEvts.map((evt, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                         style={{ background: COULEURS_EVT[evt.couleur] || '#6b7280' }} />
                    <span className="text-slate-300 truncate">{evt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique des événements */}
          <div className="px-3 pt-3 pb-1">
            <h3 className="text-orange-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Incidents
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {historiqueEvts.length === 0 ? (
              <p className="text-slate-500 text-xs text-center mt-6">Aucun incident pour l'instant…</p>
            ) : (
              historiqueEvts.map((evt, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-2.5 border-l-4"
                     style={{ borderColor: COULEURS_EVT[evt.couleur] || '#6b7280' }}>
                  <div className="flex justify-between items-start gap-1 mb-0.5">
                    <span className="font-medium text-xs text-white leading-tight">{evt.label}</span>
                    <span className="text-slate-500 text-[10px] flex-shrink-0">{evt.heure}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{evt.description}</p>
                  <p className="text-slate-500 text-[10px] mt-1 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {evt.dureeMin} min
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
