/**
 * incidentService.ts
 * Service de communication avec l'API incidents — TransiFlow.
 */

import apiClient from './api'
import type {
  Incident, IncidentFormData, ResoudreIncidentData, StatsIncidents,
} from '../types/incident'

interface PaginatedResponse<T> {
  succes: boolean
  donnees: T[]
  pagination: {
    page: number; limit: number; total: number
    totalPages: number; hasNextPage: boolean; hasPrevPage: boolean
  }
}
interface ApiResponse<T> { succes: boolean; donnees: T; message?: string }

export interface FiltresIncidents {
  statut?:     string
  gravite?:    string
  type?:       string
  vehicle_id?: number
  driver_id?:  number
  date_debut?: string
  date_fin?:   string
  page?:       number
  limit?:      number
}

/** Récupère la liste paginée des incidents. */
export async function getIncidents(filtres: FiltresIncidents = {}): Promise<PaginatedResponse<Incident>> {
  const params = new URLSearchParams()
  if (filtres.statut)     params.set('statut',     filtres.statut)
  if (filtres.gravite)    params.set('gravite',    filtres.gravite)
  if (filtres.type)       params.set('type',       filtres.type)
  if (filtres.vehicle_id) params.set('vehicle_id', String(filtres.vehicle_id))
  if (filtres.driver_id)  params.set('driver_id',  String(filtres.driver_id))
  if (filtres.date_debut) params.set('date_debut', filtres.date_debut)
  if (filtres.date_fin)   params.set('date_fin',   filtres.date_fin)
  if (filtres.page)       params.set('page',       String(filtres.page))
  if (filtres.limit)      params.set('limit',      String(filtres.limit))
  const { data } = await apiClient.get<PaginatedResponse<Incident>>(`/api/incidents?${params}`)
  return data
}

/** Récupère les incidents ouverts (pour le dashboard). */
export async function getIncidentsOuverts(): Promise<Incident[]> {
  const { data } = await apiClient.get<ApiResponse<Incident[]>>('/api/incidents/ouverts')
  return data.donnees
}

/** Récupère les statistiques des incidents. */
export async function getStatsIncidents(dateDebut?: string, dateFin?: string): Promise<StatsIncidents> {
  const params = new URLSearchParams()
  if (dateDebut) params.set('date_debut', dateDebut)
  if (dateFin)   params.set('date_fin',   dateFin)
  const { data } = await apiClient.get<ApiResponse<StatsIncidents>>(`/api/incidents/stats?${params}`)
  return data.donnees
}

/** Récupère le détail d'un incident. */
export async function getIncident(id: number): Promise<Incident> {
  const { data } = await apiClient.get<ApiResponse<Incident>>(`/api/incidents/${id}`)
  return data.donnees
}

/** Déclare un nouvel incident. */
export async function createIncident(formData: IncidentFormData): Promise<{ donnees: Incident; message: string }> {
  const { data } = await apiClient.post<ApiResponse<Incident>>('/api/incidents', formData)
  return { donnees: data.donnees, message: data.message ?? '' }
}

/** Modifie un incident. */
export async function updateIncident(id: number, formData: Partial<IncidentFormData>): Promise<Incident> {
  const { data } = await apiClient.put<ApiResponse<Incident>>(`/api/incidents/${id}`, formData)
  return data.donnees
}

/** Marque un incident comme résolu. */
export async function resoudreIncident(id: number, data: ResoudreIncidentData): Promise<Incident> {
  const { data: res } = await apiClient.patch<ApiResponse<Incident>>(`/api/incidents/${id}/resoudre`, data)
  return res.donnees
}

/** Clôture définitivement un incident (admin). */
export async function cloreIncident(id: number): Promise<Incident> {
  const { data } = await apiClient.patch<ApiResponse<Incident>>(`/api/incidents/${id}/clore`, {})
  return data.donnees
}
