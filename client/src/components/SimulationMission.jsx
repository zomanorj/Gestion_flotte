// Composant de simulation de mission en temps réel
// Affiche une carte plein écran avec le camion animé sur la vraie route
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import {
  Truck, AlertTriangle, CheckCircle2,
  Clock, MapPin, Zap, X
} from 'lucide-react';

// Icône camion SVG pour le marqueur Leaflet (pas d'emoji)
const iconeCamion = L.divIcon({
  html: `
    <div style="
      background:#f97316;
      border:3px solid white;
      border-radius:50%;
      width:40px;height:40px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 10px rgba(0,0,0,0.4);
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="white" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 5v4h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    </div>`,
  iconSize:   [40, 40],
  iconAnchor: [20, 20],
  className:  ''
});

// Palette couleurs par type d'événement
const COULEURS_EVENEMENT = {
  panne:         '#ef4444',
  arret:         '#eab308',
  controle:      '#3b82f6',
  pause:         '#22c55e',
  ralentissement:'#f97316',
  purple:        '#a855f7'
};

/**
 * Sous-composant Leaflet : centre automatiquement la carte sur le camion.
 */
function SuivreCamion({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.5 });
    }
  }, [position, map]);
  return null;
}

/**
 * Composant principal de simulation plein écran.
 * @param {Object} mission   - Données de la mission à simuler
 * @param {Function} onFermer - Callback pour fermer la simulation
 */
