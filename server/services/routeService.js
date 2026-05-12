// Service de calcul de route via OpenRouteService
// Récupère le tracé GPS réel des routes de Madagascar
const axios = require('axios');

// Coordonnées GPS des principales villes de Madagascar
const VILLES_MADAGASCAR = {
  'Antananarivo': { lat: -18.9136, lng: 47.5362 },
  'Toamasina':    { lat: -18.1492, lng: 49.4023 },
  'Antsirabe':    { lat: -19.8659, lng: 47.0333 },
  'Fianarantsoa': { lat: -21.4538, lng: 47.0855 },
  'Mahajanga':    { lat: -15.7167, lng: 46.3167 },
  'Toliara':      { lat: -23.3568, lng: 43.6917 },
  'Antsiranana':  { lat: -12.2795, lng: 49.2913 },
  'Moramanga':    { lat: -18.9333, lng: 48.2167 },
  'Ambositra':    { lat: -20.5333, lng: 47.2500 },
  'Manakara':     { lat: -22.1333, lng: 48.0167 }
};

// Endpoint ORS — driving-car (gratuit) au lieu de driving-hgv (payant)
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';

/**
 * Récupère le tracé réel de la route entre deux villes
 * via l'API OpenRouteService (profil driving-car, gratuit).
 * Bascule sur un fallback ligne droite si l'API est indisponible.
 * @param {string} villeDepart  - Nom de la ville de départ
 * @param {string} villeArrivee - Nom de la ville d'arrivée
 * @returns {{ points, distanceKm, dureeMin, villeDepart, villeArrivee }}
 */
async function getRoute(villeDepart, villeArrivee) {
  const depart  = VILLES_MADAGASCAR[villeDepart];
  const arrivee = VILLES_MADAGASCAR[villeArrivee];

  if (!depart || !arrivee) {
    throw new Error(`Ville inconnue : "${villeDepart}" ou "${villeArrivee}"`);
  }

  console.log(`[ORS] Appel route : ${villeDepart} → ${villeArrivee}`);
  console.log(`[ORS] URL : ${ORS_URL}`);
  console.log(`[ORS] start=${depart.lng},${depart.lat} | end=${arrivee.lng},${arrivee.lat}`);

  try {
    const response = await axios.get(ORS_URL, {
      // Authentification via header Authorization (méthode correcte ORS v2)
      headers: {
        'Authorization': process.env.ORS_API_KEY
      },
      params: {
        start: `${depart.lng},${depart.lat}`,
        end:   `${arrivee.lng},${arrivee.lat}`
      },
      timeout: 10000
    });

    const feature = response.data.features[0];
    const coords  = feature.geometry.coordinates;
    const summary = feature.properties.summary;

    // ORS renvoie [lng, lat] — conversion en { lat, lng } pour Leaflet
    const points = coords.map(c => ({ lat: c[1], lng: c[0] }));

    console.log(`[ORS] Succès : ${points.length} points, ${(summary.distance / 1000).toFixed(1)} km`);

    return {
      points,
      distanceKm: summary.distance / 1000,
      dureeMin:   summary.duration / 60,
      villeDepart,
      villeArrivee
    };

  } catch (error) {
    // Log détaillé pour identifier la vraie cause de l'échec
    console.error('[ORS] Erreur :', error.response?.data || error.message);
    console.error('[ORS] Status :', error.response?.status);
    console.warn('[ORS] Bascule sur fallback ligne droite');
    return getFallbackRoute(depart, arrivee, villeDepart, villeArrivee);
  }
}

/**
 * Génère un tracé de remplacement (ligne droite avec 50 points).
 * Utilisé quand l'API ORS n'est pas accessible.
 */
function getFallbackRoute(depart, arrivee, nomDepart, nomArrivee) {
  const points   = [];
  const nbPoints = 50;

  for (let i = 0; i <= nbPoints; i++) {
    const t = i / nbPoints;
    points.push({
      lat: depart.lat + (arrivee.lat - depart.lat) * t,
      lng: depart.lng + (arrivee.lng - depart.lng) * t
    });
  }

  return {
    points,
    distanceKm:  calculerDistance(depart, arrivee),
    dureeMin:    calculerDistance(depart, arrivee) / 60 * 60,
    villeDepart: nomDepart,
    villeArrivee: nomArrivee
  };
}

/**
 * Calcule la distance orthodromique (formule Haversine) en kilomètres.
 */
function calculerDistance(p1, p2) {
  const R    = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(p1.lat * Math.PI / 180)
    * Math.cos(p2.lat * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { getRoute, VILLES_MADAGASCAR };
