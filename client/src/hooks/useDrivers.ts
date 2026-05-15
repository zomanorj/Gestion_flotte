/**
 * useDrivers.ts
 * Hook React personnalisé pour la gestion de l'état des chauffeurs — TransiFlow.
 *
 * Ce hook centralise toute la logique métier liée aux chauffeurs :
 *   - Chargement des chauffeurs avec pagination et filtres
 *   - Création, modification et suppression de chauffeurs
 *   - Gestion des états de chargement et d'erreur
 *   - Rafraîchissement automatique après chaque mutation
 *
 * Utilisation :
 *   const {
 *     drivers,
 *     total,
 *     page,
 *     isLoading,
 *     error,
 *     filters,
 *     fetchDrivers,
 *     createDriver,
 *     updateDriver,
 *     deleteDriver,
 *     setFilters,
 *   } = useDrivers()
 */

import { useState, useCallback, useEffect } from 'react'

import type {
  Driver,
  DriverFilters,
  DriverFormData,
  DriverListResponse,
} from '../types/driver'

import * as driverService from '../services/driverService'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseDriversReturn {
  // Données
  drivers:    Driver[]
  total:      number
  totalPages: number
  page:       number
  limit:      number

  // États
  isLoading:  boolean
  error:      string | null

  // Filtres
  filters:    DriverFilters

  // Actions
  fetchDrivers:     (filters?: Partial<DriverFilters>) => Promise<void>
  createDriver:     (data: DriverFormData) => Promise<Driver>
  updateDriver:     (id: number, data: Partial<DriverFormData>) => Promise<Driver>
  deleteDriver:     (id: number) => Promise<void>

  // Setters
  setFilters:   (filters: Partial<DriverFilters>) => void
  setPage:      (page: number) => void
  clearError:   () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook useDrivers
// ─────────────────────────────────────────────────────────────────────────────

export function useDrivers(): UseDriversReturn {
  // ── État des données ──
  const [drivers, setDrivers]   = useState<Driver[]>([])
  const [total, setTotal]       = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // ── État de chargement ──
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ── État des filtres ──
  const [filters, setFiltersState] = useState<DriverFilters>({
    page:  1,
    limit: 10,
    search: '',
    statut: '',
  })

  // ── Fonction de chargement des chauffeurs ──
  const fetchDrivers = useCallback(async (
    newFilters?: Partial<DriverFilters>
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      // Fusion des anciens et nouveaux filtres
      const filtersToUse = newFilters
        ? { ...filters, ...newFilters }
        : filters

      const response: DriverListResponse = await driverService.getDrivers(filtersToUse)

      setDrivers(response.donnees)
      setTotal(response.pagination.total)
      setTotalPages(response.pagination.totalPages)

      // Mise à jour des filtres si page différente
      if (newFilters?.page !== undefined) {
        setFiltersState(prev => ({ ...prev, page: newFilters.page! }))
      }
    } catch (err) {
      console.error('useDrivers.fetchDrivers : erreur', err)
      setError('Impossible de charger la liste des chauffeurs')
      setDrivers([])
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // ── Fonction de création ──
  const handleCreateDriver = useCallback(async (
    data: DriverFormData
  ): Promise<Driver> => {
    const response = await driverService.createDriver(data)
    // Rafraîchir la liste après création
    await fetchDrivers()
    return response.donnees
  }, [fetchDrivers])

  // ── Fonction de modification ──
  const handleUpdateDriver = useCallback(async (
    id: number,
    data: Partial<DriverFormData>
  ): Promise<Driver> => {
    const response = await driverService.updateDriver(id, data)
    // Rafraîchir la liste après modification
    await fetchDrivers()
    return response.donnees
  }, [fetchDrivers])

  // ── Fonction de suppression (désactivation) ──
  const handleDeleteDriver = useCallback(async (
    id: number
  ): Promise<void> => {
    await driverService.deleteDriver(id)
    // Rafraîchir la liste après suppression
    await fetchDrivers()
  }, [fetchDrivers])

  // ── Setter pour les filtres ──
  const setFilters = useCallback((newFilters: Partial<DriverFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  // ── Setter pour la page ──
  const setPage = useCallback((newPage: number) => {
    setFiltersState(prev => ({ ...prev, page: newPage }))
  }, [])

  // ── Effet : recharger quand les filtres changent ──
  useEffect(() => {
    fetchDrivers()
  }, [filters.page, filters.limit, filters.statut])
  // Note: on ne met pas filters.search dans les dépendances pour éviter les rechargements
  // intempestifs pendant la frappe. La recherche est gérée avec debounce dans le composant.

  // ── Retour ──
  return {
    // Données
    drivers,
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
    fetchDrivers,
    createDriver: handleCreateDriver,
    updateDriver: handleUpdateDriver,
    deleteDriver: handleDeleteDriver,

    // Setters
    setFilters,
    setPage,
    clearError: () => setError(null),
  }
}