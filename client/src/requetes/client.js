// Client TanStack Query : cache des données de l'API pour toute l'application
import { QueryClient } from '@tanstack/react-query';

const statut = (erreur) => erreur?.response?.status;

export const clientRequetes = new QueryClient({
  defaultOptions: {
    queries: {
      // Données considérées comme à jour pendant 30 s : revenir sur une page dans ce délai
      // ne relance pas de requête. Au-delà, l'affichage est immédiat (cache) et la donnée est
      // rafraîchie en arrière-plan.
      staleTime: 30_000,
      // Une erreur 4xx (droits, ressource absente, session expirée) ne se corrige pas en
      // réessayant ; les erreurs réseau ou serveur sont retentées deux fois.
      retry: (tentatives, erreur) => {
        const code = statut(erreur);
        if (code && code >= 400 && code < 500) return false;
        return tentatives < 2;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});

/** Message d'erreur de l'API (format { message }) ou message par défaut. */
export const messageErreur = (erreur, defaut = 'Une erreur est survenue') =>
  erreur?.response?.data?.message || defaut;
