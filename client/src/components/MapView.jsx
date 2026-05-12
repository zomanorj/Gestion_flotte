// Carte Leaflet centrée sur Antananarivo avec marqueurs des véhicules en mission
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Correction du bug d'icônes Leaflet avec les bundlers modernes
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Icône personnalisée pour les véhicules en mission
const iconeVehicule = new L.DivIcon({
  html: '<div style="font-size:24px;line-height:1;">🚙</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30]
});

// Coordonnées approximatives des grandes villes malgaches
const VILLES_COORDS = {
  'Antananarivo': [-18.9136, 47.5362],
  'Toamasina':    [-18.1539, 49.4017],
  'Antsirabe':    [-19.8659, 47.0328],
  'Fianarantsoa': [-21.4545, 47.0857],
  'Mahajanga':    [-15.7167, 46.3167],
  'Toliara':      [-23.3500, 43.6667],
  'Antsiranana':  [-12.3483, 49.2958]
};

/** Retourne les coordonnées d'une ville ou les coordonnées d'Antananarivo par défaut */
const coordsVille = (nom) => {
  if (!nom) return [-18.9136, 47.5362];
  const cle = Object.keys(VILLES_COORDS).find(v =>
    nom.toLowerCase().includes(v.toLowerCase())
  );
  return cle ? VILLES_COORDS[cle] : [-18.9136, 47.5362];
};

/**
 * Carte interactive des véhicules en mission.
 * @param {Array} vehicules - Liste de {immatriculation, marque, modele, lieu_destination, chauffeur_nom, chauffeur_prenom}
 * @param {string} className - Classes CSS pour le conteneur
 */
export default function MapView({ vehicules = [], className = 'h-80' }) {
  return (
    <div className={`rounded-xl overflow-hidden border border-gray-200 ${className}`}>
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
                <div className="text-sm">
                  <p className="font-bold text-blue-700">{v.immatriculation}</p>
                  <p>{v.marque} {v.modele}</p>
                  <p className="text-gray-600 mt-1">
                    Chauffeur : {v.chauffeur_prenom} {v.chauffeur_nom}
                  </p>
                  <p className="text-gray-600">→ {v.lieu_destination}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
