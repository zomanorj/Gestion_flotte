/**
 * useVehicles.ts
 * Hook React personnalisé pour la gestion de l'état des véhicules — Transport STTA.
 *
 * Ce hook centralise toute la logique métier liée aux véhicules :
 *   - Chargement des véhicules avec pagination et filtres
 *   - Création, modification et suppression de véhicules
 *   - Gestion des états de chargement et d'erreur
 *   - Rafraîchissement automatique après chaque mutation
 *
 * Utilisation :
 *   const {
 *     vehicles,
 *     total,
 *     page,
 *     isLoading,
 *     error,
 *     filters,
 *     fetchVehicles,
 *     createVehicle,
 *     updateVehicle,
 *     deleteVehicle,
 *     setFilters,
 *   } = useVehicles()
 */

import { useState, useCallback, useEffect } from 'react'

import type {
  Vehicle,
  VehicleFilters,
  VehicleFormData,
  VehicleListResponse,
} from '../services/vehicleService'

import * as vehicleService from '../services/vehicleService'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseVehiclesReturn {
  // Données
  vehicles:   Vehicle[]
  total:      number
  totalPages: number
  page:       number
  limit:      number

  // États
  isLoading:  boolean
  error:      string | null

  // Filtres
  filters:    VehicleFilters

  // Actions
  fetchVehicles:    (filters?: Partial<VehicleFilters>) => Promise<void>
  createVehicle:    (data: VehicleFormData) => Promise<Vehicle>
  updateVehicle:    (id: number, data: Partial<VehicleFormData>) => Promise<Vehicle>
  deleteVehicle:    (id: number) => Promise<void>

  // Setters
  setFilters:   (filters: Partial<VehicleFilters>) => void
  setPage:      (page: number) => void
  clearError:   () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook useVehicles
// ─────────────────────────────────────────────────────────────────────────────

export function useVehicles(): UseVehiclesReturn {
  // ── État des données ──
  const [vehicles, setVehicles]   = useState<Vehicle[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // ── État de chargement ──
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ── État des filtres ──
  const [filters, setFiltersState] = useState<VehicleFilters>({
    page:  1,
    limit: 10,
    search: '',
    statut: '',
  })

  // ── Fonction de chargement des véhicules ──
  const fetchVehicles = useCallback(async (
    newFilters?: Partial<VehicleFilters>
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      // Fusion des anciens et nouveaux filtres
      const filtersToUse = newFilters
        ? { ...filters, ...newFilters }
        : filters

      const response: VehicleListResponse = await vehicleService.getVehicles(filtersToUse)

      setVehicles(response.donnees)
      setTotal(response.pagination.total)
      setTotalPages(response.pagination.totalPages)

      // Mise à jour des filtres si page différente
      if (newFilters?.page !== undefined) {
        setFiltersState(prev => ({ ...prev, page: newFilters.page! }))
      }
    } catch (err) {
      console.error('useVehicles.fetchVehicles : erreur', err)
      setError('Impossible de charger la liste des véhicules')
      setVehicles([])
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // ── Fonction de création ──
  const handleCreateVehicle = useCallback(async (
    data: VehicleFormData
  ): Promise<Vehicle> => {
    const response = await vehicleService.createVehicle(data)
    // Rafraîchir la liste après création
    await fetchVehicles()
    return response.donnees
  }, [fetchVehicles])

  // ── Fonction de modification ──
  const handleUpdateVehicle = useCallback(async (
    id: number,
    data: Partial<VehicleFormData>
  ): Promise<Vehicle> => {
    const response = await vehicleService.updateVehicle(id, data)
    // Rafraîchir la liste après modification
    await fetchVehicles()
    return response.donnees
  }, [fetchVehicles])

  // ── Fonction de suppression (archivage) ──
  const handleDeleteVehicle = useCallback(async (
    id: number
  ): Promise<void> => {
    await vehicleService.deleteVehicle(id)
    // Rafraîchir la liste après suppression
    await fetchVehicles()
  }, [fetchVehicles])

  // ── Setter pour les filtres ──
  const setFilters = useCallback((newFilters: Partial<VehicleFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  // ── Setter pour la page ──
  const setPage = useCallback((newPage: number) => {
    setFiltersState(prev => ({ ...prev, page: newPage }))
  }, [])

  // ── Effet : recharger quand les filtres changent ──
  useEffect(() => {
    fetchVehicles()
  }, [filters.page, filters.limit, filters.statut])
  // Note: on ne met pas filters.search dans les dépendances pour éviter les rechargements
  // intempestifs pendant la frappe. La recherche est gérée avec debounce dans le composant.

  // ── Retour ──
  return {
    // Données
    vehicles,
    total,
    totalPages,
    page:      filters.page || 1,
    limit:     filters.limit || 10,

    // États
    isLoading,
    error,

    // Filtres
    filters,

    // Actions
    fetchVehicles,
    createVehicle: handleCreateVehicle,
    updateVehicle: handleUpdateVehicle,
    deleteVehicle: handleDeleteVehicle,

    // Setters
    setFilters,
    setPage,
    clearError: () => setError(null),
  }
}