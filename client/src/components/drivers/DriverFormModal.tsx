/**
 * DriverFormModal.tsx
 * Modal de formulaire pour créer ou modifier un chauffeur — TransiFlow.
 *
 * Ce composant est réutilisable pour les deux modes (création et modification).
 * Il inclut :
 *   - Validation en temps réel avec messages d'erreur
 *   - Layout responsive (2 colonnes sur desktop, 1 sur mobile)
 *   - Overlay sombre avec fermeture au clic ou Escape
 *   - Spinner de chargement sur le bouton d'enregistrement
 *   - Preview de l'avatar avec initiales
 *
 * Props :
 *   isOpen      → contrôle la visibilité du modal
 *   onClose     → rappel de fermeture
 *   onSubmit    → rappel de soumission (reçoit les données du formulaire)
 *   initialData → données pré-remplies (mode modification) ou undefined (mode création)
 *   isLoading   → état de chargement pour le bouton
 */

import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'

import type { Driver, DriverFormData, DriverStatut } from '../../types/driver'
import { getInitials, getAvatarColor } from '../../utils/avatarColor'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DriverFormModalProps {
  isOpen:      boolean
  onClose:     () => void
  onSubmit:    (data: DriverFormData) => Promise<void>
  initialData?: Driver | null
  isLoading:   boolean
}

interface FormErrors {
  [key: string]: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const STATUTS: { value: DriverStatut; label: string }[] = [
  { value: 'actif',     label: 'Actif' },
  { value: 'en_conge',  label: 'En congé' },
  { value: 'inactif',   label: 'Inactif' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading,
}: DriverFormModalProps) {
  // ── État du formulaire ──
  const [formData, setFormData] = useState<DriverFormData>({
    nom:                    '',
    prenom:                 '',
    telephone:              '',
    numero_permis:          '',
    date_expiration_permis: '',
    statut:                 'actif',
    date_embauche:          '',
    notes:                  '',
  })

  const [errors, setErrors] = useState<FormErrors>({})

  // ── Mode création ou modification ──
  const isEditMode = Boolean(initialData?.id)
  const titre = isEditMode
    ? `Modifier — ${initialData?.prenom} ${initialData?.nom?.toUpperCase()}`
    : 'Ajouter un chauffeur'

  // ── Initialiser le formulaire quand initialData change ──
  useEffect(() => {
    if (initialData) {
      setFormData({
        nom:                    initialData.nom,
        prenom:                 initialData.prenom,
        telephone:              initialData.telephone || '',
        numero_permis:          initialData.numero_permis,
        date_expiration_permis: initialData.date_expiration_permis,
        statut:                 initialData.statut,
        date_embauche:          initialData.date_embauche || '',
        notes:                  initialData.notes || '',
      })
    } else {
      // Reset pour le mode création
      setFormData({
        nom:                    '',
        prenom:                 '',
        telephone:              '',
        numero_permis:          '',
        date_expiration_permis: '',
        statut:                 'actif',
        date_embauche:          '',
        notes:                  '',
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
      [name]: value,
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

    // Nom obligatoire
    if (!formData.nom || !formData.nom.trim()) {
      newErrors.nom = 'Le nom est obligatoire'
    }

    // Prénom obligatoire
    if (!formData.prenom || !formData.prenom.trim()) {
      newErrors.prenom = 'Le prénom est obligatoire'
    }

    // Numéro de permis obligatoire
    if (!formData.numero_permis || !formData.numero_permis.trim()) {
      newErrors.numero_permis = 'Le numéro de permis est obligatoire'
    }

    // Date d'expiration du permis obligatoire
    if (!formData.date_expiration_permis) {
      newErrors.date_expiration_permis = 'La date d\'expiration du permis est obligatoire'
    } else if (!isEditMode && new Date(formData.date_expiration_permis) <= new Date()) {
      newErrors.date_expiration_permis = 'La date doit être dans le futur'
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

  // ── Calcul de l'avatar preview ──
  const { bg: avatarBg, text: avatarText } = getAvatarColor(
    `${formData.prenom} ${formData.nom}`
  )
  const initials = getInitials(formData.prenom, formData.nom)

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
            {/* ── Avatar Preview (pleine largeur en haut) ── */}
            <div className="md:col-span-2 flex items-center justify-center py-4">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${avatarBg} ${avatarText}`}
              >
                {initials || '??'}
              </div>
            </div>

            {/* ── Colonne gauche ── */}
            <div className="space-y-4">
              {/* Prénom */}
              <div>
                <label htmlFor="prenom" className="block text-sm font-medium text-slate-700 mb-1">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="prenom"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleChange}
                  placeholder="Ex: Jean"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    errors.prenom
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-300'
                  }`}
                />
                {errors.prenom && (
                  <p className="mt-1 text-sm text-red-500">{errors.prenom}</p>
                )}
              </div>

              {/* Nom */}
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-slate-700 mb-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nom"
                  name="nom"
                  value={formData.nom}
                  onChange={handleChange}
                  placeholder="Ex: Dupont"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    errors.nom
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-300'
                  }`}
                />
                {errors.nom && (
                  <p className="mt-1 text-sm text-red-500">{errors.nom}</p>
                )}
              </div>

              {/* Téléphone */}
              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-slate-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  id="telephone"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  placeholder="Ex: 034 12 345 67"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

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
            </div>

            {/* ── Colonne droite ── */}
            <div className="space-y-4">
              {/* Numéro de permis */}
              <div>
                <label htmlFor="numero_permis" className="block text-sm font-medium text-slate-700 mb-1">
                  Numéro de permis <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="numero_permis"
                  name="numero_permis"
                  value={formData.numero_permis}
                  onChange={handleChange}
                  placeholder="Ex: 123456789012"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    errors.numero_permis
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-300'
                  }`}
                />
                {errors.numero_permis && (
                  <p className="mt-1 text-sm text-red-500">{errors.numero_permis}</p>
                )}
              </div>

              {/* Date d'expiration du permis */}
              <div>
                <label htmlFor="date_expiration_permis" className="block text-sm font-medium text-slate-700 mb-1">
                  Expiration du permis <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date_expiration_permis"
                  name="date_expiration_permis"
                  value={formData.date_expiration_permis}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    errors.date_expiration_permis
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-300'
                  }`}
                />
                {errors.date_expiration_permis && (
                  <p className="mt-1 text-sm text-red-500">{errors.date_expiration_permis}</p>
                )}
              </div>

              {/* Date d'embauche */}
              <div>
                <label htmlFor="date_embauche" className="block text-sm font-medium text-slate-700 mb-1">
                  Date d'embauche
                </label>
                <input
                  type="date"
                  id="date_embauche"
                  name="date_embauche"
                  value={formData.date_embauche || ''}
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
                  placeholder="Notes optionnelles sur le chauffeur..."
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