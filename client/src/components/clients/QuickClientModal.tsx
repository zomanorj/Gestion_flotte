// client/src/components/clients/QuickClientModal.tsx

import { useState } from 'react'
import { createClient } from '../../services/clientService'
import type { Client } from '../../types/client'

interface QuickClientModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (client: Client) => void
}

export default function QuickClientModal({ isOpen, onClose, onCreated }: QuickClientModalProps) {
  const [formData, setFormData] = useState<{ type_client: 'entreprise' | 'particulier' | 'administration'; nom: string; telephone: string; ville: string }>({
    type_client: 'entreprise',
    nom: '',
    telephone: '',
    ville: ''
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    
    try {
      const newClient = await createClient(formData)
      onCreated(newClient)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined
      setError(msg || 'Erreur lors de la création du client')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Nouveau Client</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200 text-sm flex gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form id="quick-client-form" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type de client *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'entreprise', icon: '🏢', label: 'Entreprise' },
                  { id: 'particulier', icon: '👤', label: 'Particulier' },
                  { id: 'administration', icon: '🏛', label: 'Admin.' }
                ].map(type => (
                  <label
                    key={type.id}
                    className={`
                      cursor-pointer flex flex-col items-center justify-center p-2 rounded-lg border text-sm transition-colors
                      ${formData.type_client === type.id 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="type_client"
                      value={type.id}
                      className="sr-only"
                      checked={formData.type_client === type.id}
                      onChange={(e) => setFormData({ ...formData, type_client: e.target.value as 'entreprise' | 'particulier' | 'administration' })}
                    />
                    <span className="text-lg mb-1">{type.icon}</span>
                    <span className="text-xs">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom / Raison sociale *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder={formData.type_client === 'particulier' ? 'Nom et prénom' : "Nom de l'entreprise"}
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone *</label>
              <input
                type="tel"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                placeholder="+261 34 00 000 00"
              />
            </div>

            {/* Ville */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ville</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                placeholder="Ex: Antananarivo"
              />
            </div>

          </form>
        </div>

        {/* Pied de page */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="quick-client-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? 'Création...' : 'Créer et sélectionner'}
          </button>
        </div>
      </div>
    </div>
  )
}
