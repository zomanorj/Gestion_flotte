/**
 * missionService.ts
 * Service de communication avec l'API pour la gestion des missions — TransiFlow.
 *
 * Ce module centralise tous les appels HTTP vers les endpoints missions.
 *
 * Fonctions exportées :
 *   - getMissions(filters?)           → liste paginée avec filtres
 *   - getMission(id)                  → détail d'une mission
 *   - getMissionsByDate(date)         → missions d'un jour pour le planning
 *   - getMissionStats()               → statistiques globales
 *   - createMission(data)             → créer une nouvelle mission
 *   - updateMission(id, data)         → modifier une mission
 *   - updateStatut(id, statut)        → changer le statut d'une mission
 *   - deleteMission(id)               → annuler une mission (soft delete)
 *   - countMissions(statut?)          → compteur de missions
 */

import apiClient from './api'

import type {
  Mission,
  MissionFilters,
  MissionFormData,
  MissionListResponse,
  MissionDetailResponse,
  MissionStatsResponse,
  MissionCountResponse,
  MissionStatut,
} from '../types/mission'

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions du service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getMissions
 * Récupère la liste paginée des missions avec filtres optionnels.
 */
export async function getMissions(
  filters: MissionFilters = {}
): Promise<MissionListResponse> {
  const { page = 1, limit = 10, search, statut, date, vehicle_id, driver_id } = filters

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (search)  params.set('search', search)
  if (statut && statut !== 'tous') params.set('statut', statut)
  if (date)    params.set('date', date)
  if (vehicle_id) params.set('vehicle_id', String(vehicle_id))
  if (driver_id)  params.set('driver_id', String(driver_id))

  const queryString = params.toString()
  const url = `/api/missions${queryString ? `?${queryString}` : ''}`

  const { data } = await apiClient.get<MissionListResponse>(url)
  return data
}

/**
 * getMission
 * Récupère les détails d'une mission par son identifiant.
 */
export async function getMission(id: number): Promise<MissionDetailResponse> {
  const { data } = await apiClient.get<MissionDetailResponse>(`/api/missions/${id}`)
  return data
}

/**
 * getMissionsByDate
 * Récupère toutes les missions d'une date donnée (pour le planning).
 */
export async function getMissionsByDate(date: string): Promise<{ succes: boolean; donnees: Mission[] }> {
  const { data } = await apiClient.get<{ succes: boolean; donnees: Mission[] }>(
    `/api/missions/planning?date=${date}`
  )
  return data
}

/**
 * getMissionStats
 * Récupère les statistiques globales des missions.
 */
export async function getMissionStats(): Promise<MissionStatsResponse> {
  const { data } = await apiClient.get<MissionStatsResponse>('/api/missions/stats')
  return data
}

/**
 * createMission
 * Crée une nouvelle mission avec validation des données.
 */
export async function createMission(
  formData: MissionFormData
): Promise<MissionDetailResponse> {
  const { data } = await apiClient.post<MissionDetailResponse>(
    '/api/missions',
    formData
  )
  return data
}

/**
 * updateMission
 * Met à jour une mission existante (mise à jour partielle).
 */
export async function updateMission(
  id: number,
  formData: Partial<MissionFormData>
): Promise<MissionDetailResponse> {
  const { data } = await apiClient.put<MissionDetailResponse>(
    `/api/missions/${id}`,
    formData
  )
  return data
}

/**
 * updateStatut
 * Change le statut d'une mission selon le workflow.
 */
export async function updateStatut(
  id: number,
  statut: MissionStatut
): Promise<MissionDetailResponse> {
  const { data } = await apiClient.patch<MissionDetailResponse>(
    `/api/missions/${id}/statut`,
    { statut }
  )
  return data
}

/**
 * deleteMission
 * Annule une mission (soft delete).
 */
export async function deleteMission(id: number): Promise<MissionDetailResponse> {
  const { data } = await apiClient.delete<MissionDetailResponse>(`/api/missions/${id}`)
  return data
}

/**
 * countMissions
 * Récupère le nombre total de missions (optionnellement par statut).
 */
export async function countMissions(statut?: string): Promise<MissionCountResponse> {
  const params = statut ? `?statut=${statut}` : ''
  const { data } = await apiClient.get<MissionCountResponse>(`/api/missions/count${params}`)
  return data
}