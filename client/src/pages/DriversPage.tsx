/**
 * DriversPage.tsx
 * Page de gestion des chauffeurs — Transport STTA.
 *
 * Fonctionnalités :
 *   - Liste des chauffeurs en cartes (pas de tableau — plus humain)
 *   - Filtres : recherche (nom, prénom, numéro permis) et statut
 *   - Bandeau d'alertes pour les permis expirant
 *   - Modal de création/modification
 *   - Actions : voir, modifier, désactiver
 *   - Skeleton loading pour un chargement fluide
 *   - Responsive : 1 col mobile, 2 col tablette, 3 col desktop
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useDrivers } from '../hooks/useDrivers'
import { useAuth } from '../contexts/AuthContext'
import DriverFormModal from '../components/drivers/DriverFormModal'

import type { Driver, DriverFormData, DriverStatut } from '../types/driver'
import {
  getInitials,
  getAvatarColor,
  getPermisBadgeClasses,
  getPermisLabel,
  getStatutClasses,
  getStatutLabel,
  formatDateFR,
} from '../utils/avatarColor'

import * as driverService from '../services/driverService'

// ─────────────────────────────────────────────────────────────────────────────
// Composant Skeleton (carte de chargement)
// ─────────────────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-24" />
            <div className="h-3 bg-slate-100 rounded w-16" />
          </div>
        </div>
        <div className="h-6 bg-slate-100 rounded-full w-20" />
      </div>
      <div className="space-y-2.5">
        <div className="h-3 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
        <div className="h-8 bg-slate-100 rounded-lg w-20" />
        <div className="h-8 bg-slate-100 rounded-lg w-20" />
        <div className="h-8 bg-slate-100 rounded-lg w-20 ml-auto" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const navigate = useNavigate()
  const { utilisateur } = useAuth()

  // ── Hook chauffeurs ──
  const {
    drivers,
    total,
    totalPages,
    page,
    isLoading,
    error,
    filters,
    fetchDrivers,
    createDriver,
    updateDriver,
    deleteDriver,
    setFilters,
    setPage,
    clearError,
  } = useDrivers()

  // ── États locaux ──
  const [searchInput, setSearchInput] = useState(filters.search || '')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
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

  // ── Récupérer le nombre d'alertes permis ──
  useEffect(() => {
    driverService.getPermisAlertes()
      .then(response => {
        setAlertesCount(response.resume.total)
      })
      .catch(() => {
        setAlertesCount(0)
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
    setSelectedDriver(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (driver: Driver) => {
    setSelectedDriver(driver)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedDriver(null)
  }

  const handleSubmit = async (data: DriverFormData) => {
    setIsSubmitting(true)
    try {
      if (selectedDriver?.id) {
        await updateDriver(selectedDriver.id, data)
        toast.success('Chauffeur modifié avec succès')
      } else {
        await createDriver(data)
        toast.success('Chauffeur créé avec succès')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
      throw err // Pour que le modal ne se ferme pas en cas d'erreur
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDesactiver = async (driver: Driver) => {
    if (!window.confirm(`Voulez-vous vraiment désactiver le chauffeur ${driver.prenom} ${driver.nom} ?`)) {
      return
    }

    try {
      await deleteDriver(driver.id)
      toast.success('Chauffeur désactivé avec succès')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
    }
  }

  const handleViewDetail = (driver: Driver) => {
    navigate(`/drivers/${driver.id}`)
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
            Chauffeurs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} {total === 1 ? 'chauffeur' : 'chauffeurs'} au total
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
            Ajouter un chauffeur
          </button>
        )}
      </div>

      {/* ── Bandeau d'alertes permis ── */}
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
            <span className="font-semibold">{alertesCount}</span> chauffeur{alertesCount > 1 ? 's' : ''} ont un permis expirant bientôt
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
            placeholder="Rechercher par nom, prénom ou permis..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filtre statut */}
        <select
          value={filters.statut || ''}
          onChange={(e) => {
            setFilters({ statut: e.target.value as DriverStatut | '', page: 1 })
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="en_conge">En congé</option>
          <option value="inactif">Inactif</option>
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
              fetchDrivers()
            }}
            className="ml-auto text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Grille de cartes ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          // Skeleton loading
          Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))
        ) : drivers.length === 0 ? (
          // État vide
          <div className="col-span-full py-12 px-4 text-center">
            <svg
              className="w-16 h-16 text-slate-300 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952
                   4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07
                   M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109
                   a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z
                   m8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-slate-500 text-sm">Aucun chauffeur trouvé</p>
            <p className="text-slate-400 text-xs mt-1">
              Essayez de modifier vos filtres de recherche
            </p>
          </div>
        ) : (
          // Liste des chauffeurs
          drivers.map((driver) => {
            const { bg: avatarBg, text: avatarText } = getAvatarColor(
              `${driver.prenom} ${driver.nom}`
            )
            const initials = getInitials(driver.prenom, driver.nom)

            return (
              <div
                key={driver.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow duration-150 group"
              >
                {/* Header de la carte */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${avatarBg} ${avatarText}`}
                    >
                      {initials}
                    </div>
                    {/* Nom + Statut */}
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {driver.prenom} {driver.nom.toUpperCase()}
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getStatutClasses(driver.statut)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {getStatutLabel(driver.statut)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Informations */}
                <div className="space-y-2.5 text-sm text-slate-600">
                  {/* Téléphone */}
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.25 2.25a.75.75 0 000 1.5h1.388c.38 0 .725.217.895.553l.142.284a1.25 1.25 0 01-.276 1.548l-.197.155a4.375 4.375 0 001.528 7.513l.292.064a1.25 1.25 0 01.96 1.218v1.388a.75.75 0 001.5 0v-1.388a2.75 2.75 0 00-2.124-2.68l-.292-.064a2.875 2.875 0 01-1.005-4.945l.197-.155a2.75 2.75 0 00.608-3.406l-.142-.284A2.75 2.75 0 0013.076 4.5H11.25a.75.75 0 000-1.5h1.826a4.25 4.25 0 013.806 2.376l.142.284a4.25 4.25 0 01-.94 5.27l-.197.155a2.875 2.875 0 001.005 4.945l.292.064a4.25 4.25 0 013.288 4.164v1.388a.75.75 0 001.5 0v-1.388a5.75 5.75 0 00-4.44-5.604l-.292-.064a2.75 2.75 0 01-.96-1.218v-1.388a1.25 1.25 0 00-.895-1.197l-.292-.064a2.875 2.875 0 00-1.005-4.945l.197-.155a4.25 4.25 0 00.94-5.27l-.142-.284A4.25 4.25 0 0013.076 4.5H2.25z" />
                    </svg>
                    <span>{driver.telephone || '—'}</span>
                  </div>

                  {/* Numéro de permis */}
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                    </svg>
                    <span className="font-mono text-xs">{driver.numero_permis}</span>
                  </div>

                  {/* Date expiration permis */}
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 12.75a.75.75 0 001.5 0V6a.75.75 0 00-1.5 0v6.75zm2.25 0a.75.75 0 001.5 0V5.25a.75.75 0 00-1.5 0v7.5zm2.25 0a.75.75 0 001.5 0V8.25a.75.75 0 00-1.5 0v4.5zm2.25 0a.75.75 0 001.5 0V3.75a.75.75 0 00-1.5 0v9zm2.25 0a.75.75 0 001.5 0V6a.75.75 0 00-1.5 0v6.75zm2.25 0a.75.75 0 001.5 0V5.25a.75.75 0 00-1.5 0v7.5z" />
                    </svg>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getPermisBadgeClasses(driver.date_expiration_permis)}`}>
                      {formatDateFR(driver.date_expiration_permis)} — {getPermisLabel(driver.date_expiration_permis)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleViewDetail(driver)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                    title="Voir le détail"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Voir
                  </button>

                  {canCreateEdit && (
                    <button
                      onClick={() => handleOpenEdit(driver)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M16.862 4.489l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.5 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      Modifier
                    </button>
                  )}

                  {canDelete && driver.statut !== 'inactif' && (
                    <button
                      onClick={() => handleDesactiver(driver)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-600 bg-slate-50 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                      title="Désactiver"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Désactiver
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Affichage de <span className="font-medium">{startItem}</span> à{' '}
            <span className="font-medium">{endItem}</span> sur{' '}
            <span className="font-medium">{total}</span> chauffeurs
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
      <DriverFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={selectedDriver}
        isLoading={isSubmitting}
      />
    </div>
  )
}