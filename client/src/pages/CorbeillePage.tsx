/**
 * CorbeillePage.tsx
 * Page de gestion des éléments supprimés (soft-delete) — TransiFlow.
 * Sprint 9 — implémentation complète avec onglets, restauration et purge.
 *
 * Accès : administrateurs uniquement.
 */

import { useState, useEffect, useCallback } from 'react'
import { Navigate }      from 'react-router-dom'
import toast             from 'react-hot-toast'
import { useAuth }       from '../contexts/AuthContext'
import { usePageTitle }  from '../hooks/usePageTitle'
import * as corbeilleService from '../services/corbeilleService'
import ConfirmModal      from '../components/ui/ConfirmModal'
import EmptyState        from '../components/ui/EmptyState'
import { formatDateFR }  from '../utils/format'

// ─────────────────────────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────────────────────────

interface ElementCorbeille {
  id:              number
  deleted_at:      string
  deleted_by:      number | null
  deleted_by_nom:  string | null
  deleted_by_email: string | null
  libelle:         string
  // champs supplémentaires selon le type
  [key: string]: unknown
}

type TypeCorbeille = 'vehicles' | 'drivers' | 'missions' | 'clients'

const ONGLETS: { type: TypeCorbeille; libelle: string }[] = [
  { type: 'vehicles', libelle: 'Véhicules'  },
  { type: 'drivers',  libelle: 'Chauffeurs' },
  { type: 'missions', libelle: 'Missions'   },
  { type: 'clients',  libelle: 'Clients'    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function CorbeillePage() {
  usePageTitle('Corbeille')
  const { utilisateur } = useAuth()

  if (utilisateur?.role !== 'admin') return <Navigate to="/" replace />

  const [ongletActif,    setOngletActif]    = useState<TypeCorbeille>('vehicles')
  const [elements,       setElements]       = useState<ElementCorbeille[]>([])
  const [isLoading,      setIsLoading]      = useState(true)
  const [counts,         setCounts]         = useState<Record<string, number>>({})
  const [confirmRestore, setConfirmRestore] = useState<ElementCorbeille | null>(null)
  const [confirmPurge,   setConfirmPurge]   = useState<ElementCorbeille | null>(null)
  const [isPurgeAll,     setIsPurgeAll]     = useState(false)

  // Charger les compteurs au montage
  const chargerCounts = useCallback(async () => {
    try {
      const data = await corbeilleService.getCount()
      setCounts(data)
    } catch {
      // Silencieux
    }
  }, [])

  // Charger les éléments de l'onglet actif
  const chargerElements = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await corbeilleService.getCorbeille(ongletActif)
      setElements(data.donnees || [])
    } catch {
      toast.error('Erreur lors du chargement de la corbeille')
      setElements([])
    } finally {
      setIsLoading(false)
    }
  }, [ongletActif])

  useEffect(() => { chargerCounts() }, [chargerCounts])
  useEffect(() => { chargerElements() }, [chargerElements])

  // Restaurer un élément
  async function handleRestore() {
    if (!confirmRestore) return
    try {
      await corbeilleService.restore(ongletActif, confirmRestore.id)
      toast.success('Élément restauré avec succès')
      setConfirmRestore(null)
      chargerElements()
      chargerCounts()
    } catch {
      toast.error('Erreur lors de la restauration')
    }
  }

  // Supprimer définitivement un élément
  async function handlePurge() {
    if (!confirmPurge) return
    try {
      await corbeilleService.purge(ongletActif, confirmPurge.id)
      toast.success('Élément supprimé définitivement')
      setConfirmPurge(null)
      chargerElements()
      chargerCounts()
    } catch {
      toast.error('Erreur lors de la suppression définitive')
    }
  }

  // Vider tout l'onglet actif
  async function handleViderOnglet() {
    try {
      await Promise.all(elements.map(el => corbeilleService.purge(ongletActif, el.id)))
      toast.success(`Tous les éléments de "${ONGLETS.find(o => o.type === ongletActif)?.libelle}" ont été supprimés`)
      setIsPurgeAll(false)
      chargerElements()
      chargerCounts()
    } catch {
      toast.error('Erreur lors du vidage')
    }
  }

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Corbeille</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {counts.total ? `${counts.total} élément${counts.total > 1 ? 's' : ''} dans la corbeille` : 'Corbeille vide'}
          </p>
        </div>
        {elements.length > 0 && (
          <button
            onClick={() => setIsPurgeAll(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Vider cet onglet
          </button>
        )}
      </div>

      {/* ── Onglets ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {ONGLETS.map(onglet => (
          <button
            key={onglet.type}
            onClick={() => setOngletActif(onglet.type)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              ongletActif === onglet.type
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {onglet.libelle}
            {(counts[onglet.type] ?? 0) > 0 && (
              <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {counts[onglet.type]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-slate-200 rounded w-48" />
                  <div className="h-3 bg-slate-100 rounded w-32" />
                </div>
                <div className="w-24 h-4 bg-slate-100 rounded" />
                <div className="w-20 h-4 bg-slate-100 rounded" />
                <div className="flex gap-2">
                  <div className="w-20 h-8 bg-slate-100 rounded-lg" />
                  <div className="w-28 h-8 bg-slate-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : elements.length === 0 ? (
          <EmptyState
            icon={(
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            )}
            title={`Aucun élément dans ${ONGLETS.find(o => o.type === ongletActif)?.libelle}`}
            description="Les éléments supprimés apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Élément</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Supprimé le</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Supprimé par</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {elements.map(el => (
                  <tr key={el.id} className="hover:bg-slate-50 transition-colors">
                    {/* Libellé de l'élément */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-800">{el.libelle}</p>
                      <p className="text-xs text-slate-400">ID #{el.id}</p>
                    </td>
                    {/* Date de suppression */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDateFR(el.deleted_at)}
                    </td>
                    {/* Supprimé par */}
                    <td className="px-6 py-4">
                      {el.deleted_by_nom ? (
                        <div>
                          <p className="text-sm text-slate-700">{el.deleted_by_nom}</p>
                          <p className="text-xs text-slate-400">{el.deleted_by_email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Non renseigné</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setConfirmRestore(el)}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          Restaurer
                        </button>
                        <button
                          onClick={() => setConfirmPurge(el)}
                          className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Supprimer définitivement
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirmation restauration ── */}
      <ConfirmModal
        isOpen={Boolean(confirmRestore)}
        title="Restaurer cet élément ?"
        message={`"${confirmRestore?.libelle}" sera restauré et redeviendra visible dans le système.`}
        confirmLabel="Restaurer"
        variant="info"
        onConfirm={handleRestore}
        onCancel={() => setConfirmRestore(null)}
      />

      {/* ── Confirmation purge ── */}
      <ConfirmModal
        isOpen={Boolean(confirmPurge)}
        title="Suppression définitive ?"
        message={`ATTENTION : "${confirmPurge?.libelle}" sera supprimé de façon irréversible. Cette action ne peut pas être annulée.`}
        confirmLabel="Supprimer définitivement"
        variant="danger"
        onConfirm={handlePurge}
        onCancel={() => setConfirmPurge(null)}
      />

      {/* ── Confirmation vider l'onglet ── */}
      <ConfirmModal
        isOpen={isPurgeAll}
        title={`Vider "${ONGLETS.find(o => o.type === ongletActif)?.libelle}" ?`}
        message={`ATTENTION : Tous les ${elements.length} éléments de cet onglet seront supprimés définitivement. Cette action est irréversible.`}
        confirmLabel="Tout supprimer"
        variant="danger"
        onConfirm={handleViderOnglet}
        onCancel={() => setIsPurgeAll(false)}
      />
    </div>
  )
}
