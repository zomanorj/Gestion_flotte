// Connexion Socket.io unique pour toute la session
//
// Une seule connexion est ouverte après la connexion de l'utilisateur et partagée par tous les
// composants (aujourd'hui la barre du haut), qui s'abonnent avec useEvenement().
// Changer de page n'ouvre ni ne ferme de connexion.
import { io } from 'socket.io-client';

// Même origine par défaut (proxy Vite en dev, nginx en Docker),
// ou VITE_SOCKET_URL quand l'API est sur un autre domaine (Vercel + Railway)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

let socket = null;

/** Connexion partagée, ouverte au premier appel. */
export function obtenirSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      // Relu à chaque (re)connexion : un token renouvelé est pris en compte
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
    });
  }
  return socket;
}

/**
 * Reconnexion avec le token courant. L'API ferme les connexions d'un compte dont les tokens
 * sont révoqués (changement de mot de passe, de rôle) et Socket.io ne se reconnecte pas seul
 * après une fermeture décidée par le serveur : appelé quand un nouveau token est reçu.
 */
export function reconnecterSocket() {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
}

/** Fermeture à la déconnexion de l'utilisateur. */
export function fermerSocket() {
  socket?.disconnect();
  socket = null;
}
