/**
 * maintenanceService.ts
 * Service de communication avec l'API maintenance — TransiFlow.
 */

import apiClient from './api'
import type { Maintenance, MaintenanceFormData, TerminerMaintenanceData } from '../types/maintenance'

interface PaginatedResponse<T> {
  succes: boolean
  donnees: T[]
  pagination: {
    page: number; limit: number; total: number
    totalPages: number; hasNextPage: boolean; hasPrevPage: boolean
  }
}
interface ApiResponse<T> { succes: boolean; donnees: T; message?: string }

export interface FiltresMaintenance {
  vehicle_id?: number
  statut?:     string
  type?:       string
  page?:       number
  limit?:      number
}

/** Récupère la liste des maintenances avec filtres. */
export async function getMaintenances(filtres: FiltresMaintenance = {}): Promise<PaginatedResponse<Maintenance>> {
  const params = new URLSearchParams()
  if (filtres.vehicle_id) params.set('vehicle_id', String(filtres.vehicle_id))
  if (filtres.statut)     params.set('statut',     filtres.statut)
  if (filtres.type)       params.set('type',       filtres.type)
  if (filtres.page)       params.set('page',       String(filtres.page))
  if (filtres.limit)      params.set('limit',      String(filtres.limit))
  const { data } = await apiClient.get<PaginatedResponse<Maintenance>>(
    `/api/maintenances?${params}`
  )
  return data
}

/** Récupère les maintenances urgentes (dans les 7 jours ou km proche). */
export async function getMaintenancesUrgentes(): Promise<Maintenance[]> {
  const { data } = await apiClient.get<ApiResponse<Maintenance[]>>('/api/maintenances/urgentes')
  return data.donnees
}

/** Récupère le détail d'une maintenance. */
export async function getMaintenance(id: number): Promise<Maintenance> {
  const { data } = await apiClient.get<ApiResponse<Maintenance>>(`/api/maintenances/${id}`)
  return data.donnees
}

/** Planifie une nouvelle maintenance. */
export async function createMaintenance(formData: MaintenanceFormData): Promise<Maintenance> {
  const { data } = await apiClient.post<ApiResponse<Maintenance>>('/api/maintenances', formData)
  return data.donnees
}

/** Modifie une maintenance planifiée. */
export async function updateMaintenance(id: number, formData: Partial<MaintenanceFormData>): Promise<Maintenance> {
  const { data } = await apiClient.put<ApiResponse<Maintenance>>(`/api/maintenances/${id}`, formData)
  return data.donnees
}

/** Marque une maintenance comme terminée. */
export async function terminerMaintenance(id: number, data: TerminerMaintenanceData): Promise<Maintenance> {
  const { data: res } = await apiClient.patch<ApiResponse<Maintenance>>(
    `/api/maintenances/${id}/terminer`, data
  )
  return res.donnees
}

/** Récupère l'historique de maintenance d'un véhicule. */
export async function getHistorique(vehicleId: number): Promise<Maintenance[]> {
  const { data } = await apiClient.get<ApiResponse<Maintenance[]>>(
    `/api/maintenances/vehicle/${vehicleId}/historique`
  )
  return data.donnees
}
