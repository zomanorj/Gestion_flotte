/**
 * useMissions.ts
 * Hook React personnalisé pour la gestion de l'état des missions — TransiFlow.
 *
 * Ce hook centralise toute la logique métier liée aux missions :
 *   - Chargement des missions avec pagination et filtres
 *   - Création, modification et suppression de missions
 *   - Gestion des états de chargement et d'erreur
 *   - Rafraîchissement automatique après chaque mutation
 *
 * Utilisation :
 *   const {
 *     missions,
 *     total,
 *     page,
 *     isLoading,
 *     error,
 *     filters,
 *     fetchMissions,
 *     createMission,
 *     updateMission,
 *     updateStatut,
 *     deleteMission,
 *     setFilters,
 *   } = useMissions()
 */

import { useState, useCallback, useEffect } from 'react'

import type {
  Mission,
  MissionFilters,
  MissionFormData,
  MissionListResponse,
  MissionStatut,
} from '../types/mission'

import * as missionService from '../services/missionService'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseMissionsReturn {
  // Données
  missions:   Mission[]
  total:      number
  totalPages: number
  page:       number
  limit:      number

  // États
  isLoading:  boolean
  error:      string | null

  // Filtres
  filters:    MissionFilters

  // Actions
  fetchMissions:    (filters?: Partial<MissionFilters>) => Promise<void>
  createMission:    (data: MissionFormData) => Promise<Mission>
  updateMission:    (id: number, data: Partial<MissionFormData>) => Promise<Mission>
  updateStatut:     (id: number, statut: MissionStatut) => Promise<Mission>
  deleteMission:    (id: number) => Promise<void>

  // Setters
  setFilters:   (filters: Partial<MissionFilters>) => void
  setPage:      (page: number) => void
  clearError:   () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook useMissions
// ─────────────────────────────────────────────────────────────────────────────

export function useMissions(): UseMissionsReturn {
  // ── État des données ──
  const [missions, setMissions]   = useState<Mission[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // ── État de chargement ──
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ── État des filtres ──
  const [filters, setFiltersState] = useState<MissionFilters>({
    page:  1,
    limit: 10,
    search: '',
    statut: '',
  })

  // ── Fonction de chargement des missions ──
  const fetchMissions = useCallback(async (
    newFilters?: Partial<MissionFilters>
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      // Fusion des anciens et nouveaux filtres
      const filtersToUse = newFilters
        ? { ...filters, ...newFilters }
        : filters

      const response: MissionListResponse = await missionService.getMissions(filtersToUse)

      setMissions(response.donnees)
      setTotal(response.pagination.total)
      setTotalPages(response.pagination.totalPages)

      // Mise à jour des filtres si page différente
      if (newFilters?.page !== undefined) {
        setFiltersState(prev => ({ ...prev, page: newFilters.page! }))
      }
    } catch (err) {
      console.error('useMissions.fetchMissions : erreur', err)
      setError('Impossible de charger la liste des missions')
      setMissions([])
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // ── Fonction de création ──
  const handleCreateMission = useCallback(async (
    data: MissionFormData
  ): Promise<Mission> => {
    const response = await missionService.createMission(data)
    // Rafraîchir la liste après création
    await fetchMissions()
    return response.donnees
  }, [fetchMissions])

  // ── Fonction de modification ──
  const handleUpdateMission = useCallback(async (
    id: number,
    data: Partial<MissionFormData>
  ): Promise<Mission> => {
    const response = await missionService.updateMission(id, data)
    // Rafraîchir la liste après modification
    await fetchMissions()
    return response.donnees
  }, [fetchMissions])

  // ── Fonction de changement de statut ──
  const handleUpdateStatut = useCallback(async (
    id: number,
    statut: MissionStatut
  ): Promise<Mission> => {
    const response = await missionService.updateStatut(id, statut)
    // Rafraîchir la liste après modification
    await fetchMissions()
    return response.donnees
  }, [fetchMissions])

  // ── Fonction de suppression (annulation) ──
  const handleDeleteMission = useCallback(async (
    id: number
  ): Promise<void> => {
    await missionService.deleteMission(id)
    // Rafraîchir la liste après suppression
    await fetchMissions()
  }, [fetchMissions])

  // ── Setter pour les filtres ──
  const setFilters = useCallback((newFilters: Partial<MissionFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  // ── Setter pour la page ──
  const setPage = useCallback((newPage: number) => {
    setFiltersState(prev => ({ ...prev, page: newPage }))
  }, [])

  // ── Effet : recharger quand les filtres changent ──
  useEffect(() => {
    fetchMissions()
  }, [filters.page, filters.limit, filters.statut])
  // Note: on ne met pas filters.search dans les dépendances pour éviter les rechargements
  // intempestifs pendant la frappe. La recherche est gérée avec debounce dans le composant.

  // ── Retour ──
  return {
    // Données
    missions,
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
    fetchMissions,
    createMission: handleCreateMission,
    updateMission: handleUpdateMission,
    updateStatut: handleUpdateStatut,
    deleteMission: handleDeleteMission,

    // Setters
    setFilters,
    setPage,
    clearError: () => setError(null),
  }
}