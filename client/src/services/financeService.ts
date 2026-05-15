/**
 * financeService.ts
 * Service de communication avec l'API finances — TransiFlow.
 */

import apiClient from './api'
import type {
  Depense, Budget, StatsFinancieres, CoutMission,
  ComparaisonBudget, DepenseFormData,
} from '../types/finance'

interface PaginatedResponse<T> {
  succes: boolean
  donnees: T[]
  pagination: {
    page: number; limit: number; total: number
    totalPages: number; hasNextPage: boolean; hasPrevPage: boolean
  }
}

interface ApiResponse<T> {
  succes: boolean
  donnees: T
  message?: string
}

export interface FiltresDepenses {
  mission_id?:  number
  vehicle_id?:  number
  categorie?:   string
  date_debut?:  string
  date_fin?:    string
  page?:        number
  limit?:       number
}

/** Récupère la liste paginée des dépenses avec filtres. */
export async function getDepenses(filtres: FiltresDepenses = {}): Promise<PaginatedResponse<Depense>> {
  const params = new URLSearchParams()
  if (filtres.mission_id)  params.set('mission_id',  String(filtres.mission_id))
  if (filtres.vehicle_id)  params.set('vehicle_id',  String(filtres.vehicle_id))
  if (filtres.categorie)   params.set('categorie',   filtres.categorie)
  if (filtres.date_debut)  params.set('date_debut',  filtres.date_debut)
  if (filtres.date_fin)    params.set('date_fin',    filtres.date_fin)
  if (filtres.page)        params.set('page',        String(filtres.page))
  if (filtres.limit)       params.set('limit',       String(filtres.limit))
  const { data } = await apiClient.get<PaginatedResponse<Depense>>(
    `/api/finance/depenses?${params}`
  )
  return data
}

/** Récupère le détail d'une dépense. */
export async function getDepense(id: number): Promise<Depense> {
  const { data } = await apiClient.get<ApiResponse<Depense>>(`/api/finance/depenses/${id}`)
  return data.donnees
}

/** Crée une nouvelle dépense. */
export async function createDepense(formData: DepenseFormData): Promise<Depense> {
  const { data } = await apiClient.post<ApiResponse<Depense>>('/api/finance/depenses', formData)
  return data.donnees
}

/** Modifie une dépense. */
export async function updateDepense(id: number, formData: Partial<DepenseFormData>): Promise<Depense> {
  const { data } = await apiClient.put<ApiResponse<Depense>>(`/api/finance/depenses/${id}`, formData)
  return data.donnees
}

/** Supprime une dépense (admin uniquement). */
export async function deleteDepense(id: number): Promise<void> {
  await apiClient.delete(`/api/finance/depenses/${id}`)
}

/** Récupère le coût total d'une mission par catégorie. */
export async function getCoutMission(missionId: number): Promise<CoutMission> {
  const { data } = await apiClient.get<ApiResponse<CoutMission>>(`/api/finance/mission/${missionId}/cout`)
  return data.donnees
}

/** Récupère les statistiques financières globales. */
export async function getStatsFinancieres(dateDebut?: string, dateFin?: string): Promise<StatsFinancieres> {
  const params = new URLSearchParams()
  if (dateDebut) params.set('date_debut', dateDebut)
  if (dateFin)   params.set('date_fin',   dateFin)
  const { data } = await apiClient.get<ApiResponse<StatsFinancieres>>(
    `/api/finance/stats?${params}`
  )
  return data.donnees
}

/** Récupère les budgets par véhicule et année. */
export async function getBudgets(vehicleId?: number, annee?: number): Promise<Budget[]> {
  const params = new URLSearchParams()
  if (vehicleId) params.set('vehicle_id', String(vehicleId))
  if (annee)     params.set('annee',      String(annee))
  const { data } = await apiClient.get<ApiResponse<Budget[]>>(`/api/finance/budgets?${params}`)
  return data.donnees
}

/** Crée ou met à jour un budget mensuel. */
export async function setBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
  const { data } = await apiClient.post<ApiResponse<Budget>>('/api/finance/budgets', budget)
  return data.donnees
}

/** Compare budget et dépenses réelles. */
export async function comparerBudget(vehicleId: number, mois: number, annee: number): Promise<ComparaisonBudget> {
  const { data } = await apiClient.get<ApiResponse<ComparaisonBudget>>(
    `/api/finance/budgets/comparer?vehicle_id=${vehicleId}&mois=${mois}&annee=${annee}`
  )
  return data.donnees
}
