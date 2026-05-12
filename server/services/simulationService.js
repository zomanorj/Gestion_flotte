// Moteur de simulation de mission en temps réel via Socket.io
// Déplace le camion point par point sur le tracé GPS réel
const { getRoute }         = require('./routeService');
const { genererEvenements } = require('./evenementService');

// Stocke les simulations actives en mémoire (serveur)
// Clé : missionId, Valeur : { route, evenements, indexActuel, enPause, timer }
const simulationsActives = {};

// Vitesse de simulation : un point GPS toutes les VITESSE_MS millisecondes
// 500 ms = simulation rapide style jeu vidéo
const VITESSE_MS = 500;

/**
 * Démarre la simulation d'une mission.
 * Récupère le tracé ORS, génère les événements, lance la boucle.
 * @param {string|number} missionId - Identifiant de la mission en base
 * @param {Object} mission - Données de la mission (lieu_depart, lieu_destination, etc.)
 * @param {Object} io      - Instance Socket.io pour émettre les événements
 */
async function demarrerSimulation(missionId, mission, io) {
  if (simulationsActives[missionId]) {
    console.log(`Simulation ${missionId} déjà active`);
    return;
  }

  try {
    // Récupère le vrai tracé GPS de la route
    const route = await getRoute(mission.lieu_depart, mission.lieu_destination);

    // Génère aléatoirement les événements sur le trajet
    const evenements = genererEvenements(route.points);

    // Initialise la simulation
    simulationsActives[missionId] = {
      route,
      evenements,
      indexActuel: 0,
      enPause:     false
    };

    // Envoie les données initiales au(x) client(s) connecté(s)
    io.emit(`mission:${missionId}:debut`, {
      missionId,
      route:        route.points,
      evenements:   evenements.map(e => ({
        id:         e.id,
        label:      e.label,
        indexPoint: e.indexPoint,
        couleur:    e.couleur
      })),
      distanceKm:  route.distanceKm,
      totalPoints: route.points.length
    });

    // Lance la boucle de déplacement
    avancerSimulation(missionId, io);

  } catch (error) {
    console.error(`Erreur simulation mission ${missionId} :`, error.message);
    io.emit(`mission:${missionId}:erreur`, { message: error.message });
  }
}

/**
 * Boucle principale : avance le camion d'un point GPS à chaque intervalle.
 * Gère les pauses d'événements et l'arrivée à destination.
 */
function avancerSimulation(missionId, io) {
  const timer = setInterval(() => {
    const sim = simulationsActives[missionId];
    if (!sim || sim.enPause) return;

    const { route, evenements, indexActuel } = sim;

    // Arrivée à destination — fin de la simulation
    if (indexActuel >= route.points.length - 1) {
      clearInterval(timer);
      delete simulationsActives[missionId];

      io.emit(`mission:${missionId}:termine`, {
        missionId,
        message:          `Arrivée à ${route.villeArrivee} !`,
        distanceParcourue: route.distanceKm
      });
      return;
    }

    // Envoie la position actuelle du camion
    const position   = route.points[indexActuel];
    const progression = Math.round((indexActuel / route.points.length) * 100);

    io.emit(`mission:${missionId}:position`, {
      missionId,
      position,
      indexActuel,
      progression,
      totalPoints: route.points.length
    });

    // Vérifie si un événement se déclenche à ce point précis
    const evenement = evenements.find(
      e => e.indexPoint === indexActuel && !e.declenche
    );

    if (evenement) {
      evenement.declenche = true;
      sim.enPause         = true;

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

      // Reprend automatiquement après la durée simulée
      // Accélération : 1 minute réelle = 100 ms en simulation
      const delaiMs = evenement.dureeMin * 100;
      setTimeout(() => {
        if (simulationsActives[missionId]) {
          simulationsActives[missionId].enPause = false;
          io.emit(`mission:${missionId}:reprise`, {
            missionId,
            message: 'Le camion reprend la route'
          });
        }
      }, delaiMs);
    }

    // Passe au point suivant
    simulationsActives[missionId].indexActuel++;

  }, VITESSE_MS);

  // Sauvegarde la référence du timer pour pouvoir l'annuler
  if (simulationsActives[missionId]) {
    simulationsActives[missionId].timer = timer;
  }
}

/**
 * Arrête une simulation en cours et nettoie la mémoire.
 * @param {string|number} missionId
 */
function arreterSimulation(missionId) {
  const sim = simulationsActives[missionId];
  if (sim) {
    if (sim.timer) clearInterval(sim.timer);
    delete simulationsActives[missionId];
    console.log(`Simulation ${missionId} arrêtée`);
  }
}

module.exports = { demarrerSimulation, arreterSimulation, simulationsActives };
