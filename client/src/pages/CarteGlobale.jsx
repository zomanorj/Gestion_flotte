// Carte globale en temps réel — tous les camions en mission simultanément
import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import {
  Truck, RefreshCw, ChevronLeft, ChevronRight,
  MapPin, AlertTriangle, Clock, Gauge
} from 'lucide-react';
import api from '../services/api';

// Palette de couleurs uniques par camion
const PALETTE = [
  '#f97316', // orange
  '#3b82f6', // bleu
  '#22c55e', // vert
  '#a855f7', // violet
  '#ef4444', // rouge
  '#eab308', // jaune
  '#06b6d4', // cyan
  '#ec4899', // rose
];

/**
 * Retourne la couleur assignée à un camion selon son index dans la liste.
 */
const couleurParIndex = (index) => PALETTE[index % PALETTE.length];

/**
 * Crée un marqueur DivIcon coloré avec l'initiale de l'immatriculation.
 */
function creerIcone(couleur, initiale) {
  return L.divIcon({
    html: `
      <div style="
        background:${couleur};
        border:3px solid white;
        border-radius:50%;
        width:44px;height:44px;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px rgba(0,0,0,0.4);
        font-weight:bold;font-size:14px;color:white;
        font-family:monospace;
      ">${initiale}</div>`,
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
    popupAnchor:[0, -26],
    className:  ''
  });
}

/** Centre la carte sur une position donnée */
function CentrerSur({ cible }) {
  const map = useMap();
  useEffect(() => {
    if (cible) map.setView([cible.lat, cible.lng], 11, { animate: true, duration: 1 });
  }, [cible, map]);
  return null;
}

/** Formate une durée en secondes */
function formatTemps(sec) {
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min`;
  return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}min`;
}

