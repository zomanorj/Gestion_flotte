/**
 * Service client — salaires (TransiFlow).
 * Centralise les appels HTTP vers `/api/salaires` (préfixe `/api` géré par axios `baseURL`).
 */

import api from './api'
import type { Salaire, SalaireStats, PaiementSalaire } from '../types/salaire'

/* Récupère la liste des salaires avec filtres */
export async function getSalaires(params?: {
  driver_id?: number
  mois?: number
  annee?: number
  statut?: string
  page?: number
  limit?: number
}) {
  const query: Record<string, string | number | undefined> = {
    driver_id: params?.driver_id,
    statut: params?.statut && params.statut !== 'tous' ? params.statut : undefined,
    page: params?.page,
    limit: params?.limit,
  }
  if (params?.mois && params?.annee) {
    query.mois_concerne = `${params.annee}-${String(params.mois).padStart(2, '0')}`
  }
  const response = await api.get('/api/salaires', { params: query })
  return response.data
}

/* Récupère les stats des salaires d'un mois */
export async function getSalaireStats(
  mois: number,
  annee: number
): Promise<SalaireStats> {
  const response = await api.get('/api/salaires/stats', {
    params: { mois, annee },
  })
  return response.data.donnees
}

/* Récupère les salaires d'un chauffeur */
export async function getSalairesDriver(
  driverId: number,
  params?: { mois?: number; annee?: number }
) {
  const response = await api.get(`/api/salaires/driver/${driverId}`, { params })
  return response.data
}

/* Crée un salaire manuellement */
export async function createSalaire(data: Partial<Salaire>) {
  const response = await api.post('/api/salaires', data)
  return response.data
}

/* Enregistre un paiement de salaire */
export async function payerSalaire(
  salaireId: number,
  paiement: PaiementSalaire
) {
  const response = await api.patch(`/api/salaires/${salaireId}/payer`, paiement)
  return response.data
}

/* Met à jour un salaire */
export async function updateSalaire(id: number, data: Partial<Salaire>) {
  const response = await api.put(`/api/salaires/${id}`, data)
  return response.data
}

/* Supprime un salaire */
export async function deleteSalaire(id: number) {
  const response = await api.delete(`/api/salaires/${id}`)
  return response.data
}
