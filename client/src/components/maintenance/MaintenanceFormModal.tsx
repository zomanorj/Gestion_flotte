/**
 * MaintenanceFormModal.tsx
 * Modal planification/terminaison d'une maintenance — TransiFlow.
 */

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createMaintenance, terminerMaintenance } from '../../services/maintenanceService'
import type { Maintenance, MaintenanceFormData, TerminerMaintenanceData,
              TypeMaintenance } from '../../types/maintenance'
import { INTERVALLES_MAINTENANCE, LABELS_TYPE_MAINTENANCE } from '../../types/maintenance'
import type { Vehicle } from '../../services/vehicleService'

interface Props {
  isOpen:       boolean
  onClose:      () => void
  onSuccess:    () => void
  mode:         'creer' | 'terminer'
  maintenance?: Maintenance | null
  vehicles?:    Vehicle[]
  defaultVehicleId?: number
}

const TYPES: TypeMaintenance[] = ['revision','vidange','pneus','freins','courroie','filtres','autre']

const defaultCreer: MaintenanceFormData = {
  vehicle_id: null, type_maintenance: '',
  date_planifiee: '', kilometrage_planifie: '',
  garage: '', description: '',
}

const defaultTerminer: TerminerMaintenanceData = {
  date_realisee: new Date().toISOString().split('T')[0],
  cout: '', kilometrage_realise: '',
  pieces_changees: [], garage: '',
  prochaine_maintenance_km: '', prochaine_maintenance_date: '',
  planifier_prochaine: true,
}

export default function MaintenanceFormModal({
  isOpen, onClose, onSuccess, mode,
  maintenance, vehicles = [], defaultVehicleId,
}: Props) {
  const [formCreer, setFormCreer]     = useState<MaintenanceFormData>(defaultCreer)
  const [formTerminer, setFormTerminer] = useState<TerminerMaintenanceData>(defaultTerminer)
  const [pieceInput, setPieceInput]   = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    if (mode === 'creer') {
      setFormCreer({ ...defaultCreer, vehicle_id: defaultVehicleId ?? null })
    } else if (mode === 'terminer' && maintenance) {
      const intervalle = INTERVALLES_MAINTENANCE[maintenance.type_maintenance]
      const kmActuel = maintenance.km_actuel ?? 0
      setFormTerminer({
        ...defaultTerminer,
        date_realisee: new Date().toISOString().split('T')[0],
        prochaine_maintenance_km: String(kmActuel + intervalle.km),
        garage: maintenance.garage ?? '',
      })
    }
  }, [isOpen, mode, maintenance, defaultVehicleId])

  // Label de l'intervalle conseillé
  const intervalleLabel = formCreer.type_maintenance
    ? (() => {
        const t = formCreer.type_maintenance as TypeMaintenance
        const i = INTERVALLES_MAINTENANCE[t]
        return `Recommandé : tous les ${i.km.toLocaleString('fr-FR')} km ou ${i.mois} mois`
      })()
    : null

  const ajouterPiece = () => {
    if (!pieceInput.trim()) return
    setFormTerminer(p => ({ ...p, pieces_changees: [...p.pieces_changees, pieceInput.trim()] }))
    setPieceInput('')
  }

  const supprimerPiece = (idx: number) => {
    setFormTerminer(p => ({ ...p, pieces_changees: p.pieces_changees.filter((_, i) => i !== idx) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    try {
      if (mode === 'creer') {
        if (!formCreer.vehicle_id) { setError('Véhicule obligatoire'); setIsSubmitting(false); return }
        if (!formCreer.type_maintenance) { setError('Type obligatoire'); setIsSubmitting(false); return }
        await createMaintenance(formCreer)
        toast.success('Maintenance planifiée')
      } else if (mode === 'terminer' && maintenance) {
        await terminerMaintenance(maintenance.id, formTerminer)
        toast.success('Maintenance terminée')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(msg); toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">

        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-semibold text-slate-800">
            {mode === 'creer' ? 'Planifier une maintenance' : 'Marquer comme terminée'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}

          {/* ── MODE CRÉER ── */}
          {mode === 'creer' && (
            <>
              {/* Véhicule */}
              {vehicles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Véhicule <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCreer.vehicle_id ?? ''}
                    onChange={e => setFormCreer(p => ({ ...p, vehicle_id: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Sélectionner…</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.immatriculation}</option>)}
                  </select>
                </div>
              )}

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formCreer.type_maintenance}
                  onChange={e => setFormCreer(p => ({ ...p, type_maintenance: e.target.value as TypeMaintenance }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Sélectionner…</option>
                  {TYPES.map(t => (
                    <option key={t} value={t}>{LABELS_TYPE_MAINTENANCE[t]}</option>
                  ))}
                </select>
                {intervalleLabel && (
                  <p className="mt-1 text-xs text-slate-500">{intervalleLabel}</p>
                )}
              </div>

              {/* Date planifiée + KM planifié */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date planifiée</label>
                  <input type="date" value={formCreer.date_planifiee}
                    onChange={e => setFormCreer(p => ({ ...p, date_planifiee: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">KM planifié</label>
                  <input type="number" value={formCreer.kilometrage_planifie}
                    onChange={e => setFormCreer(p => ({ ...p, kilometrage_planifie: e.target.value }))}
                    placeholder="Ex : 75000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Garage */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Garage</label>
                <input type="text" value={formCreer.garage}
                  onChange={e => setFormCreer(p => ({ ...p, garage: e.target.value }))}
                  placeholder="Nom du garage…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea rows={2} value={formCreer.description}
                  onChange={e => setFormCreer(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {/* ── MODE TERMINER ── */}
          {mode === 'terminer' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date réalisée</label>
                  <input type="date" value={formTerminer.date_realisee}
                    onChange={e => setFormTerminer(p => ({ ...p, date_realisee: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">KM réalisé</label>
                  <input type="number" value={formTerminer.kilometrage_realise}
                    onChange={e => setFormTerminer(p => ({ ...p, kilometrage_realise: e.target.value }))}
                    placeholder="KM compteur"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Coût réel (MGA)</label>
                <input type="number" min="0" value={formTerminer.cout}
                  onChange={e => setFormTerminer(p => ({ ...p, cout: e.target.value }))}
                  placeholder="Ex : 450000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Pièces changées (tags) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pièces changées</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={pieceInput}
                    onChange={e => setPieceInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouterPiece() } }}
                    placeholder="Ajouter une pièce…"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={ajouterPiece}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors">
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {formTerminer.pieces_changees.map((p, i) => (
                    <span key={i} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      {p}
                      <button type="button" onClick={() => supprimerPiece(i)} className="text-blue-400 hover:text-blue-700">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Prochaine maintenance */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={formTerminer.planifier_prochaine}
                    onChange={e => setFormTerminer(p => ({ ...p, planifier_prochaine: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600" />
                  Planifier automatiquement la prochaine maintenance
                </label>
                {formTerminer.planifier_prochaine && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Prochaine révision (km)</label>
                      <input type="number" value={formTerminer.prochaine_maintenance_km}
                        onChange={e => setFormTerminer(p => ({ ...p, prochaine_maintenance_km: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Date prévue</label>
                      <input type="date" value={formTerminer.prochaine_maintenance_date}
                        onChange={e => setFormTerminer(p => ({ ...p, prochaine_maintenance_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60">
              {isSubmitting ? 'Enregistrement…' : mode === 'creer' ? 'Planifier' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
