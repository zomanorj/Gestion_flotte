// Accès aux données de l'API (TanStack Query)
//
// Les pages n'appellent plus `api` directement : elles utilisent les hooks ci-dessous.
// - Lectures : un hook par donnée (useVehicules, useMissions…), mis en cache sous une clé dont
//   le premier élément est le domaine ('vehicules', 'missions'…).
// - Écritures : useEcriture(domaine, requete). Après succès, toutes les données qui dépendent
//   de ce domaine sont rafraîchies, selon la table DEPENDANCES : c'est le seul endroit où l'on
//   décide qu'une mission modifiée change aussi le tableau de bord, la paie ou les badges.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const lire = (chemin, params) => api.get(chemin, { params }).then(({ data }) => data);

/** Paramètres de filtre sans les valeurs vides (même clé de cache pour {statut: ''} et {}). */
const nettoyer = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));

// Domaines rafraîchis après une écriture sur le domaine indiqué (lui-même inclus)
export const DEPENDANCES = {
  vehicules:     ['vehicules', 'missions', 'planning', 'tableau-de-bord', 'documents', 'carburant', 'depenses',
                  'maintenances'],
  chauffeurs:    ['chauffeurs', 'missions', 'planning', 'tableau-de-bord', 'paie'],
  missions:      ['missions', 'planning', 'vehicules', 'chauffeurs', 'clients', 'tableau-de-bord', 'paie'],
  documents:     ['documents', 'tableau-de-bord'],
  carburant:     ['carburant'],
  depenses:      ['depenses'],
  maintenances:  ['maintenances', 'vehicules'],
  clients:       ['clients', 'missions'],
  utilisateurs:  ['utilisateurs', 'chauffeurs'],
  paie:          ['paie', 'chauffeurs'],
  notifications: ['notifications'],
  // Les paramètres (seuils, barème, prix) influent sur presque tous les calculs
  parametres:    ['parametres', 'tableau-de-bord', 'documents', 'vehicules', 'maintenances', 'paie', 'missions'],
};

/**
 * Écriture (création, modification, suppression) suivie du rafraîchissement des données
 * dépendantes. `requete` reçoit les variables passées à mutate / mutateAsync.
 */
export function useEcriture(domaine, requete, options = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: requete,
    ...options,
    onSuccess: async (...args) => {
      await Promise.all((DEPENDANCES[domaine] || [domaine]).map((d) => client.invalidateQueries({ queryKey: [d] })));
      await options.onSuccess?.(...args);
    },
  });
}

/** Rafraîchit un ou plusieurs domaines (ex. sur un événement temps réel). */
export function useRafraichir() {
  const client = useQueryClient();
  return (...domaines) => Promise.all(domaines.map((d) => client.invalidateQueries({ queryKey: [d] })));
}

// ── Lectures ───────────────────────────────────────────────────────────────────
// `pagine` : liste paginée ({data, total, pages}) ; la page précédente reste affichée pendant le
// chargement de la suivante (pas de clignotement).
const liste = (domaine, chemin, params, { pagine = false, ...options } = {}) => {
  const filtres = nettoyer(params);
  return {
    queryKey: [domaine, 'liste', filtres],
    queryFn: () => lire(chemin, pagine ? { ...filtres, paginate: 'true' } : filtres),
    ...(pagine ? { placeholderData: keepPreviousData } : {}),
    ...options,
  };
};

// Véhicules
export const useVehicules = (params, options) => useQuery(liste('vehicules', '/vehicules', params, options));
export const useVehicule = (id) => useQuery({
  queryKey: ['vehicules', 'detail', id], queryFn: () => lire(`/vehicules/${id}`), enabled: !!id,
});
export const useAlertesVehicules = () => useQuery({ queryKey: ['vehicules', 'alertes'], queryFn: () => lire('/vehicules/alertes') });

// Chauffeurs
export const useChauffeurs = (params, options) => useQuery(liste('chauffeurs', '/chauffeurs', params, options));
export const useMissionsChauffeur = (id) => useQuery({
  queryKey: ['missions', 'chauffeur', id], queryFn: () => lire(`/chauffeurs/${id}/missions`), enabled: !!id,
});

// Missions
export const useMissions = (params, options) => useQuery(liste('missions', '/missions', params, options));
export const usePlanning = () => useQuery({ queryKey: ['planning'], queryFn: () => lire('/missions/planning') });
// Missions du chauffeur connecté (domaine 'missions' : rafraîchies en temps réel comme les autres)
export const useMesMissions = () => useQuery({ queryKey: ['missions', 'miennes'], queryFn: () => lire('/missions/miennes') });

// Tableau de bord
export const useTableauDeBord = () => useQuery({ queryKey: ['tableau-de-bord'], queryFn: () => lire('/dashboard/stats') });

// Documents
export const useDocuments = (params, options) => useQuery(liste('documents', '/documents', params, options));
export const useAlertesDocuments = () => useQuery({ queryKey: ['documents', 'alertes'], queryFn: () => lire('/documents/alertes') });

// Carburant et dépenses
export const usePleins = (params, options) => useQuery(liste('carburant', '/carburant', params, options));
export const useStatsCarburant = () => useQuery({ queryKey: ['carburant', 'stats'], queryFn: () => lire('/carburant/stats') });
export const useDepenses = (params, options) => useQuery(liste('depenses', '/depenses', params, options));
export const useStatsDepenses = () => useQuery({ queryKey: ['depenses', 'stats'], queryFn: () => lire('/depenses/stats') });

// Maintenances
export const useMaintenances = (params, options) => useQuery(liste('maintenances', '/maintenances', params, options));
export const useAlertesMaintenances = () => useQuery({
  queryKey: ['maintenances', 'alertes'], queryFn: () => lire('/maintenances/alertes'),
});

// Clients
export const useClients = (params, options) => useQuery(liste('clients', '/clients', params, options));
export const useMissionsClient = (id) => useQuery({
  queryKey: ['clients', 'missions', id], queryFn: () => lire(`/clients/${id}/missions`), enabled: !!id,
});

// Comptes, paie, paramètres
export const useUtilisateurs = () => useQuery({ queryKey: ['utilisateurs'], queryFn: () => lire('/users') });
export const usePaie = (annee, mois) => useQuery({
  queryKey: ['paie', annee, mois], queryFn: () => lire(`/paie/${annee}/${mois}`), placeholderData: keepPreviousData,
});
export const useParametres = (options) => useQuery({ queryKey: ['parametres'], queryFn: () => lire('/parametres'), ...options });
export const useHistoriqueParametres = (actif) => useQuery({
  queryKey: ['parametres', 'historique'], queryFn: () => lire('/parametres/historique'), enabled: actif,
});

// Notifications (rafraîchies aussi en temps réel par la barre du haut)
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => lire('/notifications') });
