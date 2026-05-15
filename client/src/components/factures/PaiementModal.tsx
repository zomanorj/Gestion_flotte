/**
 * PaiementModal.tsx
 * Modal d'enregistrement de paiements progressifs — TransiFlow.
 *
 * Fonctionnalités :
 *   - Affiche l'historique des paiements déjà enregistrés
 *   - Formulaire de saisie du nouveau paiement
 *   - Boutons radio visuels pour le mode de paiement
 *   - Référence obligatoire si MVola ou Virement
 *   - Bouton "Tout payer" remplit le montant max
 *   - Mise à jour automatique du statut facture (partiel → payee)
 */

import { useState, useEffect } from 'react'
import { getPaiements, addPaiement } from '../../services/factureService'
import type { PaiementsResponse, Paiement } from '../../types/client'
import { formatMGA } from '../../utils/format'

// ─────────────────────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────────────────────

type ModePaiement = 'mvola' | 'virement' | 'especes' | 'cheque'

interface PaiementFormData {
  montant:       string
  mode_paiement: ModePaiement
  reference:     string
  date_paiement: string
  notes:         string
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PaiementModalProps {
  isOpen:    boolean
  onClose:   () => void
  onSuccess: () => void
  factureId: number
  factureNumero: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration des modes de paiement
// ─────────────────────────────────────────────────────────────────────────────

const MODES: { value: ModePaiement; label: string; emoji: string; placeholder: string }[] = [
  { value: 'mvola',    label: 'MVola',    emoji: '📱', placeholder: 'MV-XXXXXXXXXX' },
  { value: 'virement', label: 'Virement', emoji: '🏦', placeholder: 'VIR-XXXXXXXXXX' },
  { value: 'especes',  label: 'Espèces',  emoji: '💵', placeholder: '' },
  { value: 'cheque',   label: 'Chèque',   emoji: '📄', placeholder: 'N° chèque' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export default function PaiementModal({
  isOpen, onClose, onSuccess, factureId, factureNumero,
}: PaiementModalProps) {
  // ── Données chargées ──
  const [solde,   setSolde]   = useState<PaiementsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Formulaire ──
  const [form, setForm] = useState<PaiementFormData>({
    montant:       '',
    mode_paiement: 'mvola',
    reference:     '',
    date_paiement: new Date().toISOString().split('T')[0],
    notes:         '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState('')

  // ── Chargement des paiements existants ──
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError('')
    getPaiements(factureId)
      .then(setSolde)
      .catch(() => setError('Impossible de charger les paiements'))
      .finally(() => setLoading(false))
  }, [isOpen, factureId])

  // ── Référence obligatoire pour MVola et Virement ──
  const refObligatoire = ['mvola', 'virement'].includes(form.mode_paiement)

  // ── Placeholder dynamique selon le mode ──
  const placeholderRef = MODES.find(m => m.value === form.mode_paiement)?.placeholder || ''

  // ── Tout payer ──
  const handleToutPayer = () => {
    if (!solde) return
    setForm(prev => ({
      ...prev,
      montant: String(Math.round(solde.solde_restant)),
    }))
  }

  // ── Soumission ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !solde) return

    const montantNum = parseFloat(form.montant)
    if (!form.montant || isNaN(montantNum) || montantNum <= 0) {
      setError('Le montant doit être supérieur à 0')
      return
    }
    if (montantNum > solde.solde_restant + 0.01) {
      setError(`Le montant dépasse le solde restant (${formatMGA(solde.solde_restant)})`)
      return
    }
    if (refObligatoire && !form.reference.trim()) {
      setError(`La référence est obligatoire pour un paiement par ${form.mode_paiement}`)
      return
    }

    setError('')
    setIsSubmitting(true)
    try {
      await addPaiement(factureId, {
        montant:       montantNum,
        mode_paiement: form.mode_paiement,
        date_paiement: form.date_paiement,
        reference:     form.reference.trim() || undefined,
        notes:         form.notes.trim()     || undefined,
      })
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

  if (!isOpen) return null

  // ─────────────────────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── En-tête ── */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Enregistrer un paiement</h2>
            <p className="text-sm text-slate-500">Facture {factureNumero}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Corps ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* ── Historique des paiements ── */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Paiements effectués
              </h3>
            </div>

            {loading ? (
              <div className="px-4 py-4 text-sm text-slate-400 animate-pulse">Chargement…</div>
            ) : !solde || solde.paiements.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">Aucun paiement enregistré</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {solde.paiements.map((p: Paiement) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm text-slate-700">
                        {new Date(p.date_paiement).toLocaleDateString('fr-FR')}
                        {' · '}
                        <span className="capitalize">{p.mode_paiement}</span>
                        {p.reference && (
                          <span className="text-slate-400 ml-1">· réf : {p.reference}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">
                      {formatMGA(p.montant)} ✓
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Récapitulatif solde */}
            {solde && (
              <div className="border-t border-slate-200 divide-y divide-slate-100 bg-white">
                <div className="flex justify-between px-4 py-2 text-sm">
                  <span className="text-slate-500">Total payé</span>
                  <span className="font-medium text-slate-700">{formatMGA(solde.montant_paye)}</span>
                </div>
                <div className="flex justify-between px-4 py-2 text-sm font-semibold">
                  <span className="text-slate-700">Solde restant</span>
                  <span className={solde.solde_restant <= 0 ? 'text-emerald-600' : 'text-orange-600'}>
                    {formatMGA(solde.solde_restant)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Si facture déjà intégralement payée ── */}
          {solde && solde.solde_restant <= 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
              <p className="text-emerald-700 font-medium text-sm">✓ Cette facture est intégralement payée</p>
            </div>
          ) : (

            // ── Formulaire de saisie ──
            <form id="paiement-form" onSubmit={handleSubmit} className="space-y-4">

              {/* Erreur */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-start gap-2">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Montant */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    Montant <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleToutPayer}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    Tout payer ({solde ? formatMGA(solde.solde_restant) : '—'})
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  max={solde?.solde_restant}
                  step="1"
                  value={form.montant}
                  onChange={e => setForm(prev => ({ ...prev, montant: e.target.value }))}
                  placeholder={`Max : ${solde ? formatMGA(solde.solde_restant) : '—'}`}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm transition-colors"
                />
                {solde && form.montant && parseFloat(form.montant) > 0 && parseFloat(form.montant) < solde.solde_restant && (
                  <p className="mt-1 text-xs text-orange-500">
                    Solde restant après ce paiement : {formatMGA(solde.solde_restant - parseFloat(form.montant))}
                  </p>
                )}
              </div>

              {/* Mode de paiement — boutons radio visuels */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mode de paiement <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {MODES.map(mode => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, mode_paiement: mode.value, reference: '' }))}
                      className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors ${
                        form.mode_paiement === mode.value
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg">{mode.emoji}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Référence (obligatoire si MVola ou Virement) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Référence
                  {refObligatoire && <span className="text-red-500"> *</span>}
                  {!refObligatoire && <span className="text-slate-400 font-normal"> (optionnel)</span>}
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={e => setForm(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder={placeholderRef || 'Référence du paiement'}
                  required={refObligatoire}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm transition-colors"
                />
              </div>

              {/* Date de paiement */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date du paiement</label>
                <input
                  type="date"
                  value={form.date_paiement}
                  onChange={e => setForm(prev => ({ ...prev, date_paiement: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes <span className="text-slate-400 font-normal">(optionnel)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observations…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none transition-colors"
                />
              </div>
            </form>
          )}
        </div>

        {/* ── Pied de page ── */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Fermer
          </button>
          {solde && solde.solde_restant > 0 && (
            <button
              type="submit"
              form="paiement-form"
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
                'Enregistrer le paiement'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
