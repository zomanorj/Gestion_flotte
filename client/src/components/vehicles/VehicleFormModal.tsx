/**
 * VehicleFormModal.tsx
 * Modal de formulaire pour créer ou modifier un véhicule — Transport STTA.
 *
 * Ce composant est réutilisable pour les deux modes (création et modification).
 * Il inclut :
 *   - Validation en temps réel avec messages d'erreur
 *   - Layout responsive (2 colonnes sur desktop, 1 sur mobile)
 *   - Overlay sombre avec fermeture au clic ou Escape
 *   - Spinner de chargement sur le bouton d'enregistrement
 *
 * Props :
 *   isOpen      → contrôle la visibilité du modal
 *   onClose     → rappel de fermeture
 *   onSubmit    → rappel de soumission (reçoit les données du formulaire)
 *   initialData → données pré-remplies (mode modification) ou undefined (mode création)
 *   isLoading   → état de chargement pour le bouton
 */

import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'

import type { Vehicle, VehicleFormData, VehicleType, VehicleStatut } from '../../services/vehicleService'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VehicleFormModalProps {
  isOpen:      boolean
  onClose:     () => void
  onSubmit:    (data: VehicleFormData) => Promise<void>
  initialData?: Vehicle | null
  isLoading:   boolean
}

interface FormErrors {
  [key: string]: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const TYPES_VEHICULE: { value: VehicleType; label: string }[] = [
  { value: 'camion',   label: 'Camion' },
  { value: 'citerne',  label: 'Citerne' },
  { value: 'pickup',   label: 'Pickup' },
  { value: 'autre',    label: 'Autre' },
]

const STATUTS: { value: VehicleStatut; label: string }[] = [
  { value: 'actif',        label: 'Actif' },
  { value: 'en_revision',  label: 'En révision' },
  { value: 'archive',      label: 'Archivé' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function VehicleFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading,
}: VehicleFormModalProps) {
  // ── État du formulaire ──
  const [formData, setFormData] = useState<VehicleFormData>({
    immatriculation: '',
    type:            'camion',
    capacite:        0,
    statut:          'actif',
    date_assurance:  '',
    kilometrage:     0,
    notes:           '',
  })

  const [errors, setErrors] = useState<FormErrors>({})

  // ── Mode création ou modification ──
  const isEditMode = Boolean(initialData?.id)
  const titre = isEditMode
    ? `Modifier le véhicule ${initialData?.immatriculation}`
    : 'Ajouter un véhicule'

  // ── Initialiser le formulaire quand initialData change ──
  useEffect(() => {
    if (initialData) {
      setFormData({
        immatriculation:       initialData.immatriculation,
        type:                  initialData.type,
        capacite:              initialData.capacite,
        statut:                initialData.statut,
        date_assurance:        initialData.date_assurance || '',
        date_visite_technique: initialData.date_visite_technique || '',
        kilometrage:           initialData.kilometrage,
        notes:                 initialData.notes || '',
      })
    } else {
      // Reset pour le mode création
      setFormData({
        immatriculation: '',
        type:            'camion',
        capacite:        0,
        statut:          'actif',
        date_assurance:  '',
        date_visite_technique: '',
        kilometrage:     0,
        notes:           '',
      })
    }
    setErrors({})
  }, [initialData, isOpen])

  // ── Gestion de la touche Escape pour fermer ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden' // Empêcher le scroll
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // ── Handlers ──

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target

    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacite' || name === 'kilometrage'
        ? (value === '' ? 0 : parseFloat(value))
        : value,
    }))

    // Supprimer l'erreur sur ce champ
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    // Immatriculation obligatoire
    if (!formData.immatriculation || !formData.immatriculation.trim()) {
      newErrors.immatriculation = "L'immatriculation est obligatoire"
    }

    // Type obligatoire (déjà sélectionné par défaut)
    if (!formData.type) {
      newErrors.type = 'Le type est obligatoire'
    }

    // Capacité obligatoire et > 0
    if (!formData.capacite || formData.capacite <= 0) {
      newErrors.capacite = 'La capacité doit être supérieure à 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    try {
      await onSubmit(formData)
      onClose()
    } catch (err) {
      console.error('Erreur lors de la soumission', err)
      // L'erreur sera gérée par le toast dans le composant parent
    }
  }

  // ── Ne pas rendre si fermé ──
  if (!isOpen) return null

  // ── Rendu ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay sombre semi-transparent */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 id="modal-title" className="text-lg font-semibold text-slate-800">
            {titre}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ── Colonne gauche ── */}
            <div className="space-y-4">
              {/* Immatriculation */}
              <div>
                <label htmlFor="immatriculation" className="block text-sm font-medium text-slate-700 mb-1">
                  Immatriculation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="immatriculation"
                  name="immatriculation"
                  value={formData.immatriculation}
                  onChange={handleChange}
                  placeholder="Ex: MG-1234-TA"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    errors.immatriculation
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-300'
                  }`}
                />
                {errors.immatriculation && (
                  <p className="mt-1 text-sm text-red-500">{errors.immatriculation}</p>
                )}
              </div>

              {/* Type */}
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    errors.type
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-300'
                  }`}
                >
                  {TYPES_VEHICULE.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.type && (
                  <p className="mt-1 text-sm text-red-500">{errors.type}</p>
                )}
              </div>

              {/* Capacité */}
              <div>
                <label htmlFor="capacite" className="block text-sm font-medium text-slate-700 mb-1">
                  Capacité (tonnes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="capacite"
                  name="capacite"
                  value={formData.capacite || ''}
                  onChange={handleChange}
                  min="0.1"
                  step="0.1"
                  placeholder="Ex: 10"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    errors.capacite
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-300'
                  }`}
                />
                {errors.capacite && (
                  <p className="mt-1 text-sm text-red-500">{errors.capacite}</p>
                )}
              </div>

              {/* Kilométrage */}
              <div>
                <label htmlFor="kilometrage" className="block text-sm font-medium text-slate-700 mb-1">
                  Kilométrage
                </label>
                <input
                  type="number"
                  id="kilometrage"
                  name="kilometrage"
                  value={formData.kilometrage || ''}
                  onChange={handleChange}
                  min="0"
                  step="1"
                  placeholder="Ex: 150000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* ── Colonne droite ── */}
            <div className="space-y-4">
              {/* Statut */}
              <div>
                <label htmlFor="statut" className="block text-sm font-medium text-slate-700 mb-1">
                  Statut <span className="text-red-500">*</span>
                </label>
                <select
                  id="statut"
                  name="statut"
                  value={formData.statut}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {STATUTS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Date assurance */}
              <div>
                <label htmlFor="date_assurance" className="block text-sm font-medium text-slate-700 mb-1">
                  Date d'assurance
                </label>
                <input
                  type="date"
                  id="date_assurance"
                  name="date_assurance"
                  value={formData.date_assurance || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Date visite technique */}
              <div>
                <label htmlFor="date_visite_technique" className="block text-sm font-medium text-slate-700 mb-1">
                  Date visite technique
                </label>
                <input
                  type="date"
                  id="date_visite_technique"
                  name="date_visite_technique"
                  value={formData.date_visite_technique || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Notes optionnelles sur le véhicule..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isEditMode ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}