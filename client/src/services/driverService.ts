/**
 * driverService.ts
 * Service de communication avec l'API pour la gestion des chauffeurs — TransiFlow.
 *
 * Ce module centralise tous les appels HTTP vers les endpoints chauffeurs.
 * Il définit également les types TypeScript pour les données chauffeurs.
 *
 * Fonctions exportées :
 *   - getDrivers(params?)           → liste paginée avec filtres
 *   - getDriver(id)                 → détail d'un chauffeur
 *   - getAvailableDrivers(date)     → chauffeurs disponibles pour une date
 *   - createDriver(data)            → créer un nouveau chauffeur
 *   - updateDriver(id, data)        → modifier un chauffeur
 *   - deleteDriver(id)              → désactiver un chauffeur
 *   - getPermisAlertes()            → chauffeurs avec permis expirant
 *   - countDrivers(statut?)         → compteur de chauffeurs
 */

import apiClient from './api'

import type {
  Driver,
  DriverFilters,
  DriverFormData,
  DriverListResponse,
  DriverDetailResponse,
  DriverAlertesResponse,
  DriverCountResponse,
  Mission,
  MissionListResponse,
} from '../types/driver'

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions du service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getDrivers
 * Récupère la liste paginée des chauffeurs avec filtres optionnels.
 */
export async function getDrivers(
  filters: DriverFilters = {}
): Promise<DriverListResponse> {
  const { page = 1, limit = 10, search, statut } = filters

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (search)  params.set('search', search)
  if (statut && statut !== 'tous') params.set('statut', statut)

  const queryString = params.toString()
  const url = `/api/drivers${queryString ? `?${queryString}` : ''}`

  const { data } = await apiClient.get<DriverListResponse>(url)
  return data
}

/**
 * getDriver
 * Récupère les détails d'un chauffeur par son identifiant.
 */
export async function getDriver(id: number): Promise<DriverDetailResponse> {
  const { data } = await apiClient.get<DriverDetailResponse>(`/api/drivers/${id}`)
  return data
}

/**
 * getAvailableDrivers
 * Récupère les chauffeurs disponibles pour une date donnée.
 */
export async function getAvailableDrivers(date: string): Promise<{ succes: boolean; donnees: Driver[] }> {
  const { data } = await apiClient.get<{ succes: boolean; donnees: Driver[] }>(
    `/api/drivers/available?date=${date}`
  )
  return data
}

/**
 * createDriver
 * Crée un nouveau chauffeur avec validation des données.
 */
export async function createDriver(
  formData: DriverFormData
): Promise<DriverDetailResponse> {
  const { data } = await apiClient.post<DriverDetailResponse>(
    '/api/drivers',
    formData
  )
  return data
}

/**
 * updateDriver
 * Met à jour un chauffeur existant (mise à jour partielle).
 */
export async function updateDriver(
  id: number,
  formData: Partial<DriverFormData>
): Promise<DriverDetailResponse> {
  const { data } = await apiClient.put<DriverDetailResponse>(
    `/api/drivers/${id}`,
    formData
  )
  return data
}

/**
 * deleteDriver
 * Désactive un chauffeur (soft delete).
 */
export async function deleteDriver(id: number): Promise<DriverDetailResponse> {
  const { data } = await apiClient.delete<DriverDetailResponse>(`/api/drivers/${id}`)
  return data
}

/**
 * getPermisAlertes
 * Récupère les chauffeurs avec un permis expirant bientôt ou expiré.
 */
export async function getPermisAlertes(): Promise<DriverAlertesResponse> {
  const { data } = await apiClient.get<DriverAlertesResponse>('/api/drivers/alertes')
  return data
}

/**
 * countDrivers
 * Récupère le nombre total de chauffeurs (optionnellement par statut).
 */
export async function countDrivers(statut?: string): Promise<DriverCountResponse> {
  const params = statut ? `?statut=${statut}` : ''
  const { data } = await apiClient.get<DriverCountResponse>(`/api/drivers/count${params}`)
  return data
}

/**
 * getDriverMissions
 * Récupère les missions d'un chauffeur (pour la page détail).
 * Retourne un tableau vide si l'endpoint n'existe pas encore.
 */
export async function getDriverMissions(driverId: number): Promise<Mission[]> {
  try {
    const { data } = await apiClient.get<MissionListResponse>(
      `/api/missions?driver_id=${driverId}`
    )
    return data.donnees
  } catch {
    // L'endpoint missions n'existe pas encore (Sprint 4)
    return []
  }
}