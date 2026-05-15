/**
 * IncidentFormModal.tsx
 * Modal de déclaration ou de résolution d'un incident — TransiFlow.
 */

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createIncident, resoudreIncident } from '../../services/incidentService'
import type { Incident, IncidentFormData, ResoudreIncidentData,
              TypeIncident, GraviteIncident } from '../../types/incident'
import { LABELS_TYPE_INCIDENT, LABELS_GRAVITE } from '../../types/incident'
import type { Vehicle } from '../../services/vehicleService'
import type { Driver }  from '../../types/driver'

interface Props {
  isOpen:     boolean
  onClose:    () => void
  onSuccess:  () => void
  mode:       'declarer' | 'resoudre'
  incident?:  Incident | null
  vehicles?:  Vehicle[]
  drivers?:   Driver[]
}

const TYPES_INCIDENT: TypeIncident[] = ['panne','accident','vol','infraction','retard','autre']
const GRAVITES: GraviteIncident[]    = ['faible','moyen','grave','critique']

const defaultDeclarer: IncidentFormData = {
  vehicle_id: null, driver_id: null, mission_id: null,
  type_incident: '', gravite: '',
  titre: '', description: '', lieu: '',
  date_incident: new Date().toISOString().slice(0, 16),
  numero_sinistre: '',
}

const defaultResoudre: ResoudreIncidentData = {
  actions_prises: '', cout_reparation: '',
  date_resolution: new Date().toISOString().split('T')[0],
  remettre_en_service: true,
}

export default function IncidentFormModal({
  isOpen, onClose, onSuccess, mode, incident, vehicles = [], drivers = [],
}: Props) {
  const [formD, setFormD] = useState<IncidentFormData>(defaultDeclarer)
  const [formR, setFormR] = useState<ResoudreIncidentData>(defaultResoudre)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setFormD({ ...defaultDeclarer, date_incident: new Date().toISOString().slice(0, 16) })
    setFormR({ ...defaultResoudre, date_resolution: new Date().toISOString().split('T')[0] })
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      if (mode === 'declarer') {
        if (!formD.vehicle_id) { setError('Véhicule obligatoire'); setIsSubmitting(false); return }
        if (!formD.titre?.trim()) { setError('Titre obligatoire'); setIsSubmitting(false); return }
        if (!formD.type_incident) { setError('Type obligatoire'); setIsSubmitting(false); return }
        if (!formD.gravite) { setError('Gravité obligatoire'); setIsSubmitting(false); return }
        const { message } = await createIncident(formD)
        toast.success(message || 'Incident déclaré')
      } else if (mode === 'resoudre' && incident) {
        if (!formR.actions_prises.trim()) { setError('Actions prises obligatoires'); setIsSubmitting(false); return }
        await resoudreIncident(incident.id, formR)
        toast.success('Incident résolu')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
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
            {mode === 'declarer' ? 'Déclarer un incident' : 'Résoudre l\'incident'}
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

          {/* ── MODE DÉCLARER ── */}
          {mode === 'declarer' && (
            <>
              {/* Titre */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input type="text" value={formD.titre}
                  onChange={e => setFormD(p => ({ ...p, titre: e.target.value }))}
                  placeholder="Résumé de l'incident…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required />
              </div>

              {/* Type + Gravité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select value={formD.type_incident}
                    onChange={e => setFormD(p => ({ ...p, type_incident: e.target.value as TypeIncident }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required>
                    <option value="">Sélectionner…</option>
                    {TYPES_INCIDENT.map(t => <option key={t} value={t}>{LABELS_TYPE_INCIDENT[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Gravité <span className="text-red-500">*</span>
                  </label>
                  <select value={formD.gravite}
                    onChange={e => setFormD(p => ({ ...p, gravite: e.target.value as GraviteIncident }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required>
                    <option value="">Sélectionner…</option>
                    {GRAVITES.map(g => <option key={g} value={g}>{LABELS_GRAVITE[g]}</option>)}
                  </select>
                </div>
              </div>

              {/* Avertissement critique */}
              {(formD.gravite === 'critique' || formD.gravite === 'grave') && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Ce véhicule sera automatiquement mis en révision à la déclaration.
                </div>
              )}

              {/* Véhicule */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Véhicule <span className="text-red-500">*</span>
                </label>
                <select value={formD.vehicle_id ?? ''}
                  onChange={e => setFormD(p => ({ ...p, vehicle_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required>
                  <option value="">Sélectionner…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.immatriculation}</option>)}
                </select>
              </div>

              {/* Chauffeur (optionnel) */}
              {drivers.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Chauffeur (optionnel)</label>
                  <select value={formD.driver_id ?? ''}
                    onChange={e => setFormD(p => ({ ...p, driver_id: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Aucun</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                  </select>
                </div>
              )}

              {/* Lieu + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Lieu de l'incident</label>
                  <input type="text" value={formD.lieu}
                    onChange={e => setFormD(p => ({ ...p, lieu: e.target.value }))}
                    placeholder="Ville, route…"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date et heure</label>
                  <input type="datetime-local" value={formD.date_incident}
                    onChange={e => setFormD(p => ({ ...p, date_incident: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea rows={3} value={formD.description}
                  onChange={e => setFormD(p => ({ ...p, description: e.target.value }))}
                  placeholder="Décrivez les circonstances de l'incident…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Numéro sinistre */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">N° sinistre assurance (optionnel)</label>
                <input type="text" value={formD.numero_sinistre}
                  onChange={e => setFormD(p => ({ ...p, numero_sinistre: e.target.value }))}
                  placeholder="Référence assurance…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {/* ── MODE RÉSOUDRE ── */}
          {mode === 'resoudre' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Actions prises <span className="text-red-500">*</span>
                </label>
                <textarea rows={4} value={formR.actions_prises}
                  onChange={e => setFormR(p => ({ ...p, actions_prises: e.target.value }))}
                  placeholder="Décrivez les mesures correctives…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Coût de réparation (MGA)</label>
                  <input type="number" min="0" value={formR.cout_reparation}
                    onChange={e => setFormR(p => ({ ...p, cout_reparation: e.target.value }))}
                    placeholder="Ex : 500000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date de résolution</label>
                  <input type="date" value={formR.date_resolution}
                    onChange={e => setFormR(p => ({ ...p, date_resolution: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={formR.remettre_en_service}
                  onChange={e => setFormR(p => ({ ...p, remettre_en_service: e.target.checked }))}
                  className="w-4 h-4 accent-blue-600" />
                Remettre le véhicule en service actif
              </label>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60 ${
                mode === 'declarer' && (formD.gravite === 'critique' || formD.gravite === 'grave')
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}>
              {isSubmitting ? 'Enregistrement…' : mode === 'declarer' ? 'Déclarer' : 'Résoudre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
