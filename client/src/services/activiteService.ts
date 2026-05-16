/**
 * activiteService.ts
 * Service de communication avec l'API pour le journal d'activité — TransiFlow.
 */

import api from './api'

/** Récupère le journal d'activité paginé avec filtres */
export async function getActivite(params?: {
  user_id?:    number
  action?:     string
  entite?:     string
  date_debut?: string
  date_fin?:   string
  page?:       number
  limit?:      number
}) {
  const response = await api.get('/api/activite', { params })
  return response.data
}

/** Récupère les 20 dernières entrées du journal */
export async function getActiviteRecente(limit?: number) {
  const response = await api.get('/api/activite/recente', { params: { limit } })
  return response.data
}

/** Récupère l'historique d'un élément spécifique */
export async function getActiviteEntite(type: string, id: number) {
  const response = await api.get(`/api/activite/entite/${type}/${id}`)
  return response.data
}
