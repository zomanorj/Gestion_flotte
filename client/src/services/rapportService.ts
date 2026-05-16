/**
 * rapportService.ts
 * Service de communication avec l'API pour les rapports avancés — TransiFlow.
 */

import api from './api'

/** Récupère le rapport de rentabilité des missions sur une période */
export async function getRentabilite(params: { date_debut: string; date_fin: string }) {
  const response = await api.get('/api/rapports/rentabilite', { params })
  return response.data
}

/** Récupère le rapport de performance des chauffeurs sur une période */
export async function getPerformanceChauffeurs(params: { date_debut: string; date_fin: string }) {
  const response = await api.get('/api/rapports/chauffeurs', { params })
  return response.data
}

/** Récupère le rapport d'utilisation de la flotte sur une période */
export async function getUtilisationFlotte(params: { date_debut: string; date_fin: string }) {
  const response = await api.get('/api/rapports/flotte', { params })
  return response.data
}
