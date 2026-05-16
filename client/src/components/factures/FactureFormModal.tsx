/**
 * FactureFormModal.tsx
 * Modal de création/modification d'une facture — TransiFlow.
 *
 * Fonctionnalités :
 *   - Select client → charge les missions du client
 *   - Select mission → pré-remplit description + montant HT (3 000 MGA/km)
 *   - Calcul TTC en temps réel
 *   - Mode paiement intégré (legacy — remplacé par PaiementModal dans FacturesPage)
 */

import { useState, useEffect } from 'react'
import { createFacture, updateFacture, marquerFacturePayee } from '../../services/factureService'
import { getClients, getClientMissions } from '../../services/clientService'
import type { Facture, Client } from '../../types/client'
import { formatMGA } from '../../utils/format'

// ─────────────────────────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────────────────────────

/** Sous-ensemble de mission nécessaire pour le select */
interface MissionOption {
  id:           number
  lieu_depart:  string
  lieu_arrivee: string
  date_mission: string
  statut:       string
  distance_km?: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────────────────────

/** Formate une date ISO en jj/mm/aaaa */
function formatDateCourte(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}

// Statuts de mission affichables dans le select (brouillon et annulee exclus)
const STATUTS_VALIDES: string[] = ['planifiee', 'en_cours', 'terminee']

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface FactureFormModalProps {
  isOpen:    boolean
  onClose:   () => void
  onSuccess: () => void
  facture?:  Facture
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export default function FactureFormModal({
  isOpen, onClose, onSuccess, facture,
}: FactureFormModalProps) {
  const isEditing = !!facture

  // ── État du formulaire ──
  const [formData, setFormData] = useState<Partial<Facture>>({
    client_id:           undefined,
    mission_id:          undefined,
    montant_ht:          0,
    taux_tva:            20,
    description:         '',
    conditions_paiement: 'Paiement à 30 jours',
    mode_paiement:       '',
    date_echeance:       '',
  })

  // ── Données de référence ──
  const [clients,        setClients]        = useState<Client[]>([])
  const [missions,       setMissions]       = useState<MissionOption[]>([])
  const [loadingMissions, setLoadingMissions] = useState(false)

  // ── Soumission ──
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState('')

  // ── Mode paiement (héritage) ──
  const [showPaiementMode,  setShowPaiementMode]  = useState(false)
  const [paymentData,       setPaymentData]       = useState({
    mode_paiement: 'virement',
    date_paiement: new Date().toISOString().split('T')[0],
  })

  // ── Chargement initial ──
  useEffect(() => {
    if (!isOpen) return

    // Charger la liste des clients actifs
    getClients({ statut: 'actif', limit: 100 })
      .then(res => { if (res.succes) setClients(res.donnees) })
      .catch(() => {})

    // Pré-remplir si édition
    if (facture) {
      setFormData({
        client_id:           facture.client_id,
        mission_id:          facture.mission_id,
        montant_ht:          facture.montant_ht,
        taux_tva:            facture.taux_tva,
        description:         facture.description         || '',
        conditions_paiement: facture.conditions_paiement || '',
        mode_paiement:       facture.mode_paiement       || '',
        date_echeance:       facture.date_echeance
          ? facture.date_echeance.split('T')[0] : '',
      })
      // (Les missions seront chargées via le useEffect séparé sur formData.client_id)
    } else {
      // Date d'échéance par défaut : aujourd'hui + 30 jours
      const echeance = new Date()
      echeance.setDate(echeance.getDate() + 30)
      setFormData(prev => ({
        ...prev,
        date_echeance: echeance.toISOString().split('T')[0],
      }))
    }

    setError('')
    setShowPaiementMode(false)
  }, [isOpen, facture])

  // ── Charger les missions d'un client automatiquement ──
  useEffect(() => {
    if (!formData.client_id) {
      setMissions([])
      return
    }
    setLoadingMissions(true)
    getClientMissions(formData.client_id)
      .then(res => {
        if (res.succes) {
          const liste = (res.donnees as MissionOption[]) || []
          const filtrees = liste.filter(m => STATUTS_VALIDES.includes(m.statut))
          setMissions(filtrees)
        } else {
          setMissions([])
        }
      })
      .catch(err => {
        console.error('Erreur chargement missions:', err)
        setMissions([])
      })
      .finally(() => setLoadingMissions(false))
  }, [formData.client_id])

  // ── Changement du client ──
  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value ? Number(e.target.value) : undefined
    // Réinitialiser mission et description quand le client change
    setFormData(prev => ({
      ...prev,
      client_id:   cid,
      mission_id:  undefined,
      description: '',
    }))
  }

  // ── Sélection d'une mission → pré-remplissage ──
  const handleMissionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mid = e.target.value ? Number(e.target.value) : undefined
    if (!mid) {
      setFormData(prev => ({ ...prev, mission_id: undefined }))
      return
    }
    const mission = missions.find(m => m.id === mid)
    if (!mission) return

    // Description automatique (sans caractère → pour compatibilité PDF)
    const description = `Transport ${mission.lieu_depart} - ${mission.lieu_arrivee} le ${formatDateCourte(mission.date_mission)}`

    // Montant HT = distance × 3 000 MGA/km (modifiable par l'utilisateur)
    const montantHT = mission.distance_km
      ? Math.round(mission.distance_km * 3000)
      : formData.montant_ht

    setFormData(prev => ({
      ...prev,
      mission_id:  mid,
      description,
      montant_ht:  montantHT || prev.montant_ht,
    }))
  }

