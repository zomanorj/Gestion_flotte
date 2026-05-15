/**
 * vehicleService.ts
 * Service de communication avec l'API pour la gestion des véhicules — TransiFlow.
 *
 * Ce module centralise tous les appels HTTP vers les endpoints véhicules.
 * Il définit également les types TypeScript pour les données véhicules.
 *
 * Fonctions exportées :
 *   - getVehicles(params?)     → liste paginée avec filtres
 *   - getVehicle(id)           → détail d'un véhicule
 *   - createVehicle(data)      → créer un nouveau véhicule
 *   - updateVehicle(id, data)  → modifier un véhicule
 *   - deleteVehicle(id)        → archiver un véhicule
 *   - getAlertes()             → véhicules avec documents expirant
 *   - countVehicles(statut?)   → compteur de véhicules
 */

import apiClient from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Types TypeScript
// ─────────────────────────────────────────────────────────────────────────────

/** Statuts possibles d'un véhicule */
export type VehicleStatut = 'actif' | 'en_revision' | 'archive'

/** Types de véhicules autorisés */
export type VehicleType = 'camion' | 'citerne' | 'pickup' | 'autre'

/** État d'un document (assurance ou visite technique) */
export type DocumentEtat = 'valide' | 'bientot_expiree' | 'expiree'

/** Interface principale d'un véhicule */
export interface Vehicle {
  id:                    number
  immatriculation:       string
  type:                  VehicleType
  capacite:              number
  statut:                VehicleStatut
  date_assurance:        string | null    // Format YYYY-MM-DD
  date_visite_technique: string | null    // Format YYYY-MM-DD
  kilometrage:           number
  notes:                 string | null
  created_at:            string
  updated_at:            string
}

/** Véhicule avec état des documents (pour les alertes) */
export interface VehicleAvecAlerte extends Vehicle {
  etat_assurance: DocumentEtat
  etat_visite:    DocumentEtat
}

/** Paramètres de filtrage pour la liste des véhicules */
export interface VehicleFilters {
  page?:    number
  limit?:   number
  search?:  string
  statut?:  VehicleStatut | 'tous' | ''
}

/** Réponse paginée de l'API pour la liste des véhicules */
export interface VehicleListResponse {
  succes: boolean
  donnees: Vehicle[]
  pagination: {
    page:        number
    limit:       number
    total:       number
    totalPages:  number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

/** Réponse de l'API pour les alertes */
export interface VehicleAlertesResponse {
  succes: boolean
  donnees: VehicleAvecAlerte[]
  resume: {
    total:           number
    expirees:        number
    bientotExpirees: number
  }
}

/** Réponse de l'API pour un véhicule unique */
export interface VehicleDetailResponse {
  succes: boolean
  message?: string
  donnees: Vehicle
}

/** Données pour créer ou modifier un véhicule */
export interface VehicleFormData {
  immatriculation:       string
  type:                  VehicleType
  capacite:              number
  statut?:               VehicleStatut
  date_assurance?:       string
  date_visite_technique?: string
  kilometrage?:          number
  notes?:                string
}

/** Réponse de comptage */
export interface VehicleCountResponse {
  succes: boolean
  donnees: { total: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions du service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getVehicles
 * Récupère la liste paginée des véhicules avec filtres optionnels.
 */
export async function getVehicles(
  filters: VehicleFilters = {}
): Promise<VehicleListResponse> {
  const { page = 1, limit = 10, search, statut } = filters

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (search)  params.set('search', search)
  if (statut && statut !== 'tous') params.set('statut', statut)

  const queryString = params.toString()
  const url = `/api/vehicles${queryString ? `?${queryString}` : ''}`

  const { data } = await apiClient.get<VehicleListResponse>(url)
  return data
}

/**
 * getVehicle
 * Récupère les détails d'un véhicule par son identifiant.
 */
export async function getVehicle(id: number): Promise<VehicleDetailResponse> {
  const { data } = await apiClient.get<VehicleDetailResponse>(`/api/vehicles/${id}`)
  return data
}

/**
 * createVehicle
 * Crée un nouveau véhicule avec validation des données.
 */
export async function createVehicle(
  formData: VehicleFormData
): Promise<VehicleDetailResponse> {
  const { data } = await apiClient.post<VehicleDetailResponse>(
    '/api/vehicles',
    formData
  )
  return data
}

/**
 * updateVehicle
 * Met à jour un véhicule existant (mise à jour partielle).
 */
export async function updateVehicle(
  id: number,
  formData: Partial<VehicleFormData>
): Promise<VehicleDetailResponse> {
  const { data } = await apiClient.put<VehicleDetailResponse>(
    `/api/vehicles/${id}`,
    formData
  )
  return data
}

/**
 * deleteVehicle
 * Archive un véhicule (soft delete).
 */
export async function deleteVehicle(id: number): Promise<VehicleDetailResponse> {
  const { data } = await apiClient.delete<VehicleDetailResponse>(`/api/vehicles/${id}`)
  return data
}

/**
 * getAlertes
 * Récupère les véhicules avec des documents expirant bientôt ou expirés.
 */
export async function getAlertes(): Promise<VehicleAlertesResponse> {
  const { data } = await apiClient.get<VehicleAlertesResponse>('/api/vehicles/alertes')
  return data
}

/**
 * countVehicles
 * Récupère le nombre total de véhicules (optionnellement par statut).
 */
export async function countVehicles(statut?: string): Promise<VehicleCountResponse> {
  const params = statut ? `?statut=${statut}` : ''
  const { data } = await apiClient.get<VehicleCountResponse>(`/api/vehicles/count${params}`)
  return data
}