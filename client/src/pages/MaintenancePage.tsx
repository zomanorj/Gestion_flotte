/**
 * MaintenancePage.tsx
 * Page de maintenance préventive — TransiFlow.
 *
 * Sections :
 *   - Bandeau urgences
 *   - KPIs
 *   - Calendrier mensuel
 *   - Liste des maintenances
 */

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

import { usePageTitle } from '../hooks/usePageTitle'
import * as maintenanceService from '../services/maintenanceService'
import * as vehicleService     from '../services/vehicleService'
import MaintenanceFormModal    from '../components/maintenance/MaintenanceFormModal'
import EmptyState              from '../components/ui/EmptyState'
import { useConfirm }          from '../hooks/useConfirm'
import { formatDateCourte } from '../utils/format'
import type { Maintenance, StatutMaintenance, TypeMaintenance } from '../types/maintenance'
import {
  LABELS_TYPE_MAINTENANCE, LABELS_STATUT_MAINTENANCE,
} from '../types/maintenance'
import type { Vehicle } from '../services/vehicleService'
import { useAuth } from '../contexts/AuthContext'
import { updateMaintenance } from '../services/maintenanceService'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers visuels
// ─────────────────────────────────────────────────────────────────────────────

function statutBadge(m: Maintenance): string {
  if (m.statut === 'terminee') return 'bg-emerald-100 text-emerald-700'
  if (m.statut === 'annulee')  return 'bg-slate-100 text-slate-500'
  if (m.statut === 'en_cours') return 'bg-blue-100 text-blue-700'
  // planifiee : vérifier urgence / retard
  if (m.date_planifiee) {
    const d = new Date(m.date_planifiee)
    const now = new Date()
    if (d < now)   return 'bg-red-100 text-red-700'
    const diff = (d.getTime() - now.getTime()) / 86400000
    if (diff <= 7) return 'bg-orange-100 text-orange-700'
  }
  return 'bg-slate-100 text-slate-700'
}

function statutLabel(m: Maintenance): string {
  if (m.statut !== 'planifiee') return LABELS_STATUT_MAINTENANCE[m.statut]
  if (m.date_planifiee) {
    const d = new Date(m.date_planifiee)
    const now = new Date()
    if (d < now) return 'EN RETARD'
    const diff = (d.getTime() - now.getTime()) / 86400000
    if (diff <= 7) return 'URGENT'
  }
  return 'Planifiée'
}

