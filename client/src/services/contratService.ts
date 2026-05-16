/**
 * contratService.ts
 * Service de communication avec l'API pour les contrats clients — TransiFlow.
 */

import api from './api'
import type { Contrat } from '../types/contrat'

/** Récupère la liste des contrats avec filtres optionnels */
export async function getContrats(params?: {
  client_id?: number
  statut?:    string
  page?:      number
  limit?:     number
}) {
  const response = await api.get('/api/contrats', { params })
  return response.data
}

/** Récupère le détail d'un contrat par son ID */
export async function getContrat(id: number) {
  const response = await api.get(`/api/contrats/${id}`)
  return response.data
}

/** Crée un nouveau contrat */
export async function createContrat(data: Partial<Contrat>) {
  const response = await api.post('/api/contrats', data)
  return response.data
}

/** Met à jour un contrat existant */
export async function updateContrat(id: number, data: Partial<Contrat>) {
  const response = await api.put(`/api/contrats/${id}`, data)
  return response.data
}

/** Renouvelle un contrat */
export async function renouvelerContrat(id: number) {
  const response = await api.post(`/api/contrats/${id}/renouveler`)
  return response.data
}

/** Récupère les contrats expirant dans les 30 prochains jours */
export async function getContratsExpirants() {
  const response = await api.get('/api/contrats/expirants')
  return response.data
}
