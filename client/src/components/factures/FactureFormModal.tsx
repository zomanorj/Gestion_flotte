// client/src/components/factures/FactureFormModal.tsx

import { useState, useEffect } from 'react'
import { createFacture, updateFacture, marquerFacturePayee } from '../../services/factureService'
import { getClients } from '../../services/clientService'
import { getMissions } from '../../services/missionService'
import type { Facture, Client } from '../../types/client'
import type { Mission } from '../../types/mission'
import { formatMGA } from '../../utils/format'

interface FactureFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  facture?: Facture
}

export default function FactureFormModal({ isOpen, onClose, onSuccess, facture }: FactureFormModalProps) {
  const isEditing = !!facture

  const [formData, setFormData] = useState<Partial<Facture>>({
    client_id: undefined,
    mission_id: undefined,
    montant_ht: 0,
    taux_tva: 20,
    description: '',
    conditions_paiement: 'Paiement à 30 jours',
    mode_paiement: '',
    date_echeance: ''
  })

  const [clients, setClients] = useState<Client[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Pour le paiement
  const [showPaiementMode, setShowPaiementMode] = useState(false)
  const [paymentData, setPaymentData] = useState({
    mode_paiement: 'virement',
    date_paiement: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadClients()
    loadMissions()
    if (facture) {
      setFormData({
        client_id: facture.client_id,
        mission_id: facture.mission_id,
        montant_ht: facture.montant_ht,
        taux_tva: facture.taux_tva,
        description: facture.description || '',
        conditions_paiement: facture.conditions_paiement || '',
        mode_paiement: facture.mode_paiement || '',
        date_echeance: facture.date_echeance ? facture.date_echeance.split('T')[0] : ''
      })
    } else {
      // Date d'échéance par défaut : +30 jours
      const echeance = new Date()
      echeance.setDate(echeance.getDate() + 30)
      setFormData(prev => ({ ...prev, date_echeance: echeance.toISOString().split('T')[0] }))
    }
  }, [facture])

  const loadClients = async () => {
    try {
      const res = await getClients({ statut: 'actif', limit: 100 })
      if (res.succes) setClients(res.donnees)
    } catch (err) {
      console.error(err)
    }
  }

  const loadMissions = async (clientId?: number) => {
    try {
      const params = clientId ? { client_id: clientId, limit: 100 } : { limit: 100 }
      const res = await getMissions(params as Parameters<typeof getMissions>[0])
      if (res.succes) setMissions(res.donnees)
    } catch {
      setMissions([])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'client_id') {
      const cid = value ? Number(value) : undefined
      setFormData({ ...formData, client_id: cid, mission_id: undefined })
      loadMissions(cid)
      return
    }
    if (name === 'mission_id') {
      setFormData({ ...formData, mission_id: value ? Number(value) : undefined })
      return
    }
    setFormData({
      ...formData,
      [name]: ['montant_ht', 'taux_tva'].includes(name) ? Number(value) : value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (isEditing && facture?.id) {
        await updateFacture(facture.id, formData)
      } else {
        await createFacture(formData)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePayer = async () => {
    if (!facture?.id) return
    setError('')
    setIsSubmitting(true)
    try {
      await marquerFacturePayee(facture.id, paymentData)
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du paiement')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Calcul temps réel TTC
  const ht = formData.montant_ht || 0
  const tva = formData.taux_tva || 20
  const montantTva = ht * (tva / 100)
  const ttc = ht + montantTva

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {isEditing ? (showPaiementMode ? 'Enregistrer un paiement' : `Facture ${facture?.numero}`) : 'Nouvelle facture'}
            </h2>
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

          {showPaiementMode ? (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-blue-800 font-medium">Montant à régler</span>
                  <span className="text-xl font-bold text-blue-900">{formatMGA(facture?.montant_ttc || 0)}</span>
                </div>
                <div className="text-sm text-blue-600">Facture {facture?.numero}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mode de paiement *</label>
                <select
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  value={paymentData.mode_paiement}
                  onChange={(e) => setPaymentData({ ...paymentData, mode_paiement: e.target.value })}
                >
                  <option value="virement">Virement bancaire</option>
                  <option value="cheque">Chèque</option>
                  <option value="especes">Espèces</option>
                  <option value="mvola">MVola</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date du paiement *</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={paymentData.date_paiement}
                  onChange={(e) => setPaymentData({ ...paymentData, date_paiement: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaiementMode(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={handlePayer}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  Confirmer le paiement
                </button>
              </div>
            </div>
          ) : (
            <form id="facture-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Informations Générales */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Informations Générales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
                    <select
                      name="client_id"
                      required
                      value={formData.client_id || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      disabled={isEditing}
                    >
                      <option value="">Sélectionner un client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mission associée</label>
                    <select
                      name="mission_id"
                      value={formData.mission_id ?? ''}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      disabled={isEditing}
                    >
                      <option value="">Aucune mission</option>
                      {missions.map(m => (
                        <option key={m.id} value={m.id}>
                          #{String(m.id).padStart(4, '0')} — {m.lieu_depart} → {m.lieu_arrivee} ({m.date_mission})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Montants */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Montants</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Montant HT (MGA) *</label>
                    <input
                      type="number"
                      name="montant_ht"
                      required
                      min="0"
                      value={formData.montant_ht || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Taux TVA (%)</label>
                    <select
                      name="taux_tva"
                      value={formData.taux_tva}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value={20}>20%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="text-sm text-slate-500">TVA: {formatMGA(montantTva)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase">Total TTC</div>
                    <div className="text-2xl font-bold text-blue-600">{formatMGA(ttc)}</div>
                  </div>
                </div>
              </div>

              {/* Détails */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Détails de la prestation</h3>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none mb-4"
                  placeholder="Transport de marchandises Antananarivo - Toamasina..."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date d'échéance</label>
                    <input
                      type="date"
                      name="date_echeance"
                      value={formData.date_echeance || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Conditions de paiement</label>
                    <input
                      type="text"
                      name="conditions_paiement"
                      value={formData.conditions_paiement || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Ex: Paiement à 30 jours"
                    />
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!showPaiementMode && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
            {isEditing && facture?.statut !== 'payee' && facture?.statut !== 'annulee' ? (
              <button
                type="button"
                onClick={() => setShowPaiementMode(true)}
                className="px-4 py-2 bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Marquer payée
              </button>
            ) : (
              <div></div> // Spacer
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              {(!isEditing || facture?.statut === 'brouillon') && (
                <button
                  type="submit"
                  form="facture-form"
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
                    isEditing ? 'Mettre à jour' : 'Créer la facture'
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