  // ── Changement générique ──
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: ['montant_ht', 'taux_tva'].includes(name) ? Number(value) : value,
    }))
  }

  // ── Soumission du formulaire ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      if (isEditing && facture?.id) {
        await updateFacture(facture.id, formData)
      } else {
        await createFacture(formData)
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Erreur lors de l'enregistrement"
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Paiement intégral (mode héritage) ──
  const handlePayer = async () => {
    if (!facture?.id || isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      await marquerFacturePayee(facture.id, paymentData)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors du paiement'
      setError(msg)
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Calcul TTC en temps réel
  const ht          = formData.montant_ht  || 0
  const tva         = formData.taux_tva    || 20
  const montantTva  = ht * (tva / 100)
  const ttc         = ht + montantTva

  // ─────────────────────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── En-tête ── */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">
            {isEditing
              ? (showPaiementMode ? 'Enregistrer un paiement' : `Facture ${facture?.numero}`)
              : 'Nouvelle facture'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Corps ── */}
        <div className="p-6 overflow-y-auto flex-1">

          {/* Message d'erreur */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* ── Mode paiement intégral (héritage) ── */}
          {showPaiementMode ? (
            <div className="space-y-5">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-blue-800 font-medium text-sm">Montant à régler</span>
                  <span className="text-xl font-bold text-blue-900">
                    {formatMGA(facture?.montant_ttc || 0)}
                  </span>
                </div>
                <p className="text-xs text-blue-600">Facture {facture?.numero}</p>
              </div>

              {/* Mode de paiement */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mode de paiement <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  value={paymentData.mode_paiement}
                  onChange={e => setPaymentData({ ...paymentData, mode_paiement: e.target.value })}
                >
                  <option value="virement">Virement bancaire</option>
                  <option value="mvola">MVola</option>
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                </select>
              </div>

              {/* Date de paiement */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date du paiement <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  value={paymentData.date_paiement}
                  onChange={e => setPaymentData({ ...paymentData, date_paiement: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaiementMode(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handlePayer}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement…' : 'Confirmer le paiement'}
                </button>
              </div>
            </div>

          ) : (

            // ── Formulaire de création/modification ──
            <form id="facture-form" onSubmit={handleSubmit} className="space-y-5">

              {/* Section : Client + Mission */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">
                  Informations générales
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Sélecteur client */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Client <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.client_id || ''}
                      onChange={handleClientChange}
                      required
                      disabled={isEditing}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">Sélectionner un client…</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sélecteur mission */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Mission associée
                      {loadingMissions && (
                        <span className="ml-2 text-xs text-slate-400 font-normal">chargement…</span>
                      )}
                    </label>
                    <select
                      value={formData.mission_id || ''}
                      onChange={handleMissionChange}
                      disabled={!formData.client_id || loadingMissions || isEditing}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">
                        {loadingMissions
                          ? 'Chargement...'
                          : !formData.client_id
                            ? "Sélectionnez d'abord un client"
                            : missions.length === 0
                              ? 'Aucune mission disponible'
                              : 'Aucune mission liée (optionnel)'}
                      </option>
                      {missions.map(m => (
                        <option key={m.id} value={m.id}>
                          #{String(m.id).padStart(4, '0')} &middot; {m.lieu_depart} - {m.lieu_arrivee} &middot; {formatDateCourte(m.date_mission)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section : Montants */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">
                  Montants
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Montant HT */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Montant HT (MGA) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="montant_ht"
                      required
                      min="0"
                      value={formData.montant_ht || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm transition-colors"
                      placeholder="Ex : 300 000"
                    />
                    {/* Indication du tarif si la mission a une distance */}
                    {formData.mission_id && formData.montant_ht ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Calculé à 3 000 MGA/km — modifiable
                      </p>
                    ) : null}
                  </div>

                  {/* Taux TVA */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Taux TVA (%)</label>
                    <select
                      name="taux_tva"
                      value={formData.taux_tva}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    >
                      <option value={20}>20 %</option>
                      <option value={0}>0 % (exonéré)</option>
                    </select>
                  </div>
                </div>

                {/* Récapitulatif TTC */}
                <div className="mt-3 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 flex justify-between items-center">
                  <span className="text-sm text-slate-500">TVA : {formatMGA(montantTva)}</span>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total TTC</p>
                    <p className="text-2xl font-bold text-blue-600">{formatMGA(ttc)}</p>
                  </div>
                </div>
              </div>

              {/* Section : Détails prestation */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">
                  Détails de la prestation
                </h3>

                {/* Description (pré-remplie depuis la mission) */}
                <textarea
                  name="description"
                  rows={2}
                  value={formData.description || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none mb-3 transition-colors"
                  placeholder="Ex : Transport de marchandises Antananarivo - Toamasina…"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date d'échéance */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date d'échéance</label>
                    <input
                      type="date"
                      name="date_echeance"
                      value={formData.date_echeance || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm transition-colors"
                    />
                  </div>
                  {/* Conditions de paiement */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Conditions de paiement</label>
                    <input
                      type="text"
                      name="conditions_paiement"
                      value={formData.conditions_paiement || ''}
                      onChange={handleChange}
                      placeholder="Paiement à 30 jours"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm transition-colors"
                    />
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* ── Pied de page ── */}
        {!showPaiementMode && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
            {/* Bouton "Marquer payée" en mode édition */}
            {isEditing && facture?.statut !== 'payee' && facture?.statut !== 'annulee' ? (
              <button
                type="button"
                onClick={() => setShowPaiementMode(true)}
                className="px-4 py-2 bg-emerald-50 text-emerald-700 font-medium text-sm hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Marquer payée
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              {(!isEditing || facture?.statut === 'brouillon') && (
                <button
                  type="submit"
                  form="facture-form"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enregistrement…
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
