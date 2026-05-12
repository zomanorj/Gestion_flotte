// Événements réalistes pouvant survenir durant une mission de transport à Madagascar
// Chaque événement a une probabilité de déclenchement par checkpoint du trajet

const EVENEMENTS = [
  {
    id: 'crevaison',
    label: 'Crevaison détectée',
    description: 'Le camion a une crevaison. Arrêt pour réparation sur le côté de la route.',
    dureeMin: 25,
    probabilite: 0.12, // 12% de chance par checkpoint
    type: 'panne',
    couleur: 'red'
  },
  {
    id: 'carburant',
    label: 'Arrêt carburant',
    description: 'Le réservoir est bas. Arrêt à la station pour faire le plein.',
    dureeMin: 15,
    probabilite: 0.20,
    type: 'arret',
    couleur: 'yellow'
  },
  {
    id: 'gendarmerie',
    label: 'Contrôle gendarmerie',
    description: 'Contrôle de routine par la gendarmerie malgache. Vérification des documents du camion.',
    dureeMin: 10,
    probabilite: 0.15,
    type: 'controle',
    couleur: 'blue'
  },
  {
    id: 'pause_repas',
    label: 'Pause repas chauffeur',
    description: 'Le chauffeur s\'arrête dans un hotely (restaurant local) pour manger.',
    dureeMin: 30,
    probabilite: 0.10,
    type: 'pause',
    couleur: 'green'
  },
  {
    id: 'route_degradee',
    label: 'Route dégradée',
    description: 'Tronçon de route en mauvais état. Le camion ralentit pour protéger la marchandise.',
    dureeMin: 20,
    probabilite: 0.18,
    type: 'ralentissement',
    couleur: 'orange'
  },
  {
    id: 'panne_moteur',
    label: 'Panne moteur',
    description: 'Défaillance mécanique. Le camion est immobilisé en attente du mécanicien.',
    dureeMin: 60,
    probabilite: 0.05,
    type: 'panne',
    couleur: 'red'
  },
  {
    id: 'verification_chargement',
    label: 'Vérification du chargement',
    description: 'Arrêt préventif pour vérifier l\'arrimage et l\'état de la marchandise.',
    dureeMin: 10,
    probabilite: 0.10,
    type: 'controle',
    couleur: 'purple'
  }
];

/**
 * Génère les événements aléatoires pour un trajet donné.
 * Les événements sont distribués uniformément sur les points GPS du trajet.
 * @param {Array} points - Tableau de points { lat, lng }
 * @returns {Array} Événements triés par position sur le trajet
 */
function genererEvenements(points) {
  const evenements  = [];
  const nbCheckpoints = Math.floor(points.length / 10);

  for (let i = 1; i < nbCheckpoints; i++) {
    const indexPoint = Math.floor(i * points.length / nbCheckpoints);

    EVENEMENTS.forEach(evt => {
      if (Math.random() < evt.probabilite) {
        evenements.push({
          ...evt,
          indexPoint,
          position:   points[indexPoint],
          declenche:  false,
          timestamp:  null
        });
      }
    });
  }

  // Trie par ordre d'apparition sur le trajet
  return evenements.sort((a, b) => a.indexPoint - b.indexPoint);
}

module.exports = { genererEvenements, EVENEMENTS };
