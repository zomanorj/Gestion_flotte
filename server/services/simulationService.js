// Moteur de simulation de mission en temps réel via Socket.io
// Supporte la vitesse variable (multiplicateur) et le broadcast global de flotte
const { getRoute }          = require('./routeService');
const { genererEvenements } = require('./evenementService');

// Simulations actives en mémoire
// { missionId: { route, evenements, indexActuel, enPause, multiplicateur, timer, mission, evenementActuel } }
const simulationsActives = {};

// Référence globale à Socket.io pour le broadcast de flotte
let _io         = null;
let globalTimer = null;

/**
 * Calcule le délai en ms entre deux points GPS.
 * Basé sur la vitesse réelle d'un camion (~60 km/h) * multiplicateur.
 * @param {Object} route          - { distanceKm, points }
 * @param {number} multiplicateur - Facteur d'accélération (1, 5, 10, 30, 60)
 */
function calculerDelai(route, multiplicateur) {
  const distanceParPoint = route.distanceKm / route.points.length; // km par point
  const msReel           = distanceParPoint / 60 * 3600 * 1000;   // ms à 60 km/h
  return Math.max(50, Math.round(msReel / multiplicateur));
}

/**
 * Durée de pause pour un événement, proportionnelle au multiplicateur.
 * Toujours visible (≥ 1s) mais jamais bloquante (≤ 10s).
 */
function calculerPauseEvenement(dureeMin, multiplicateur) {
  return Math.max(1000, Math.min(10000, Math.round(dureeMin * 1000 / multiplicateur)));
}

/**
 * Émet toutes les secondes les positions de tous les camions actifs.
 * Événement Socket.io : 'flotte:positions'
 */
function emettrePositionsGlobales() {
  if (!_io || Object.keys(simulationsActives).length === 0) return;

  const positions = Object.entries(simulationsActives)
    .map(([missionId, sim]) => {
      const pos = sim.route.points[sim.indexActuel];
      if (!pos) return null;
      return {
        missionId,
        position:         pos,
        progression:      Math.round(sim.indexActuel / sim.route.points.length * 100),
        vitesse:          sim.enPause ? 0 : Math.round(60 * sim.multiplicateur * 10) / 10,
        multiplicateur:   sim.multiplicateur,
        enPause:          sim.enPause,
        evenementActuel:  sim.evenementActuel || null,
        immatriculation:  sim.mission?.immatriculation,
        chauffeur_nom:    sim.mission?.chauffeur_nom,
        titre:            sim.mission?.titre,
        lieu_depart:      sim.mission?.lieu_depart,
        lieu_destination: sim.mission?.lieu_destination,
        distanceKm:       sim.route.distanceKm
      };
    })
    .filter(Boolean);

  if (positions.length > 0) {
    _io.emit('flotte:positions', positions);
  }
}

/**
 * Démarre la simulation d'une mission.
 * Multiplicateur par défaut : x30 (bon compromis vitesse/lisibilité).
 */
async function demarrerSimulation(missionId, mission, io) {
  if (simulationsActives[missionId]) {
    console.log(`[Sim] Mission ${missionId} déjà active`);
    return;
  }

  // Stocke io pour le broadcast global
  _io = io;

  try {
    const route     = await getRoute(mission.lieu_depart, mission.lieu_destination);
    const evenements = genererEvenements(route.points);

    simulationsActives[missionId] = {
      route,
      evenements,
      indexActuel:     0,
      enPause:         false,
      multiplicateur:  30,   // x30 par défaut
      timer:           null,
      mission: {
        titre:            mission.titre,
        immatriculation:  mission.immatriculation,
        chauffeur_nom:    mission.chauffeur_nom,
        lieu_depart:      mission.lieu_depart,
        lieu_destination: mission.lieu_destination
      },
      evenementActuel: null
    };

    // Données initiales pour le composant SimulationMission
    io.emit(`mission:${missionId}:debut`, {
      missionId,
      route:         route.points,
      evenements:    evenements.map(e => ({
        id:          e.id,
        label:       e.label,
        indexPoint:  e.indexPoint,
        couleur:     e.couleur,
        type:        e.type,
        dureeMin:    e.dureeMin
      })),
      distanceKm:    route.distanceKm,
      totalPoints:   route.points.length,
      multiplicateur: 30
    });

    avancerSimulation(missionId, io);

    // Lance le broadcast global si pas encore actif
    if (!globalTimer) {
      globalTimer = setInterval(emettrePositionsGlobales, 1000);
    }

  } catch (error) {
    console.error(`[Sim] Erreur mission ${missionId} :`, error.message);
    io.emit(`mission:${missionId}:erreur`, { message: error.message });
  }
}

