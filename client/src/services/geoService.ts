/**
 * geoService.ts
 * Service de géolocalisation
 * Utilise Nominatim pour les villes
 * et OSRM pour les itinéraires.
 * Aucune donnée hardcodée.
 */

// --- TYPES ---

export interface Ville {
  nom: string           // ex: "Antananarivo"
  affichage: string     // ex: "Antananarivo, Analamanga, Madagascar"
  lat: number
  lng: number
}

export interface Itineraire {
  distance_km: number       // ex: 352.4
  duree_minutes: number     // ex: 330
  points: [number, number][] // [[lat,lng], [lat,lng], ...]
}

// --- AUTOCOMPLÉTION ---

/**
 * Cherche des villes à Madagascar via Nominatim
 * Ne retourne QUE des résultats à Madagascar (countrycodes: mg)
 */
export async function searchVilles(query: string): Promise<Ville[]> {
  if (query.length < 2) return []

  try {
    const params = new URLSearchParams({
      q: query,
      countrycodes: 'mg',
      format: 'json',
      limit: '6',
      addressdetails: '1',
      'accept-language': 'fr',
      // settlement = villes, communes et villages (retourne les résultats pertinents dès 2 lettres)
      featuretype: 'settlement',
    })

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          // Header obligatoire pour Nominatim
          'User-Agent': 'TransiFlow/1.0 (projet-stage@transiflow.app)',
        }
      }
    )

    if (!response.ok) {
      throw new Error('Service indisponible')
    }

    const data = await response.json()

    // Transformer la réponse Nominatim en objets Ville
    return data.map((item: any) => ({
      nom: item.address?.city
        || item.address?.town
        || item.address?.village
        || item.name,
      affichage: item.display_name
        .split(',')
        .slice(0, 3)
        .join(','),         // garder seulement les 3 premières parties
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }))
  } catch (error) {
    console.error("Erreur recherche Nominatim:", error)
    return []
  }
}

// --- CALCUL ITINÉRAIRE ---

/**
 * Calcule le vrai trajet routier entre deux points GPS via OSRM
 * OSRM utilise les données OpenStreetMap — mêmes routes que la carte
 */
export async function calculerItineraire(
  depart: { lat: number; lng: number },
  arrivee: { lat: number; lng: number }
): Promise<Itineraire> {
  try {
    // IMPORTANT : OSRM attend lng,lat (pas lat,lng)
    const url = `https://router.project-osrm.org/route/v1/driving/`
      + `${depart.lng},${depart.lat};${arrivee.lng},${arrivee.lat}`
      + `?overview=full&geometries=geojson&steps=false`

    const response = await fetch(url)
    const data = await response.json()

    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
      throw new Error('Impossible de calculer l itinéraire')
    }

    const route = data.routes[0]

    // OSRM retourne lng,lat dans geometry.coordinates
    // On inverse en lat,lng pour Leaflet
    const points: [number, number][] =
      route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      )

    return {
      distance_km: Math.round(route.distance / 100) / 10,  // mètres → km
      duree_minutes: Math.round(route.duration / 60),       // secondes → min
      points,
    }
  } catch (error) {
    console.error("Erreur calcul itinéraire OSRM:", error)
    // Ligne droite en fallback
    const distFallback = Math.round(Math.sqrt(Math.pow(arrivee.lat - depart.lat, 2) + Math.pow(arrivee.lng - depart.lng, 2)) * 111) // approx deg to km
    return {
      distance_km: distFallback,
      duree_minutes: Math.round((distFallback / 60) * 60),
      points: [[depart.lat, depart.lng], [arrivee.lat, arrivee.lng]]
    }
  }
}

// --- CALCUL CARBURANT ---

/**
 * Estime la consommation selon le type de véhicule
 */
export function calculerCarburant(
  distance_km: number,
  type_vehicule: string
): number {
  const consommations: Record<string, number> = {
    citerne : 35,   // litres/100km
    camion  : 30,
    pickup  : 12,
    autre   : 20,
  }
  const conso = consommations[type_vehicule.toLowerCase()] ?? 25
  return Math.round((distance_km * conso / 100) * 10) / 10
}
