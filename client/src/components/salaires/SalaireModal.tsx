/**
 * Modal création / édition d'un enregistrement salaire — TransiFlow.
 * Charge la liste des chauffeurs à l'ouverture et soumet via salaireService.
 */
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import * as salaireService from '../../services/salaireService'
import type { Driver } from '../../types/driver'
import type { Salaire, SalaireFormData } from '../../types/salaire'

interface SalaireModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  salaire?: Salaire
}

const FORM_VIDE: SalaireFormData = {
  driver_id: '',
  type_salaire: 'mission',
  montant: '',
  statut: 'en_attente',
  mois_concerne: '',
  notes: '',
}

/** Extrait un message d'erreur lisible depuis une erreur inconnue */
function messageErreur(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = err as { response?: { data?: { message?: string } } }
    return res.response?.data?.message ?? "Erreur d'enregistrement"
  }
  return "Erreur d'enregistrement"
}

export default function SalaireModal({ isOpen, onClose, onSuccess, salaire }: SalaireModalProps) {
  const isEditing = !!salaire
  const [formData, setFormData] = useState<SalaireFormData>(FORM_VIDE)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      api.get('/api/drivers', { params: { limit: 100 } }).then(res => {
        if (res.data.succes) setDrivers(res.data.donnees)
      }).catch(() => toast.error('Impossible de charger la liste des chauffeurs'))
    }

    if (salaire) {
      setFormData({
        driver_id: salaire.driver_id,
        type_salaire: salaire.type_salaire,
        montant: salaire.montant,
        statut: salaire.statut,
        mois_concerne: salaire.mois_concerne || '',
        notes: salaire.notes || '',
      })
    } else {
      setFormData(FORM_VIDE)
    }
    setError('')
  }, [isOpen, salaire])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      if (isEditing && salaire) {
        await salaireService.updateSalaire(salaire.id, formData as Partial<Salaire>)
      } else {
        await salaireService.createSalaire(formData as Partial<Salaire>)
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = messageErreur(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">{isEditing ? 'Modifier le salaire' : 'Nouveau salaire'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">✕</button>
        </div>

        <div className="p-5 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200 text-sm">{error}</div>
          )}

          <form id="salaire-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Chauffeur *</label>
              <select
                required
                disabled={isEditing}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50"
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: Number(e.target.value) })}
              >
                <option value="">Sélectionner un chauffeur</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={formData.type_salaire}
                  onChange={(e) => setFormData({ ...formData, type_salaire: e.target.value })}
                >
                  <option value="fixe">Fixe mensuel</option>
                  <option value="mission">Prime de mission</option>
                  <option value="bonus">Bonus</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Montant (MGA) *</label>
                <input
                  type="number"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                />
              </div>
            </div>

            {formData.type_salaire === 'fixe' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mois concerné</label>
                <input
                  type="month"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={formData.mois_concerne}
                  onChange={(e) => setFormData({ ...formData, mois_concerne: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </form>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm text-slate-600 rounded-lg">Annuler</button>
          <button type="submit" form="salaire-form" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
