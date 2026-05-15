/**
 * VehiclesPage.tsx
 * Page de gestion de la flotte de véhicules — TransiFlow.
 *
 * Fonctionnalités :
 *   - Liste paginée des véhicules avec filtres (recherche, statut)
 *   - Bandeau d'alertes pour les documents expirant
 *   - Modal de création/modification
 *   - Actions : voir, modifier, archiver
 *   - Skeleton loading pour un chargement fluide
 *   - Responsive : tableau scrollable horizontalement sur mobile
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useVehicles } from '../hooks/useVehicles'
import { useAuth } from '../contexts/AuthContext'
import VehicleFormModal from '../components/vehicles/VehicleFormModal'
import EmptyState from '../components/ui/EmptyState'

import type { Vehicle, VehicleFormData, VehicleStatut } from '../services/vehicleService'
import {
  formatDateFR,
  getDocumentEtat,
  getStatutClasses,
  getDateClasses,
  getTypeLabel,
  getStatutLabel,
} from '../utils/vehicleUtils'

// ─────────────────────────────────────────────────────────────────────────────
// Composant Skeleton (ligne de chargement)
// ─────────────────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-4 py-4 px-4">
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-3 bg-slate-100 rounded w-1/4"></div>
      </div>
      <div className="flex-1">
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
      </div>
      <div className="flex-1">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
      </div>
      <div className="flex-1">
        <div className="h-6 bg-slate-200 rounded-full w-1/3"></div>
      </div>
      <div className="flex-1">
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
      </div>
      <div className="flex-1">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
      </div>
      <div className="w-24">
        <div className="h-8 bg-slate-200 rounded w-full"></div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function VehiclesPage() {
  const navigate = useNavigate()
  const { utilisateur } = useAuth()

  // ── Hook véhicules ──
  const {
    vehicles,
    total,
    totalPages,
    page,
    isLoading,
    error,
    filters,
    fetchVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    setFilters,
    setPage,
    clearError,
  } = useVehicles()

  // ── États locaux ──
  const [searchInput, setSearchInput] = useState(filters.search || '')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [alertesCount, setAlertesCount] = useState(0)

  // ── Debounce pour la recherche ──
  const searchTimeoutRef = useRef<number | undefined>(undefined)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInput(value)

    // Debounce de 300ms
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      setFilters({ search: value, page: 1 })
    }, 300)
  }

  // ── Récupérer le nombre d'alertes ──
  useEffect(() => {
    import('../services/vehicleService').then(async ({ getAlertes }) => {
      try {
        const response = await getAlertes()
        setAlertesCount(response.resume.total)
      } catch {
        setAlertesCount(0)
      }
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
    setSelectedVehicle(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedVehicle(null)
  }

  const handleSubmit = async (data: VehicleFormData) => {
    setIsSubmitting(true)
    try {
      if (selectedVehicle?.id) {
        await updateVehicle(selectedVehicle.id, data)
        toast.success('Véhicule modifié avec succès')
      } else {
        await createVehicle(data)
        toast.success('Véhicule créé avec succès')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
      throw err // Pour que le modal ne se ferme pas en cas d'erreur
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArchive = async (vehicle: Vehicle) => {
    if (!window.confirm(`Voulez-vous vraiment archiver le véhicule ${vehicle.immatriculation} ?`)) {
      return
    }

    try {
      await deleteVehicle(vehicle.id)
      toast.success('Véhicule archivé avec succès')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
    }
  }

  const handleViewDetail = (vehicle: Vehicle) => {
    navigate(`/vehicles/${vehicle.id}`)
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
            Flotte de véhicules
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} {total === 1 ? 'véhicule' : 'véhicules'} au total
          </p>
        </div>

        {canCreateEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-150"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter un véhicule
          </button>
        )}
      </div>

      {/* ── Bandeau d'alertes ── */}
      {alertesCount > 0 && (
        <div
          className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={() => setFilters({ statut: '' })}
          role="alert"
        >
          <svg className="w-5 h-5 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378
                 c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-orange-800">
            <span className="font-semibold">{alertesCount}</span> véhicule{alertesCount > 1 ? 's' : ''} ont des documents expirant bientôt
          </p>
        </div>
      )}

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
            placeholder="Rechercher par immatriculation ou type..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filtre statut */}
        <select
          value={filters.statut || ''}
          onChange={(e) => {
            setFilters({ statut: e.target.value as VehicleStatut | '', page: 1 })
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="en_revision">En révision</option>
          <option value="archive">Archivé</option>
        </select>
      </div>

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
              fetchVehicles()
            }}
            className="ml-auto text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Tableau ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header du tableau */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 hidden md:grid md:grid-cols-12 gap-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          <div className="col-span-3">Immatriculation</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-1">Capacité</div>
          <div className="col-span-1">Statut</div>
          <div className="col-span-2">Assurance</div>
          <div className="col-span-1">Kilométrage</div>
          <div className="col-span-2">Actions</div>
        </div>

        {/* Corps du tableau */}
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            // Skeleton loading
            Array.from({ length: 5 }).map((_, i) => (
              <TableSkeleton key={i} />
            ))
          ) : vehicles.length === 0 ? (
            // État vide
            filters.search ? (
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
                      d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H3m16.5 0h-.375
                         M3.75 18.75V7.5A2.25 2.25 0 016 5.25h10.5A2.25 2.25 0 0118.75 7.5v6.75
                         m-15 4.5h.375m14.625 0h.375m-14.625 0H3.75
                         M18.75 14.25h-3.375a.75.75 0 01-.75-.75v-3a.75.75 0 01.75-.75h2.625
                         c.621 0 1.125.504 1.125 1.125v3.375z
                         M20.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0" />
                  </svg>
                }
                title="Aucun véhicule"
                description="Commencez par ajouter votre premier véhicule à la flotte."
                actionLabel={canCreateEdit ? 'Ajouter un véhicule' : undefined}
                onAction={canCreateEdit ? handleOpenCreate : undefined}
              />
            )
          ) : (
            // Liste des véhicules
            vehicles.map((vehicle) => {
              const etatAssurance = getDocumentEtat(vehicle.date_assurance)
              return (
                <div
                  key={vehicle.id}
                  className="px-4 py-4 hover:bg-blue-50/50 transition-colors duration-150 group"
                >
                  {/* Version mobile (stacked) */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{vehicle.immatriculation}</p>
                        <p className="text-xs text-slate-500">{getTypeLabel(vehicle.type)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatutClasses(vehicle.statut)}`}>
                        {getStatutLabel(vehicle.statut)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span>Cap: {vehicle.capacite}t</span>
                      <span className={getDateClasses(etatAssurance)}>
                        Assurance: {formatDateFR(vehicle.date_assurance)}
                      </span>
                      <span>{vehicle.kilometrage.toLocaleString()} km</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleViewDetail(vehicle)}
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
                          onClick={() => handleOpenEdit(vehicle)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M16.862 4.489l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.5 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                      )}
                      {canDelete && vehicle.statut !== 'archive' && (
                        <button
                          onClick={() => handleArchive(vehicle)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Archiver"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Version desktop (grid) */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
                    {/* Immatriculation + Type */}
                    <div className="col-span-3">
                      <p className="font-semibold text-slate-800">{vehicle.immatriculation}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{getTypeLabel(vehicle.type)}</p>
                    </div>

                    {/* Type (caché car déjà affiché ci-dessus) */}
                    <div className="col-span-2">
                      <span className="text-sm text-slate-600">{getTypeLabel(vehicle.type)}</span>
                    </div>

                    {/* Capacité */}
                    <div className="col-span-1">
                      <span className="text-sm text-slate-600">{vehicle.capacite}t</span>
                    </div>

                    {/* Statut */}
                    <div className="col-span-1">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatutClasses(vehicle.statut)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {getStatutLabel(vehicle.statut)}
                      </span>
                    </div>

                    {/* Date assurance */}
                    <div className="col-span-2">
                      <span className={`text-sm ${getDateClasses(etatAssurance)}`}>
                        {formatDateFR(vehicle.date_assurance)}
                      </span>
                      {etatAssurance === 'expiree' && (
                        <span className="block text-xs text-red-500">Expirée</span>
                      )}
                      {etatAssurance === 'bientot_expiree' && (
                        <span className="block text-xs text-orange-500">Bientôt expirée</span>
                      )}
                    </div>

                    {/* Kilométrage */}
                    <div className="col-span-1">
                      <span className="text-sm text-slate-600">
                        {vehicle.kilometrage.toLocaleString()} km
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleViewDetail(vehicle)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir le détail"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        {canCreateEdit && (
                          <button
                            onClick={() => handleOpenEdit(vehicle)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M16.862 4.489l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.5 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        )}
                        {canDelete && vehicle.statut !== 'archive' && (
                          <button
                            onClick={() => handleArchive(vehicle)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Archiver"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Affichage de <span className="font-medium">{startItem}</span> à{' '}
              <span className="font-medium">{endItem}</span> sur{' '}
              <span className="font-medium">{total}</span> véhicules
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
      </div>

      {/* ── Modal de création/modification ── */}
      <VehicleFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={selectedVehicle}
        isLoading={isSubmitting}
      />
    </div>
  )
}