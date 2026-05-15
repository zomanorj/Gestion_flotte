/**
 * DepenseFormModal.tsx
 * Modal de création/modification d'une dépense — TransiFlow.
 *
 * Si catégorie = carburant, calcul automatique des litres.
 */

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createDepense, updateDepense } from '../../services/financeService'
import type { Depense, CategoriDepense, DepenseFormData } from '../../types/finance'
import type { Vehicle } from '../../services/vehicleService'
import type { Mission }  from '../../types/mission'

// ─────────────────────────────────────────────────────────────────────────────
// Config catégories
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { value: CategoriDepense; label: string; couleur: string }[] = [
  { value: 'carburant',    label: '⛽ Carburant',   couleur: 'text-amber-600'  },
  { value: 'peage',        label: '🛣 Péage',        couleur: 'text-violet-600' },
  { value: 'salaire',      label: '👷 Salaire',      couleur: 'text-emerald-600'},
  { value: 'maintenance',  label: '🔧 Maintenance',  couleur: 'text-red-600'    },
  { value: 'autre',        label: '📦 Autre',        couleur: 'text-slate-600'  },
]

const PRIX_LITRE_DEFAUT = 5500  // MGA/litre — prix moyen en 2025

interface Props {
  isOpen:       boolean
  onClose:      () => void
  onSuccess:    () => void
  initialData?: Depense | null
  vehicles?:    Vehicle[]
  missions?:    Mission[]
  defaultMissionId?: number
  defaultVehicleId?: number
}

const defaultForm: DepenseFormData = {
  mission_id: null, vehicle_id: null,
  categorie: '', montant: '', devise: 'MGA',
  description: '', date_depense: new Date().toISOString().split('T')[0],
}

export default function DepenseFormModal({
  isOpen, onClose, onSuccess, initialData,
  vehicles = [], missions = [],
  defaultMissionId, defaultVehicleId,
}: Props) {
  const [formData, setFormData] = useState<DepenseFormData>(defaultForm)
  const [prixLitre, setPrixLitre] = useState<string>(String(PRIX_LITRE_DEFAUT))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialisation du formulaire
  useEffect(() => {
    if (!isOpen) return
    if (initialData) {
      setFormData({
        mission_id:  initialData.mission_id  ?? null,
        vehicle_id:  initialData.vehicle_id  ?? null,
        categorie:   initialData.categorie,
        montant:     String(initialData.montant),
        devise:      initialData.devise,
        description: initialData.description ?? '',
        date_depense: initialData.date_depense,
      })
    } else {
      setFormData({
        ...defaultForm,
        mission_id:  defaultMissionId  ?? null,
        vehicle_id:  defaultVehicleId  ?? null,
        date_depense: new Date().toISOString().split('T')[0],
      })
    }
    setError(null)
  }, [isOpen, initialData, defaultMissionId, defaultVehicleId])

  // Litres calculés si catégorie carburant
  const litresCalcules = formData.categorie === 'carburant' && formData.montant && prixLitre
    ? Math.round((parseFloat(formData.montant) / parseFloat(prixLitre)) * 10) / 10
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!formData.categorie)  { setError('La catégorie est obligatoire'); return }
    if (!formData.montant || parseFloat(formData.montant) <= 0) {
      setError('Le montant doit être positif'); return
    }

    setIsSubmitting(true)
    try {
      if (initialData?.id) {
        await updateDepense(initialData.id, formData)
        toast.success('Dépense modifiée')
      } else {
        await createDepense(formData)
        toast.success('Dépense enregistrée')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-semibold text-slate-800">
            {initialData ? 'Modifier la dépense' : 'Ajouter une dépense'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Catégorie */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Catégorie <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.categorie}
              onChange={e => setFormData(p => ({ ...p, categorie: e.target.value as CategoriDepense }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Sélectionner une catégorie…</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Montant + Devise */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Montant <span className="text-red-500">*</span>
              </label>
              <input
                type="number" min="1" step="1"
                value={formData.montant}
                onChange={e => setFormData(p => ({ ...p, montant: e.target.value }))}
                placeholder="Ex : 150000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Devise</label>
              <select
                value={formData.devise}
                onChange={e => setFormData(p => ({ ...p, devise: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MGA">MGA</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Calcul litres si carburant */}
          {formData.categorie === 'carburant' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <label className="block text-xs font-medium text-amber-700">
                Prix au litre (MGA)
              </label>
              <input
                type="number" min="1"
                value={prixLitre}
                onChange={e => setPrixLitre(e.target.value)}
                className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
              {litresCalcules !== null && (
                <p className="text-xs text-amber-700 font-medium">
                  ≈ <strong>{litresCalcules}</strong> litres de carburant
                </p>
              )}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={formData.date_depense}
              onChange={e => setFormData(p => ({ ...p, date_depense: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Véhicule lié (optionnel) */}
          {vehicles.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Véhicule lié (optionnel)
              </label>
              <select
                value={formData.vehicle_id ?? ''}
                onChange={e => setFormData(p => ({ ...p, vehicle_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Aucun</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.immatriculation}</option>
                ))}
              </select>
            </div>
          )}

          {/* Mission liée (optionnel) */}
          {missions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Mission liée (optionnel)
              </label>
              <select
                value={formData.mission_id ?? ''}
                onChange={e => setFormData(p => ({ ...p, mission_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Aucune</option>
                {missions.map(m => (
                  <option key={m.id} value={m.id}>
                    #{String(m.id).padStart(4,'0')} — {m.lieu_depart} → {m.lieu_arrivee}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Détails supplémentaires…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60">
              {isSubmitting ? 'Enregistrement…' : (initialData ? 'Modifier' : 'Enregistrer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
