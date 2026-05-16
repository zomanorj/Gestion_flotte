// client/src/pages/SalairesPage.tsx
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import * as salaireService from '../services/salaireService'
import type { Salaire } from '../types/salaire'
import { formatMGA } from '../utils/format'
import SalaireModal from '../components/salaires/SalaireModal'
import EmptyState from '../components/ui/EmptyState'
import { usePageTitle } from '../hooks/usePageTitle'

export default function SalairesPage() {
  usePageTitle('Salaires')

  const now = new Date()
  const moisSelectionne = now.getMonth() + 1
  const anneeSelectionnee = now.getFullYear()

  const [salaires, setSalaires] = useState<Salaire[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSalaire, setSelectedSalaire] = useState<Salaire | null>(null)
  const [statutFilter, setStatutFilter] = useState('tous')

  const fetchSalaires = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await salaireService.getSalaires({
        mois: moisSelectionne,
        annee: anneeSelectionnee,
        statut: statutFilter || undefined,
      })
      setSalaires(data.donnees || [])
    } catch (err) {
      console.error('Erreur chargement salaires:', err)
      setError('Impossible de charger les salaires.')
      toast.error('Erreur lors du chargement des salaires')
    } finally {
      setIsLoading(false)
    }
  }, [moisSelectionne, anneeSelectionnee, statutFilter])

  useEffect(() => {
    fetchSalaires()
  }, [fetchSalaires])

  const handlePayer = async (id: number) => {
    try {
      await salaireService.payerSalaire(id, { montant: 0, mode_paiement: 'especes' })
      toast.success('Salaire marqué comme payé')
      fetchSalaires()
    } catch (err) {
      console.error('Erreur paiement salaire:', err)
      toast.error('Erreur lors du paiement du salaire')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce salaire ?')) return
    try {
      await salaireService.deleteSalaire(id)
      toast.success('Salaire supprimé')
      fetchSalaires()
    } catch (err) {
      console.error('Erreur suppression salaire:', err)
      toast.error('Erreur lors de la suppression du salaire')
    }
  }

  const openEdit = (s: Salaire) => {
    setSelectedSalaire(s)
    setIsModalOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Salaires & Primes</h1>
          <p className="text-sm text-slate-500">Gestion des paiements des chauffeurs</p>
        </div>
        <div className="flex gap-3">
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="paye">Payé</option>
          </select>
          <button type="button" onClick={() => { setSelectedSalaire(null); setIsModalOpen(true) }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">
            Nouveau salaire
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 flex-wrap rounded-lg border p-4"
          style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626', fontSize: 14 }}
        >
          <svg className="w-5 h-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m9-.364a9.003 9.003 0 00-18 0 9 9 0 0018 0Zm-12.036 9.75h-.007v-.008h-.006v8.025m6.036-11.076h-.007v8.026h-.007V21.75Z" />
          </svg>
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={fetchSalaires}
            className="shrink-0 text-sm font-medium underline-offset-2 hover:underline ml-auto"
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : salaires.length === 0 ? (
          <EmptyState
            icon={(
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182
                     C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659
                     -1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            title="Aucun salaire ce mois"
            description="Les salaires sont générés automatiquement quand une mission est marquée terminée."
            actionLabel="Ajouter un salaire manuellement"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 border-b"><th className="px-6 py-4 text-xs text-slate-500">Chauffeur</th><th className="px-6 py-4 text-xs text-slate-500">Type</th><th className="px-6 py-4 text-xs text-slate-500 text-right">Montant</th><th className="px-6 py-4 text-xs text-slate-500 text-center">Statut</th><th className="px-6 py-4 text-xs text-slate-500 text-right">Actions</th></tr></thead>
              <tbody className="divide-y">
                {salaires.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4">{s.driver_prenom} {s.driver_nom}</td>
                    <td className="px-6 py-4">{s.type_salaire}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatMGA(s.montant)}</td>
                    <td className="px-6 py-4 text-center">{s.statut === 'paye' ? 'Payé' : 'En attente'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {s.statut === 'en_attente' && <button type="button" onClick={() => handlePayer(s.id)} className="text-green-600 text-sm">Payer</button>}
                      <button type="button" onClick={() => openEdit(s)} className="text-blue-600 text-sm">Modifier</button>
                      <button type="button" onClick={() => handleDelete(s.id)} className="text-red-600 text-sm">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SalaireModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchSalaires} salaire={selectedSalaire ?? undefined} />
    </div>
  )
}