export default function CarteGlobale() {
  const socketRef = useRef(null);

  // camions : { [missionId]: { position, progression, vitesse, enPause, evenementActuel,
  //              immatriculation, chauffeur_nom, titre, lieu_depart, lieu_destination,
  //              distanceKm, trace: [[lat,lng],...], couleur, initiale } }
  const [camions,       setCamions]       = useState({});
  const [indicesCouleur, setIndicesCouleur] = useState({}); // { missionId: index }
  const [cible,         setCible]         = useState(null); // position à centrer
  const [panneauOuvert, setPanneauOuvert] = useState(true);
  const [derniereMaj,   setDerniereMaj]   = useState(null);
  const [chargement,    setChargement]    = useState(true);

  // Assigne une couleur stable à chaque missionId
  const getCouleur = useCallback((missionId) => {
    setIndicesCouleur(prev => {
      if (prev[missionId] !== undefined) return prev;
      return { ...prev, [missionId]: Object.keys(prev).length };
    });
    return indicesCouleur[missionId] ?? 0;
  }, [indicesCouleur]);

  /** Initialise les camions depuis l'état actuel des simulations */
  const chargerActifs = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await api.get('/simulation/actives');
      const nouvellesDonnees = {};
      const nouveauxIndices  = {};

      data.forEach((c, i) => {
        nouveauxIndices[c.missionId] = i;
        const initiale = (c.immatriculation || '?').replace(/[^A-Z0-9]/gi, '').charAt(0).toUpperCase();
        nouvellesDonnees[c.missionId] = {
          ...c,
          trace:   c.position ? [[c.position.lat, c.position.lng]] : [],
          couleur: couleurParIndex(i),
          initiale
        };
      });

      setCamions(nouvellesDonnees);
      setIndicesCouleur(nouveauxIndices);
    } catch {
      // Aucune simulation active ou serveur inaccessible
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerActifs();

    // Connexion Socket.io
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const socket = socketRef.current;

    socket.on('flotte:positions', (positions) => {
      setDerniereMaj(new Date());

      setCamions(prev => {
        const suivant = { ...prev };

        positions.forEach((c) => {
          const id      = c.missionId;
          const existant = suivant[id];
          const indexCouleur = existant
            ? Object.keys(suivant).indexOf(id)
            : Object.keys(suivant).length;

          const initiale = (c.immatriculation || '?').replace(/[^A-Z0-9]/gi, '').charAt(0).toUpperCase();

          suivant[id] = {
            ...existant,
            ...c,
            couleur:  existant?.couleur || couleurParIndex(indexCouleur),
            initiale: existant?.initiale || initiale,
            // Accumule le tracé (max 500 points pour les performances)
            trace: existant?.trace
              ? [...existant.trace.slice(-499), [c.position.lat, c.position.lng]]
              : [[c.position.lat, c.position.lng]]
          };
        });

        // Supprime les simulations terminées (non présentes dans le broadcast)
        const idsActifs = positions.map(p => p.missionId);
        Object.keys(suivant).forEach(id => {
          if (!idsActifs.includes(id)) delete suivant[id];
        });

        return suivant;
      });
    });

    return () => socket.disconnect();
  }, [chargerActifs]);

  const camionsList = Object.values(camions);
  const nbEnMission = camionsList.length;

  return (
    <div className="flex h-full overflow-hidden relative">

      {/* ── PANNEAU LATÉRAL ── */}
      <div className={`flex flex-col bg-slate-900 text-white transition-all duration-300 flex-shrink-0
                       ${panneauOuvert ? 'w-72' : 'w-0 overflow-hidden'}`}>

        {/* Header panneau */}
        <div className="p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-500" />
              Camions en mission
            </h2>
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {nbEnMission}
            </span>
          </div>
          {derniereMaj && (
            <p className="text-slate-500 text-[11px] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Mis à jour {derniereMaj.toLocaleTimeString('fr-FR')}
            </p>
          )}
          <button onClick={chargerActifs}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs
                       bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg transition-colors">
            <RefreshCw className="w-3 h-3" /> Actualiser
          </button>
        </div>

        {/* Liste des camions */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chargement ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
            </div>
          ) : camionsList.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Aucune simulation active</p>
              <p className="text-xs mt-1">Démarrez une mission depuis la page Missions</p>
            </div>
          ) : (
            camionsList.map((c) => (
              <div key={c.missionId}
                   className="bg-slate-800 rounded-xl p-3 border-l-4"
                   style={{ borderColor: c.couleur }}>

                {/* Identité */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
                                  text-white font-bold text-sm"
                       style={{ background: c.couleur }}>
                    {c.initiale}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm font-mono truncate">{c.immatriculation}</p>
                    <p className="text-slate-400 text-xs truncate">{c.chauffeur_nom}</p>
                  </div>
                  {c.enPause && (
                    <span className="ml-auto bg-orange-500/20 text-orange-400 text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">
                      Arrêt
                    </span>
                  )}
                </div>

                {/* Mission */}
                <p className="text-slate-300 text-xs mb-2 truncate">{c.titre}</p>

                {/* Progression */}
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span className="truncate">{c.lieu_depart}</span>
                    <span className="font-bold text-white mx-1">{c.progression}%</span>
                    <span className="truncate text-right">{c.lieu_destination}</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all"
                         style={{ width: `${c.progression}%`, background: c.couleur }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    {c.enPause ? '0' : c.vitesse} km/h
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {Math.round((c.distanceKm || 0) * c.progression / 100)} / {Math.round(c.distanceKm || 0)} km
                  </span>
                </div>

                {/* Événement actuel */}
                {c.evenementActuel && (
                  <div className="flex items-center gap-1.5 text-[11px] bg-slate-700 rounded-lg px-2 py-1.5 mb-2">
                    <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0" />
                    <span className="text-orange-300 truncate">{c.evenementActuel.label}</span>
                  </div>
                )}

                {/* Bouton centrer */}
                <button
                  onClick={() => setCible({ ...c.position, _ts: Date.now() })}
                  className="w-full flex items-center justify-center gap-1.5 text-xs
                             bg-slate-700 hover:bg-slate-600 text-slate-300 py-1.5 rounded-lg transition-colors">
                  <MapPin className="w-3 h-3" /> Centrer la carte
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bouton toggle panneau */}
      <button
        onClick={() => setPanneauOuvert(!panneauOuvert)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-50
                   bg-slate-800 hover:bg-slate-700 text-white
                   w-6 h-12 flex items-center justify-center
                   rounded-r-lg shadow-lg transition-all"
        style={{ left: panneauOuvert ? '288px' : '0px' }}
      >
        {panneauOuvert
          ? <ChevronLeft className="w-4 h-4" />
          : <ChevronRight className="w-4 h-4" />
        }
      </button>

      {/* ── CARTE LEAFLET ── */}
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

          {camionsList.map((c) => (
            <div key={c.missionId}>
              {/* Tracé parcouru (couleur du camion) */}
              {c.trace && c.trace.length > 1 && (
                <Polyline positions={c.trace} color={c.couleur} weight={4} opacity={0.85} />
              )}

              {/* Marqueur du camion */}
              {c.position && (
                <Marker
                  position={[c.position.lat, c.position.lng]}
                  icon={creerIcone(c.couleur, c.initiale)}
                >
                  {/* Tooltip permanent : immatriculation + progression */}
                  <Tooltip permanent direction="top" offset={[0, -26]}
                           className="bg-slate-900 text-white border-0 shadow-lg text-xs font-bold"
                           opacity={1}>
                    {c.immatriculation} · {c.progression}%
                  </Tooltip>

                  {/* Popup au clic */}
                  <Popup maxWidth={220}>
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-base font-mono">{c.immatriculation}</p>
                      <p className="text-gray-600">Chauffeur : {c.chauffeur_nom}</p>
                      <p className="text-gray-800 font-medium">{c.titre}</p>
                      <p className="text-gray-500">{c.lieu_depart} → {c.lieu_destination}</p>
                      <div className="flex justify-between pt-1 border-t border-gray-200">
                        <span>Progression : <strong>{c.progression}%</strong></span>
                        <span>Vitesse : <strong>{c.enPause ? 0 : c.vitesse} km/h</strong></span>
                      </div>
                      {c.evenementActuel && (
                        <p className="text-orange-600 font-medium">{c.evenementActuel.label}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
            </div>
          ))}

          {/* Centrage sur un camion sélectionné */}
          {cible && <CentrerSur cible={cible} />}
        </MapContainer>

        {/* Badge nombre de camions (superposé sur la carte) */}
        <div className="absolute top-4 right-4 z-40 bg-slate-900/90 text-white
                        px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm">
          <Truck className="w-4 h-4 text-orange-500" />
          <span className="font-bold">{nbEnMission}</span>
          <span className="text-slate-400">camion{nbEnMission > 1 ? 's' : ''} en mission</span>
        </div>

        {/* Message si vide */}
        {!chargement && nbEnMission === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 rounded-2xl px-8 py-6 text-center shadow-xl">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Aucun camion en mission</p>
              <p className="text-gray-400 text-sm mt-1">
                Démarrez une simulation depuis la page Missions
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