function SkeletonTable() {
  return (
    <div className="animate-pulse space-y-3 px-4 py-2">
      {[0,1,2,3].map(i => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="w-20 h-4 bg-slate-200 rounded" />
          <div className="flex-1 h-4 bg-slate-100 rounded" />
          <div className="w-24 h-6 bg-slate-200 rounded-full" />
          <div className="w-20 h-4 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  usePageTitle('Maintenance')
  const { utilisateur } = useAuth()
  const canEdit = utilisateur?.role === 'admin' || utilisateur?.role === 'gestionnaire'
  const { confirm, ConfirmModalComponent } = useConfirm()

  const [maintenances,  setMaintenances]  = useState<Maintenance[]>([])
  const [urgentes,      setUrgentes]      = useState<Maintenance[]>([])
  const [total,         setTotal]         = useState(0)
  const [totalPages,    setTotalPages]    = useState(1)
  const [page,          setPage]          = useState(1)
  const [loading,       setLoading]       = useState(true)

  const [filtreStatut,  setFiltreStatut]  = useState('')
  const [filtreType,    setFiltreType]    = useState('')
  const [vehicles,      setVehicles]      = useState<Vehicle[]>([])

  const [modalMode,     setModalMode]     = useState<'creer' | 'terminer'>('creer')
  const [selectedMaint, setSelectedMaint] = useState<Maintenance | null>(null)
  const [isModalOpen,   setIsModalOpen]   = useState(false)

  // Calendrier
  const [moisCal, setMoisCal] = useState(new Date())
  const [jourSelectionne, setJourSelectionne] = useState<number | null>(null)

  useEffect(() => {
    vehicleService.getVehicles({ limit: 100 }).then(r => setVehicles(r.donnees)).catch(() => {})
    maintenanceService.getMaintenancesUrgentes().then(setUrgentes).catch(() => setUrgentes([]))
  }, [])

  const charger = useCallback(() => {
    setLoading(true)
    maintenanceService.getMaintenances({
      statut: filtreStatut || undefined,
      type:   filtreType   || undefined,
      page, limit: 20,
    }).then(r => {
      setMaintenances(r.donnees)
      setTotal(r.pagination.total)
      setTotalPages(r.pagination.totalPages)
    }).catch(() => setMaintenances([]))
    .finally(() => setLoading(false))
  }, [filtreStatut, filtreType, page])

  useEffect(() => { charger() }, [charger])

  const handleAnnuler = async (m: Maintenance) => {
    const ok = await confirm({
      title: 'Annuler la maintenance',
      message: 'Voulez-vous vraiment annuler cette maintenance planifiée ?',
      confirmLabel: 'Annuler la maintenance',
      variant: 'warning',
    })
    if (!ok) return
    try {
      await updateMaintenance(m.id, { statut: 'annulee' as StatutMaintenance })
      toast.success('Maintenance annulée')
      charger()
    } catch { toast.error('Erreur') }
  }

  // Maintenances du calendrier pour le mois courant
  const maintDuMois = maintenances.filter(m => {
    if (!m.date_planifiee) return false
    const d = new Date(m.date_planifiee)
    return d.getMonth() === moisCal.getMonth() && d.getFullYear() === moisCal.getFullYear()
  })

  const maintDuJour = jourSelectionne !== null
    ? maintDuMois.filter(m => {
        if (!m.date_planifiee) return false
        return new Date(m.date_planifiee).getDate() === jourSelectionne
      })
    : []

  // Génération des jours du mois pour le calendrier
  const premierJour = new Date(moisCal.getFullYear(), moisCal.getMonth(), 1).getDay()
  const nbJours = new Date(moisCal.getFullYear(), moisCal.getMonth() + 1, 0).getDate()

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Maintenance préventive</h1>
          <p className="text-sm text-slate-500 mt-0.5">Planification et suivi de l'entretien de la flotte</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setSelectedMaint(null); setModalMode('creer'); setIsModalOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Planifier une maintenance
          </button>
        )}
      </div>

      {/* Bandeau urgences */}
      {urgentes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 font-semibold text-sm">
              🔴 {urgentes.length} véhicule{urgentes.length > 1 ? 's' : ''} nécessite{urgentes.length === 1 ? '' : 'nt'} une maintenance urgente
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {urgentes.map(u => (
              <span key={u.id}
                className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full cursor-pointer hover:bg-red-200 transition-colors"
                onClick={() => {
                  setSelectedMaint(u)
                  setModalMode('terminer')
                  setIsModalOpen(true)
                }}>
                {u.immatriculation} — {LABELS_TYPE_MAINTENANCE[u.type_maintenance]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Planifiées ce mois',
            value: maintenances.filter(m => {
              if (!m.date_planifiee || m.statut !== 'planifiee') return false
              const d = new Date(m.date_planifiee)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'En retard',
            value: maintenances.filter(m => {
              if (!m.date_planifiee || m.statut !== 'planifiee') return false
              return new Date(m.date_planifiee) < new Date()
            }).length,
            color: 'bg-red-50 text-red-600',
          },
          {
            label: 'Terminées cette année',
            value: maintenances.filter(m => {
              if (m.statut !== 'terminee' || !m.date_realisee) return false
              return new Date(m.date_realisee).getFullYear() === new Date().getFullYear()
            }).length,
            color: 'bg-emerald-50 text-emerald-600',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} shrink-0`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877
                     M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17
                     l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63
                     m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336
                     l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276
                     a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95
                     l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409
                     l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
              <p className="text-sm text-slate-600">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Calendrier + Liste */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Calendrier */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-800 capitalize">
              {moisCal.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setMoisCal(new Date(moisCal.getFullYear(), moisCal.getMonth() - 1))}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                ‹
              </button>
              <button onClick={() => setMoisCal(new Date(moisCal.getFullYear(), moisCal.getMonth() + 1))}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                ›
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center gap-y-1">
            {['L','M','M','J','V','S','D'].map((j, i) => (
              <div key={i} className="text-xs font-medium text-slate-400 py-1">{j}</div>
            ))}
            {/* Cases vides avant le 1er jour */}
            {Array.from({ length: premierJour === 0 ? 6 : premierJour - 1 }).map((_, i) => (
              <div key={`v${i}`} />
            ))}
            {/* Jours du mois */}
            {Array.from({ length: nbJours }, (_, i) => i + 1).map(jour => {
              const hasMaint = maintDuMois.some(m =>
                m.date_planifiee && new Date(m.date_planifiee).getDate() === jour
              )
              const isSelected = jourSelectionne === jour
              const isToday = new Date().getDate() === jour
                && new Date().getMonth() === moisCal.getMonth()
                && new Date().getFullYear() === moisCal.getFullYear()

              return (
                <button key={jour}
                  onClick={() => setJourSelectionne(isSelected ? null : jour)}
                  className={`relative text-xs rounded-full w-7 h-7 mx-auto flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-blue-600 text-white'
                    : isToday  ? 'bg-blue-100 text-blue-700 font-bold'
                    : 'hover:bg-slate-100 text-slate-700'
                  }`}>
                  {jour}
                  {hasMaint && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Maintenances du jour sélectionné */}
          {jourSelectionne !== null && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-xs font-medium text-slate-600">
                {maintDuJour.length === 0
                  ? 'Aucune maintenance ce jour'
                  : `${maintDuJour.length} maintenance${maintDuJour.length > 1 ? 's' : ''}`}
              </p>
              {maintDuJour.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutBadge(m)}`}>
                    {statutLabel(m)}
                  </span>
                  <span className="text-xs text-slate-600 truncate">
                    {m.immatriculation} — {LABELS_TYPE_MAINTENANCE[m.type_maintenance]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liste */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-800">Toutes les maintenances</h2>
            <div className="flex gap-2 ml-auto">
              <select value={filtreStatut}
                onChange={e => { setFiltreStatut(e.target.value); setPage(1) }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none">
                <option value="">Tous statuts</option>
                {(['planifiee','en_cours','terminee','annulee'] as StatutMaintenance[]).map(s => (
                  <option key={s} value={s}>{LABELS_STATUT_MAINTENANCE[s]}</option>
                ))}
              </select>
              <select value={filtreType}
                onChange={e => { setFiltreType(e.target.value); setPage(1) }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none">
                <option value="">Tous types</option>
                {(['revision','vidange','pneus','freins','courroie','filtres','autre'] as TypeMaintenance[]).map(t => (
                  <option key={t} value={t}>{LABELS_TYPE_MAINTENANCE[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? <SkeletonTable /> : maintenances.length === 0 ? (
            <EmptyState
              icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63" />
              </svg>}
              title="Aucune maintenance"
              description="Planifiez la première maintenance de votre flotte."
              actionLabel={canEdit ? 'Planifier une maintenance' : undefined}
              onAction={canEdit ? () => setIsModalOpen(true) : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Véhicule','Type','Statut','Date','KM prévu','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {maintenances.map(m => (
                    <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${
                      m.statut === 'planifiee' && m.date_planifiee && new Date(m.date_planifiee) < new Date()
                        ? 'bg-red-50/40' : ''
                    }`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{m.immatriculation}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{LABELS_TYPE_MAINTENANCE[m.type_maintenance]}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statutBadge(m)}`}>
                          {statutLabel(m)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDateCourte(m.date_planifiee ?? m.date_realisee)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {m.kilometrage_planifie
                          ? `${m.kilometrage_planifie.toLocaleString('fr-FR')} km`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs">
                          {canEdit && m.statut === 'planifiee' && (
                            <>
                              <button
                                onClick={() => { setSelectedMaint(m); setModalMode('terminer'); setIsModalOpen(true) }}
                                className="text-emerald-600 hover:text-emerald-800 font-medium">
                                Terminer
                              </button>
                              <button onClick={() => handleAnnuler(m)}
                                className="text-slate-400 hover:text-red-600 font-medium">
                                Annuler
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500">{total} maintenances</p>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40">← Préc.</button>
                <span className="text-xs text-slate-600">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40">Suiv. →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MaintenanceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { charger(); maintenanceService.getMaintenancesUrgentes().then(setUrgentes).catch(() => {}) }}
        mode={modalMode}
        maintenance={selectedMaint}
        vehicles={vehicles}
      />
      {ConfirmModalComponent}
    </div>
  )
}
