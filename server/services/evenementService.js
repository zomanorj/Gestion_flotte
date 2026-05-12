// Événements réalistes pouvant survenir durant une mission de transport à Madagascar
// Probabilités réduites + max 3 événements espacés sur le trajet

const EVENEMENTS = [
  {
    id: 'crevaison',
    label: 'Crevaison détectée',
    description: 'Le camion a une crevaison. Arrêt pour réparation sur le côté de la route.',
    dureeMin: 25,
    probabilite: 0.03,
    type: 'panne',
    couleur: 'red'
  },
  {
    id: 'carburant',
    label: 'Arrêt carburant',
    description: 'Le réservoir est bas. Arrêt à la station pour faire le plein.',
    dureeMin: 15,
    probabilite: 0.05,
    type: 'arret',
    couleur: 'yellow'
  },
  {
    id: 'gendarmerie',
    label: 'Contrôle gendarmerie',
    description: 'Contrôle de routine par la gendarmerie malgache. Vérification des documents du camion.',
    dureeMin: 10,
    probabilite: 0.04,
    type: 'controle',
    couleur: 'blue'
  },
  {
    id: 'pause_repas',
    label: 'Pause repas chauffeur',
    description: 'Le chauffeur s\'arrête dans un hotely (restaurant local) pour manger.',
    dureeMin: 30,
    probabilite: 0.03,
    type: 'pause',
    couleur: 'green'
  },
  {
    id: 'route_degradee',
    label: 'Route dégradée',
    description: 'Tronçon de route en mauvais état. Le camion ralentit pour protéger la marchandise.',
    dureeMin: 20,
    probabilite: 0.04,
    type: 'ralentissement',
    couleur: 'orange'
  },
  {
    id: 'panne_moteur',
    label: 'Panne moteur',
    description: 'Défaillance mécanique. Le camion est immobilisé en attente du mécanicien.',
    dureeMin: 60,
    probabilite: 0.01,
    type: 'panne',
    couleur: 'red'
  },
  {
    id: 'verification_chargement',
    label: 'Vérification du chargement',
    description: 'Arrêt préventif pour vérifier l\'arrimage et l\'état de la marchandise.',
    dureeMin: 10,
    probabilite: 0.02,
    type: 'controle',
    couleur: 'purple'
  }
];

/**
 * Génère les événements aléatoires pour un trajet donné.
 * - Maximum 3 événements par trajet
 * - Espacement minimum de 20% du trajet entre deux événements
 * - Probabilités faibles pour que la simulation reste fluide
 * @param {Array} points - Tableau de points { lat, lng }
 * @returns {Array} Au plus 3 événements triés et espacés
 */
function genererEvenements(points) {
  const candidats     = [];
  const nbCheckpoints = Math.floor(points.length / 10);
  const espaceMin     = Math.floor(points.length * 0.20);

  for (let i = 1; i < nbCheckpoints; i++) {
    const indexPoint = Math.floor(i * points.length / nbCheckpoints);

    EVENEMENTS.forEach(evt => {
      if (Math.random() < evt.probabilite) {
        candidats.push({
          ...evt,
          indexPoint,
          position:  points[indexPoint],
          declenche: false,
          timestamp: null
        });
      }
    });
  }

  // Tri par position sur le trajet
  candidats.sort((a, b) => a.indexPoint - b.indexPoint);

  // Filtre les événements trop proches (< 20% du trajet d'écart)
  // puis limite à 3 au maximum
  const espacés = candidats.filter((evt, i, arr) => {
    if (i === 0) return true;
    return evt.indexPoint - arr[i - 1].indexPoint > espaceMin;
  });

  return espacés.slice(0, 3);
}

module.exports = { genererEvenements, EVENEMENTS };