/**
 * Boucle principale : avance le camion d'un point GPS à chaque intervalle.
 * Le délai est calculé à partir de la distance et du multiplicateur actuel.
 */
function avancerSimulation(missionId, io) {
  const sim   = simulationsActives[missionId];
  if (!sim) return;

  const delai = calculerDelai(sim.route, sim.multiplicateur);

  const timer = setInterval(() => {
    const sim = simulationsActives[missionId];
    if (!sim || sim.enPause) return;

    const { route, evenements, indexActuel } = sim;

    // Arrivée à destination
    if (indexActuel >= route.points.length - 1) {
      clearInterval(timer);
      delete simulationsActives[missionId];

      // Arrête le broadcast global si plus aucune simulation
      if (Object.keys(simulationsActives).length === 0 && globalTimer) {
        clearInterval(globalTimer);
        globalTimer = null;
      }

      io.emit(`mission:${missionId}:termine`, {
        missionId,
        message:           `Arrivée à ${route.villeArrivee} !`,
        distanceParcourue: route.distanceKm
      });
      return;
    }

    // Émission de la position
    const position   = route.points[indexActuel];
    const progression = Math.round((indexActuel / route.points.length) * 100);

    io.emit(`mission:${missionId}:position`, {
      missionId, position, indexActuel, progression,
      totalPoints: route.points.length
    });

    // Détection d'événement
    const evenement = evenements.find(e => e.indexPoint === indexActuel && !e.declenche);
    if (evenement) {
      evenement.declenche       = true;
      sim.enPause               = true;
      sim.evenementActuel       = {
        id: evenement.id, label: evenement.label,
        type: evenement.type, couleur: evenement.couleur
      };

      io.emit(`mission:${missionId}:evenement`, {
        missionId,
        evenement: {
          id:          evenement.id,
          label:       evenement.label,
          description: evenement.description,
          dureeMin:    evenement.dureeMin,
          type:        evenement.type,
          couleur:     evenement.couleur,
          position
        }
      });

      const pauseMs = calculerPauseEvenement(evenement.dureeMin, sim.multiplicateur);
      setTimeout(() => {
        if (simulationsActives[missionId]) {
          simulationsActives[missionId].enPause         = false;
          simulationsActives[missionId].evenementActuel = null;
          io.emit(`mission:${missionId}:reprise`, { missionId });
        }
      }, pauseMs);
    }

    simulationsActives[missionId].indexActuel++;

  }, delai);

  if (simulationsActives[missionId]) {
    simulationsActives[missionId].timer = timer;
  }
}

/**
 * Change la vitesse d'une simulation en cours.
 * Arrête l'intervalle actuel et en recrée un nouveau avec le bon délai.
 * @param {string|number} missionId
 * @param {number} multiplicateur - 1 | 5 | 10 | 30 | 60
 * @param {Object} io
 * @returns {boolean} true si la simulation existe
 */
function changerVitesse(missionId, multiplicateur, io) {
  const sim = simulationsActives[missionId];
  if (!sim) return false;

  const mult = [1, 5, 10, 30, 60].includes(Number(multiplicateur))
    ? Number(multiplicateur) : 30;

  // Stoppe l'intervalle actuel
  if (sim.timer) clearInterval(sim.timer);

  // Met à jour le multiplicateur
  sim.multiplicateur = mult;

  // Notifie tous les clients du changement
  io.emit(`mission:${missionId}:vitesse`, { missionId, multiplicateur: mult });

  // Relance avec le nouveau délai
  avancerSimulation(missionId, io);
  return true;
}

/**
 * Arrête une simulation et nettoie la mémoire.
 */
function arreterSimulation(missionId) {
  const sim = simulationsActives[missionId];
  if (sim) {
    if (sim.timer) clearInterval(sim.timer);
    delete simulationsActives[missionId];

    if (Object.keys(simulationsActives).length === 0 && globalTimer) {
      clearInterval(globalTimer);
      globalTimer = null;
    }
    console.log(`[Sim] Mission ${missionId} arrêtée`);
  }
}

module.exports = {
  demarrerSimulation,
  arreterSimulation,
  changerVitesse,
  simulationsActives
};
