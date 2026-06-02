import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const iconeVehicule = new L.DivIcon({
  html: `
    <div style="
      width:32px;height:32px;
      background:#2563eb;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    ">
      <svg style="transform:rotate(45deg)" width="16" height="16"
           viewBox="0 0 24 24" fill="none"
           stroke="white" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
        <circle cx="7.5" cy="17" r="2.5"/>
        <circle cx="17.5" cy="17" r="2.5"/>
      </svg>
    </div>`,
  className: '',
  iconSize:   [32, 32],
  iconAnchor: [16, 32],
  popupAnchor:[0, -34]
});

const VILLES_COORDS = {
  'Antananarivo': [-18.9136, 47.5362],
  'Toamasina':    [-18.1539, 49.4017],
  'Antsirabe':    [-19.8659, 47.0328],
  'Fianarantsoa': [-21.4545, 47.0857],
  'Mahajanga':    [-15.7167, 46.3167],
  'Toliara':      [-23.3500, 43.6667],
  'Antsiranana':  [-12.3483, 49.2958]
};

const coordsVille = (nom) => {
  if (!nom) return [-18.9136, 47.5362];
  const cle = Object.keys(VILLES_COORDS).find(v =>
    nom.toLowerCase().includes(v.toLowerCase())
  );
  return cle ? VILLES_COORDS[cle] : [-18.9136, 47.5362];
};

export default function MapView({ vehicules = [], className = '' }) {
  return (
    <div className={`rounded-3 overflow-hidden border ${className}`} style={{ height: '320px' }}>
      <MapContainer
        center={[-18.9136, 47.5362]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {vehicules.map((v, index) => {
          const coords = coordsVille(v.lieu_destination);
          return (
            <Marker key={v.id || index} position={coords} icon={iconeVehicule}>
              <Popup>
                <div className="small">
                  <p className="fw-bold text-primary mb-1">{v.immatriculation}</p>
                  <p className="mb-1">{v.marque} {v.modele}</p>
                  <p className="text-muted mb-1">
                    Chauffeur : {v.chauffeur_prenom} {v.chauffeur_nom}
                  </p>
                  <p className="text-muted mb-0">→ {v.lieu_destination}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
