// client/src/components/clients/ClientFormModal.tsx

import { useState, useEffect } from 'react'
import { createClient, updateClient } from '../../services/clientService'
import type { Client } from '../../types/client'

interface ClientFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  client?: Client
}

export default function ClientFormModal({ isOpen, onClose, onSuccess, client }: ClientFormModalProps) {
  const isEditing = !!client

  const [formData, setFormData] = useState<Partial<Client>>({
    type_client: 'entreprise',
    nom: '',
    nom_contact: '',
    telephone: '',
    telephone2: '',
    email: '',
    adresse: '',
    ville: '',
    nif: '',
    stat: '',
    notes: '',
    statut: 'actif'
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (client) {
      setFormData(client)
    }
  }, [client])

  if (!isOpen) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (isEditing && client?.id) {
        await updateClient(client.id, formData)
      } else {
        await createClient(formData)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || "Une erreur est survenue lors de l'enregistrement")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {isEditing ? 'Modifier le client' : 'Nouveau client'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isEditing ? 'Modifiez les informations de ce client' : 'Ajoutez un nouveau client à votre base'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200 flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form id="client-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Type Client */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type de client *</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'entreprise', label: 'Entreprise', icon: '🏢' },
                  { value: 'particulier', label: 'Particulier', icon: '👤' },
                  { value: 'administration', label: 'Administration', icon: '🏛️' }
                ].map(type => (
                  <label
                    key={type.value}
                    className={`
                      flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
                      ${formData.type_client === type.value 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' 
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-600'}
                    `}
                  >
                    <input
                      type="radio"
                      name="type_client"
                      value={type.value}
                      checked={formData.type_client === type.value}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span className="text-lg">{type.icon}</span>
                    <span className="font-medium text-sm">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Colonne Gauche */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom / Raison sociale *</label>
                  <input
                    type="text"
                    name="nom"
                    required
                    value={formData.nom || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Ex: Entreprise SA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom du contact</label>
                  <input
                    type="text"
                    name="nom_contact"
                    value={formData.nom_contact || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Ex: Jean Rakoto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone principal *</label>
                  <input
                    type="tel"
                    name="telephone"
                    required
                    value={formData.telephone || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Ex: 034 00 000 00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone secondaire</label>
                  <input
                    type="tel"
                    name="telephone2"
                    value={formData.telephone2 || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Ex: 032 00 000 00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="contact@entreprise.com"
                  />
                </div>
              </div>

              {/* Colonne Droite */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ville</label>
                  <input
                    type="text"
                    name="ville"
                    value={formData.ville || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Ex: Antananarivo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adresse complète</label>
                  <textarea
                    name="adresse"
                    value={formData.adresse || ''}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                    placeholder="Ex: Lot 123, Quartier..."
                  />
                </div>
                
                {formData.type_client === 'entreprise' && (
                  <>
                    <div className="pt-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">NIF</label>
                      <input
                        type="text"
                        name="nif"
                        value={formData.nif || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Numéro d'Identification Fiscale"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">STAT</label>
                      <input
                        type="text"
                        name="stat"
                        value={formData.stat || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Numéro Statistique"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pleine largeur */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes internes</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                placeholder="Informations supplémentaires..."
              />
            </div>

            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
                <select
                  name="statut"
                  value={formData.statut}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="client-form"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enregistrement...
              </>
            ) : (
              'Enregistrer le client'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
