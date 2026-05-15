/**
 * MissionsPage.tsx
 * Page de gestion des missions — Transport STTA.
 *
 * Fonctionnalités :
 *   - Toggle vue Liste / Planning
 *   - Filtres : recherche, statut, date
 *   - Vue Liste : tableau avec toutes les missions
 *   - Vue Planning : calendrier hebdomadaire
 *   - Modal de création/modification
 *   - Actions : voir, modifier, changer statut, annuler
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useMissions } from '../hooks/useMissions'
import { useAuth } from '../contexts/AuthContext'
import MissionFormModal from '../components/missions/MissionFormModal'
import EmptyState from '../components/ui/EmptyState'

import type { Mission, MissionFormData, MissionStatut } from '../types/mission'
import { STATUT_COLORS, STATUT_LABELS } from '../types/mission'
import * as vehicleService from '../services/vehicleService'
import * as driverService from '../services/driverService'

import type { Vehicle } from '../services/vehicleService'
import type { Driver } from '../types/driver'

// ─────────────────────────────────────────────────────────────────────────────
// Composant Skeleton (ligne de tableau)
// ─────────────────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-6 bg-slate-200 rounded-full w-20" /></td>
      <td className="px-4 py-3"><div className="h-8 bg-slate-200 rounded w-24" /></td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant Vue Planning (calendrier hebdomadaire)
// ─────────────────────────────────────────────────────────────────────────────

interface PlanningViewProps {
  missions: Mission[]
  onMissionClick: (mission: Mission) => void
  onSlotClick: (date: string) => void
  semaineOffset: number
}

function PlanningView({ missions, onMissionClick, onSlotClick, semaineOffset }: PlanningViewProps) {
  // Générer les 7 jours de la semaine
  const aujourdHui = new Date()
  const debutSemaine = new Date(aujourdHui)
  debutSemaine.setDate(aujourdHui.getDate() - aujourdHui.getDay() + 1 + (semaineOffset * 7)) // Lundi
  debutSemaine.setHours(0, 0, 0, 0)

  const jours = Array.from({ length: 7 }, (_, i) => {
    const jour = new Date(debutSemaine)
    jour.setDate(debutSemaine.getDate() + i)
    return jour
  })

  // Tranches horaires (6h - 20h)
  const heures = Array.from({ length: 15 }, (_, i) => i + 6)

  const formatDateFr = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
  }

  const isAujourdHui = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const getMissionPosition = (mission: Mission) => {
    if (!mission.heure_depart) return null
    const [h, m] = mission.heure_depart.split(':').map(Number)
    const startHour = h + m / 60
    return startHour
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header : jours de la semaine */}
      <div className="grid grid-cols-8 border-b border-slate-200">
        <div className="p-3 text-xs font-medium text-slate-500 border-r border-slate-100">
          Heure
        </div>
        {jours.map((jour, i) => (
          <div
            key={i}
            className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${
              isAujourdHui(jour) ? 'bg-blue-50' : ''
            }`}
          >
            <p className={`text-xs font-medium ${isAujourdHui(jour) ? 'text-blue-600' : 'text-slate-600'}`}>
              {formatDateFr(jour)}
            </p>
          </div>
        ))}
      </div>

      {/* Corps : tranches horaires */}
      <div className="max-h-[600px] overflow-y-auto">
        {heures.map(heure => (
          <div key={heure} className="grid grid-cols-8 border-b border-slate-100 last:border-b-0 min-h-[48px]">
            {/* Colonne heure */}
            <div className="p-2 text-xs text-slate-500 border-r border-slate-100 text-center">
              {String(heure).padStart(2, '0')}:00
            </div>

            {/* Colonnes jours */}
            {jours.map((jour, jourIndex) => {
              const dateStr = jour.toISOString().split('T')[0]
              const missionsDuCreneau = missions.filter(m => {
                if (m.date_mission !== dateStr) return false
                const missionHour = getMissionPosition(m)
                if (missionHour === null) return false
                return missionHour >= heure && missionHour < heure + 1
              })

              return (
                <div
                  key={jourIndex}
                  className={`border-r border-slate-100 last:border-r-0 p-1 space-y-1 ${
                    isAujourdHui(jour) ? 'bg-blue-50/30' : ''
                  }`}
                  onClick={() => onSlotClick(dateStr)}
                >
                  {missionsDuCreneau.map(mission => (
                    <div
                      key={mission.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onMissionClick(mission)
                      }}
                      className={`p-2 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                        STATUT_COLORS[mission.statut].replace('text-', 'bg-').split(' ')[0]
                      }`}
                    >
                      <p className="font-medium text-slate-800 truncate">
                        {mission.heure_depart?.substring(0, 5)} — {mission.lieu_arrivee}
                      </p>
                      <p className="text-slate-600 truncate">
                        {mission.vehicle?.immatriculation}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function MissionsPage() {
  const navigate = useNavigate()
  const { utilisateur } = useAuth()

  // ── Hook missions ──
  const {
    missions,
    total,
    totalPages,
    page,
    isLoading,
    error,
    filters,
    fetchMissions,
    createMission,
    updateMission,
    deleteMission: deleteMissionAction,
    setFilters,
    setPage,
    clearError,
  } = useMissions()

  // ── États locaux ──
  const [searchInput, setSearchInput] = useState(filters.search || '')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'planning'>('list')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [semaineOffset, setSemaineOffset] = useState(0)

  // ── Debounce pour la recherche ──
  const searchTimeoutRef = useRef<number | undefined>(undefined)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInput(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      setFilters({ search: value, page: 1 })
    }, 300)
  }

  // ── Charger les véhicules et chauffeurs ──
  useEffect(() => {
    Promise.all([
      vehicleService.getVehicles({ limit: 500 }),
      driverService.getDrivers({ limit: 500 }),
    ]).then(([vehiculesResp, driversResp]) => {
      setVehicles(vehiculesResp.donnees)
      setDrivers(driversResp.donnees)
    })
  }, [])

  // ── Nettoyer le timeout au démontage ──
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // ── Vérifier les permissions ──
  const canCreateEdit = utilisateur?.role === 'admin' || utilisateur?.role === 'gestionnaire'
  const canDelete = utilisateur?.role === 'admin'

  // ── Handlers ──

  const handleOpenCreate = () => {
    setSelectedMission(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (mission: Mission) => {
    setSelectedMission(mission)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedMission(null)
  }

  const handleSubmit = async (data: MissionFormData) => {
    setIsSubmitting(true)
    try {
      if (selectedMission?.id) {
        await updateMission(selectedMission.id, data)
        toast.success('Mission modifiée avec succès')
      } else {
        await createMission(data)
        toast.success('Mission créée avec succès')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAnnuler = async (mission: Mission) => {
    if (!window.confirm(`Voulez-vous vraiment annuler la mission #${String(mission.id).padStart(4, '0')} ?`)) {
      return
    }

    try {
      await deleteMissionAction(mission.id)
      toast.success('Mission annulée avec succès')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
    }
  }

  const handleViewDetail = (mission: Mission) => {
    navigate(`/missions/${mission.id}`)
  }

  const handlePlanningMissionClick = (mission: Mission) => {
    handleViewDetail(mission)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePlanningSlotClick = (_date: string) => {
    if (canCreateEdit) {
      setSelectedMission(null)
      // On va ouvrir le modal avec la date pré-remplie
      setIsModalOpen(true)
      // Le modal utilisera la date par défaut, on pourrait la passer en prop
    }
  }

  // ── Calculs d'affichage ──
  const startItem = (page - 1) * 10 + 1
  const endItem = Math.min(page * 10, total)

  // ── Rendu ──
  return (
    <div className="space-y-6">
      {/* ── Header de page ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Missions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} {total === 1 ? 'mission' : 'missions'} au total
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Liste / Planning */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-800 shadow-sm font-medium'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              Liste
            </button>
            <button
              onClick={() => setViewMode('planning')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                viewMode === 'planning'
                  ? 'bg-white text-slate-800 shadow-sm font-medium'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Planning
            </button>
          </div>

          {canCreateEdit && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-150"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouvelle mission
            </button>
          )}
        </div>
      </div>

      {/* ── Barre de filtres ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Rechercher par lieu..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filtre statut */}
        <select
          value={filters.statut || ''}
          onChange={(e) => {
            setFilters({ statut: e.target.value as MissionStatut | '', page: 1 })
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
        >
          <option value="">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="planifiee">Planifiée</option>
          <option value="en_cours">En cours</option>
          <option value="terminee">Terminée</option>
          <option value="annulee">Annulée</option>
        </select>

        {/* Filtre date */}
        <input
          type="date"
          onChange={(e) => {
            setFilters({ date: e.target.value, page: 1 })
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>

      {/* ── Navigation semaine (pour le planning) ── */}
      {viewMode === 'planning' && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSemaineOffset(prev => prev - 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Semaine précédente
          </button>
          <button
            onClick={() => setSemaineOffset(0)}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cette semaine
          </button>
          <button
            onClick={() => setSemaineOffset(prev => prev + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Semaine suivante
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Message d'erreur ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m9-.27a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0z" />
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => {
              clearError()
              fetchMissions()
            }}
            className="ml-auto text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Vue Liste ── */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Réf.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Trajet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Véhicule</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Chauffeur</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <TableSkeleton key={i} />)
              ) : missions.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    {filters.search ? (
                      <EmptyState
                        icon={
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                        }
                        title={`Aucun résultat pour « ${filters.search} »`}
                        description="Essayez avec d'autres mots-clés ou réinitialisez les filtres."
                        actionLabel="Réinitialiser les filtres"
                        onAction={() => { setFilters({ search: '', page: 1 }); setSearchInput('') }}
                      />
                    ) : (
                      <EmptyState
                        icon={
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                          </svg>
                        }
                        title="Aucune mission planifiée"
                        description="Créez votre première mission pour commencer."
                        actionLabel={canCreateEdit ? 'Créer une mission' : undefined}
                        onAction={canCreateEdit ? handleOpenCreate : undefined}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                missions.map((mission) => (
                  <tr
                    key={mission.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      mission.statut === 'en_cours' ? 'bg-orange-50 hover:bg-orange-100' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">
                      #{String(mission.id).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <p>{new Date(mission.date_mission).toLocaleDateString('fr-FR')}</p>
                      {mission.heure_depart && (
                        <p className="text-xs text-slate-400">{mission.heure_depart.substring(0, 5)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{mission.lieu_depart}</span>
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                        <span className="font-medium text-slate-800">{mission.lieu_arrivee}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {mission.vehicle ? (
                        <div>
                          <p className="font-medium">{mission.vehicle.immatriculation}</p>
                          <p className="text-xs text-slate-400">{mission.vehicle.type}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {mission.driver ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            {mission.driver.prenom[0]}
                          </div>
                          <span>{mission.driver.prenom} {mission.driver.nom.toUpperCase()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[mission.statut]}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {STATUT_LABELS[mission.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewDetail(mission)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        {canCreateEdit && (
                          <button
                            onClick={() => handleOpenEdit(mission)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M16.862 4.489l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && mission.statut !== 'terminee' && mission.statut !== 'annulee' && (
                          <button
                            onClick={() => handleAnnuler(mission)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Annuler"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Vue Planning ── */}
      {viewMode === 'planning' && (
        <PlanningView
          missions={missions}
          onMissionClick={handlePlanningMissionClick}
          onSlotClick={handlePlanningSlotClick}
          semaineOffset={semaineOffset}
        />
      )}

      {/* ── Pagination ── */}
      {viewMode === 'list' && totalPages > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Affichage de <span className="font-medium">{startItem}</span> à{' '}
            <span className="font-medium">{endItem}</span> sur{' '}
            <span className="font-medium">{total}</span> missions
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <span className="px-3 py-1.5 text-sm text-slate-600">
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de création/modification ── */}
      <MissionFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={selectedMission}
        vehicles={vehicles}
        drivers={drivers}
        isLoading={isSubmitting}
      />
    </div>
  )
}