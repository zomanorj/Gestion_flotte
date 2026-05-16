/**
 * corbeilleService.ts
 * Service de communication avec l'API pour la corbeille — TransiFlow.
 */

import api from './api'

/** Récupère les éléments supprimés pour un type donné */
export async function getCorbeille(type: string) {
  const response = await api.get(`/api/corbeille/${type}`)
  return response.data
}

/** Récupère les compteurs de la corbeille par type */
export async function getCount(): Promise<{
  vehicles: number
  drivers:  number
  missions: number
  clients:  number
  total:    number
}> {
  const response = await api.get('/api/corbeille/count')
  return response.data.donnees
}

/** Restaure un élément de la corbeille */
export async function restore(type: string, id: number) {
  const response = await api.patch(`/api/corbeille/${type}/${id}/restore`)
  return response.data
}

/** Supprime définitivement un élément de la corbeille */
export async function purge(type: string, id: number) {
  const response = await api.delete(`/api/corbeille/${type}/${id}`)
  return response.data
}
