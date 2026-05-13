// Service de calcul de route via OSRM (OpenStreetMap Routing Machine)
// Pas de clé API requise — serveur public OSRM basé sur OpenStreetMap
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

// Serveur OSRM public — aucune clé requise, profil voiture (routes de Madagascar)
const OSRM_URL = 'http://router.project-osrm.org/route/v1/driving';

// Nombre cible de points après décimation — compromis précision/performance Socket.io
const POINTS_CIBLE = 300;

/**
 * Décime un tableau de points en gardant exactement `n` points
 * répartis uniformément, tout en conservant toujours le premier et le dernier.
 */
function decimerPoints(points, n) {
  if (points.length <= n) return points;
  const result = [];
  const pas    = (points.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) {
    result.push(points[Math.round(i * pas)]);
  }
  return result;
}

/**
 * Récupère le tracé réel des routes entre deux villes via OSRM.
 * Décime le résultat à ~300 points pour la simulation Socket.io.
 * Bascule sur un fallback ligne droite uniquement si OSRM est inaccessible.
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

  console.log(`[OSRM] Calcul route : ${villeDepart} → ${villeArrivee}`);

  try {
    // OSRM attend les coordonnées sous la forme lng,lat;lng,lat
    const url = `${OSRM_URL}/${depart.lng},${depart.lat};${arrivee.lng},${arrivee.lat}`;

    const response = await axios.get(url, {
      params:  { overview: 'full', geometries: 'geojson' },
      timeout: 10000
    });

    if (response.data.code !== 'Ok' || !response.data.routes?.length) {
      throw new Error('Réponse OSRM invalide : ' + response.data.code);
    }

    const route    = response.data.routes[0];
    const coords   = route.geometry.coordinates; // [lng, lat]
    const leg      = route.legs[0];

    // Conversion [lng, lat] → { lat, lng } pour Leaflet + décimation
    const tousPoints = coords.map(c => ({ lat: c[1], lng: c[0] }));
    const points     = decimerPoints(tousPoints, POINTS_CIBLE);

    console.log(`[OSRM] Succès : ${tousPoints.length} pts bruts → ${points.length} pts, ${(leg.distance / 1000).toFixed(1)} km`);

    return {
      points,
      distanceKm:  leg.distance / 1000,
      dureeMin:    leg.duration / 60,
      villeDepart,
      villeArrivee
    };

  } catch (error) {
    console.error('[OSRM] Erreur :', error.response?.data || error.message);
    console.warn('[OSRM] Bascule sur fallback ligne droite');
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