export default function SimulationMission({ mission, onFermer }) {
  const socketRef = useRef(null);

  const [etat,           setEtat]           = useState('attente');
  // 'attente' | 'en_route' | 'evenement' | 'termine'

  const [positionCamion,      setPositionCamion]      = useState(null);
  const [traceParcouru,       setTraceParcouru]        = useState([]);
  const [traceComplet,        setTraceComplet]         = useState([]);
  const [progression,         setProgression]          = useState(0);
  const [evenementActuel,     setEvenementActuel]      = useState(null);
  const [historiqueEvenements,setHistoriqueEvenements] = useState([]);
  const [marqueurEvenements,  setMarqueurEvenements]   = useState([]);
  const [infoRoute,           setInfoRoute]            = useState(null);
  const [suivreActif,         setSuivreActif]          = useState(true);
  const [erreur,              setErreur]               = useState('');

  useEffect(() => {
    // Connexion au serveur Socket.io
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const socket = socketRef.current;

    // Données initiales : tracé GPS + positions des événements prévus
    socket.on(`mission:${mission.id}:debut`, (data) => {
      setTraceComplet(data.route.map(p => [p.lat, p.lng]));
      setInfoRoute({
        distanceKm:  data.distanceKm,
        totalPoints: data.totalPoints
      });
      setEtat('en_route');

      // Marqueurs des événements aléatoires sur la carte
      setMarqueurEvenements(
        data.evenements.map(e => ({
          position: data.route[e.indexPoint],
          label:    e.label,
          couleur:  e.couleur
        }))
      );
    });

    // Position du camion à chaque tick de simulation
    socket.on(`mission:${mission.id}:position`, (data) => {
      setPositionCamion(data.position);
      setProgression(data.progression);
      setTraceParcouru(prev => [...prev, [data.position.lat, data.position.lng]]);
    });

    // Événement survenu sur la route
    socket.on(`mission:${mission.id}:evenement`, (data) => {
      setEvenementActuel(data.evenement);
      setEtat('evenement');
      setHistoriqueEvenements(prev => [
        { ...data.evenement, heure: new Date().toLocaleTimeString('fr-FR') },
        ...prev
      ]);
    });

    // Reprise du trajet après l'événement
    socket.on(`mission:${mission.id}:reprise`, () => {
      setEvenementActuel(null);
      setEtat('en_route');
    });

    // Arrivée à destination
    socket.on(`mission:${mission.id}:termine`, () => {
      setEtat('termine');
      setProgression(100);
    });

    // Erreur côté serveur
    socket.on(`mission:${mission.id}:erreur`, (data) => {
      setErreur(data.message);
      setEtat('attente');
    });

    return () => {
      socket.disconnect();
    };
  }, [mission.id]);

  /** Appelle l'API pour démarrer la simulation */
  const demarrer = async () => {
    setErreur('');
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(
        `/api/simulation/demarrer/${mission.id}`,
        {
          method:  'POST',
          headers: {
            'Authorization':  `Bearer ${token}`,
            'Content-Type':   'application/json'
          }
        }
      );
      if (!res.ok) {
        const body = await res.json();
        setErreur(body.message || 'Erreur lors du démarrage');
      }
    } catch {
      setErreur('Impossible de joindre le serveur');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">

      {/* ── HEADER ── */}
      <div className="bg-slate-900 text-white px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Truck className="w-6 h-6 text-orange-500 flex-shrink-0" />

        <div className="min-w-0">
          <h2 className="font-bold text-base leading-tight truncate">{mission.titre}</h2>
          <p className="text-slate-400 text-xs">
            {mission.lieu_depart} → {mission.lieu_destination}
            {infoRoute ? ` · ${Math.round(infoRoute.distanceKm)} km réels` : ''}
          </p>
        </div>

        {/* Barre de progression */}
        <div className="flex-1 mx-4 min-w-0">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span className="truncate">{mission.lieu_depart}</span>
            <span className="text-orange-400 font-bold mx-2">{progression}%</span>
            <span className="truncate text-right">{mission.lieu_destination}</span>
          </div>
          <div className="bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-orange-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progression}%` }}
            />
          </div>
        </div>

        {/* Statut */}
        <div className="flex-shrink-0">
          {etat === 'en_route'  && <span className="text-green-400 text-xs font-medium">En route</span>}
          {etat === 'evenement' && <span className="text-orange-400 text-xs font-medium animate-pulse">Incident</span>}
          {etat === 'termine'   && <span className="text-green-400 text-xs font-medium">Arrivé</span>}
        </div>

        <button
          onClick={onFermer}
          className="text-slate-400 hover:text-white flex-shrink-0 p-1 hover:bg-slate-700 rounded-lg transition-colors"
          title="Fermer la simulation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── CORPS : carte + panneau latéral ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* CARTE LEAFLET */}
        <div className="flex-1 relative">
          <MapContainer
            center={[-18.9136, 47.5362]}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Tracé complet de la route (gris pointillé) */}
            {traceComplet.length > 1 && (
              <Polyline
                positions={traceComplet}
                color="#94a3b8"
                weight={4}
                opacity={0.4}
                dashArray="10, 6"
              />
            )}

            {/* Tracé parcouru (orange) */}
            {traceParcouru.length > 1 && (
              <Polyline
                positions={traceParcouru}
                color="#f97316"
                weight={5}
                opacity={0.95}
              />
            )}

            {/* Marqueur camion animé */}
            {positionCamion && (
              <Marker
                position={[positionCamion.lat, positionCamion.lng]}
                icon={iconeCamion}
              >
                <Popup>
                  <strong>{mission.titre}</strong><br />
                  Progression : {progression}%
                </Popup>
              </Marker>
            )}

            {/* Marqueurs des événements planifiés sur le tracé */}
            {marqueurEvenements.map((evt, i) => (
              <Marker
                key={i}
                position={[evt.position.lat, evt.position.lng]}
                icon={L.divIcon({
                  html: `<div style="
                    background:${COULEURS_EVENEMENT[evt.couleur] || '#6b7280'};
                    border-radius:50%;
                    width:10px;height:10px;
                    border:2px solid white;
                    box-shadow:0 1px 4px rgba(0,0,0,0.3);
                  "></div>`,
                  iconSize:  [10, 10],
                  iconAnchor:[5, 5],
                  className: ''
                })}
              >
                <Popup><span className="text-sm">{evt.label}</span></Popup>
              </Marker>
            ))}

            {/* Suit le camion si activé */}
            {suivreActif && positionCamion && (
              <SuivreCamion position={positionCamion} />
            )}
          </MapContainer>

          {/* ── Overlay "Démarrer" avant le début ── */}
          {etat === 'attente' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-4">
              {erreur && (
                <div className="flex items-center gap-2 bg-red-900/80 text-red-200 px-4 py-2 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {erreur}
                </div>
              )}
              <button
                onClick={demarrer}
                className="bg-orange-500 hover:bg-orange-600 active:scale-95
                           text-white px-10 py-5 rounded-2xl text-xl font-bold
                           flex items-center gap-3 shadow-2xl transition-all"
              >
                <Zap className="w-7 h-7" />
                Démarrer la mission
              </button>
              <p className="text-slate-400 text-sm">
                {mission.lieu_depart} → {mission.lieu_destination}
              </p>
            </div>
          )}

          {/* ── Overlay événement en cours ── */}
          {etat === 'evenement' && evenementActuel && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
              <div
                className="bg-white rounded-xl shadow-2xl p-4 border-l-4 animate-bounce-once"
                style={{ borderColor: COULEURS_EVENEMENT[evenementActuel.couleur] || '#6b7280' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: COULEURS_EVENEMENT[evenementActuel.couleur] }}
                  />
                  <span className="font-bold text-gray-800">{evenementActuel.label}</span>
                </div>
                <p className="text-gray-600 text-sm">{evenementActuel.description}</p>
                <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Arrêt estimé : {evenementActuel.dureeMin} min
                </p>
              </div>
            </div>
          )}

          {/* ── Overlay mission terminée ── */}
          {etat === 'termine' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-xs">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Mission terminée !</h3>
                <p className="text-gray-500 mb-1">Arrivée à {mission.lieu_destination}</p>
                {infoRoute && (
                  <p className="text-gray-400 text-sm">
                    {Math.round(infoRoute.distanceKm)} km parcourus
                  </p>
                )}
                <button
                  onClick={onFermer}
                  className="mt-6 bg-orange-500 hover:bg-orange-600 text-white
                             px-8 py-2.5 rounded-xl font-medium transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Bouton suivi camion */}
          <button
            onClick={() => setSuivreActif(!suivreActif)}
            className={`absolute bottom-4 right-4 z-40 flex items-center gap-2
                        px-3 py-2 rounded-xl text-sm font-medium shadow-lg transition-colors
                        ${suivreActif
                          ? 'bg-orange-500 text-white'
                          : 'bg-white text-gray-700 border border-gray-200'}`}
          >
            <MapPin className="w-4 h-4" />
            {suivreActif ? 'Suivi activé' : 'Suivi désactivé'}
          </button>
        </div>

        {/* ── PANNEAU LATÉRAL — Historique des événements ── */}
        <div className="w-72 bg-slate-900 text-white flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="font-semibold text-orange-400 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Événements du trajet
            </h3>
          </div>

          {/* Liste des événements */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {historiqueEvenements.length === 0 ? (
              <p className="text-slate-500 text-sm text-center mt-10">
                Aucun incident pour l'instant…
              </p>
            ) : (
              historiqueEvenements.map((evt, i) => (
                <div
                  key={i}
                  className="bg-slate-800 rounded-lg p-3 border-l-4"
                  style={{ borderColor: COULEURS_EVENEMENT[evt.couleur] || '#6b7280' }}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-medium text-xs text-white leading-tight">{evt.label}</span>
                    <span className="text-slate-500 text-xs flex-shrink-0">{evt.heure}</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">{evt.description}</p>
                  <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {evt.dureeMin} min d'arrêt
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Stats en pied de panneau */}
          <div className="p-3 border-t border-slate-700 grid grid-cols-2 gap-2 flex-shrink-0">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-orange-400 text-2xl font-bold">{progression}%</div>
              <div className="text-slate-400 text-xs mt-0.5">Progression</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-orange-400 text-2xl font-bold">{historiqueEvenements.length}</div>
              <div className="text-slate-400 text-xs mt-0.5">Incidents</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
