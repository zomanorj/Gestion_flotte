import { useEffect, useRef } from 'react';
import { obtenirSocket } from '../services/socket';

/**
 * Abonnement à un événement temps réel sur la connexion partagée, retiré au démontage.
 * Le gestionnaire peut changer à chaque rendu sans réabonnement (la dernière version est
 * toujours appelée). `nom` null : pas d'abonnement.
 */
export function useEvenement(nom, gestionnaire) {
  const dernier = useRef(gestionnaire);
  dernier.current = gestionnaire;

  useEffect(() => {
    if (!nom) return undefined;
    const socket = obtenirSocket();
    const appeler = (...args) => dernier.current(...args);
    socket.on(nom, appeler);
    return () => socket.off(nom, appeler);
  }, [nom]);
}
