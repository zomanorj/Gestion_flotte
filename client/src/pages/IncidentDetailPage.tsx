/**
 * IncidentDetailPage.tsx
 * Page de détail d'un incident — TransiFlow.
 *
 * Affiche la timeline, les informations complètes et les actions disponibles.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuth }          from '../contexts/AuthContext'
import * as incidentService from '../services/incidentService'
import IncidentFormModal    from '../components/incidents/IncidentFormModal'
import { formatMGA, formatDateFR } from '../utils/format'
import type { Incident }    from '../types/incident'
import {
  LABELS_TYPE_INCIDENT, LABELS_GRAVITE,
  COULEURS_GRAVITE,
} from '../types/incident'
import * as vehicleService from '../services/vehicleService'
import type { Vehicle } from '../services/vehicleService'

export default function IncidentDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const navigate     = useNavigate()
  const { utilisateur } = useAuth()

  const [incident,    setIncident]    = useState<Incident | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [vehicles,    setVehicles]    = useState<Vehicle[]>([])

  const canEdit = utilisateur?.role === 'admin' || utilisateur?.role === 'gestionnaire'

  useEffect(() => {
    if (!id) return
    vehicleService.getVehicles({ limit: 100 }).then(r => setVehicles(r.donnees)).catch(() => {})
    incidentService.getIncident(parseInt(id))
      .then(setIncident)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const handlePrendreEnCharge = async () => {
    if (!incident) return
    try {
      await incidentService.updateIncident(incident.id, { statut: 'en_traitement' })
      toast.success('Incident pris en charge')
      setIncident(prev => prev ? { ...prev, statut: 'en_traitement' } : null)
    } catch { toast.error('Erreur') }
  }

  const handleClore = async () => {
    if (!incident) return
    if (!window.confirm('Clore définitivement cet incident ?')) return
    try {
      await incidentService.cloreIncident(incident.id)
      toast.success('Incident clos')
      navigate('/incidents')
    } catch { toast.error('Erreur') }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <div className="h-10 bg-slate-200 rounded w-96" />
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (notFound || !incident) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Incident introuvable</p>
        <button onClick={() => navigate('/incidents')}
          className="mt-4 text-blue-600 hover:underline text-sm">
          Retour aux incidents
        </button>
      </div>
    )
  }

  const badgeCouleur = COULEURS_GRAVITE[incident.gravite]

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link to="/incidents" className="hover:text-slate-700 transition-colors">Incidents</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-slate-700 font-medium truncate max-w-xs">{incident.titre}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <span className={`mt-1 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${badgeCouleur} ${
            incident.gravite === 'critique' ? 'animate-pulse' : ''
          }`}>
            {incident.gravite === 'critique' ? '⚠ ' : ''}{LABELS_GRAVITE[incident.gravite]}
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{incident.titre}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {LABELS_TYPE_INCIDENT[incident.type_incident]} — {formatDateFR(incident.date_incident)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && incident.statut === 'ouvert' && (
            <button onClick={handlePrendreEnCharge}
              className="px-4 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
              Prendre en charge
            </button>
          )}
          {canEdit && (incident.statut === 'ouvert' || incident.statut === 'en_traitement') && (
            <button onClick={() => setModalOpen(true)}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
              Résoudre
            </button>
          )}
          {utilisateur?.role === 'admin' && incident.statut === 'resolu' && (
            <button onClick={handleClore}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Clore définitivement
            </button>
          )}
        </div>
      </div>

      {/* Infos principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Véhicule */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Véhicule</p>
          <Link to={`/vehicles/${incident.vehicle_id}`}
            className="text-sm font-semibold text-blue-700 hover:underline">
            {incident.immatriculation}
          </Link>
        </div>

        {/* Chauffeur */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Chauffeur</p>
          {incident.driver_id ? (
            <Link to={`/drivers/${incident.driver_id}`}
              className="text-sm font-semibold text-blue-700 hover:underline">
              {incident.driver_prenom} {incident.driver_nom}
            </Link>
          ) : (
            <p className="text-sm text-slate-400">Non renseigné</p>
          )}
        </div>

        {/* Mission */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Mission liée</p>
          {incident.mission_id ? (
            <Link to={`/missions/${incident.mission_id}`}
              className="text-sm font-semibold text-blue-700 hover:underline">
              {incident.lieu_depart} → {incident.lieu_arrivee}
            </Link>
          ) : (
            <p className="text-sm text-slate-400">Aucune</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-5">Historique</h2>
        <div className="relative space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">

          {/* Déclaration */}
          <div className="flex items-start gap-4 relative">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0 z-10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.27a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Incident déclaré</p>
              <p className="text-xs text-slate-500">
                {formatDateFR(incident.date_incident)}
                {incident.declared_by_nom ? ` — par ${incident.declared_by_nom}` : ''}
              </p>
              {incident.lieu && (
                <p className="text-xs text-slate-500 mt-0.5">📍 {incident.lieu}</p>
              )}
            </div>
          </div>

          {/* En traitement */}
          {(incident.statut === 'en_traitement' || incident.statut === 'resolu' || incident.statut === 'clos') && (
            <div className="flex items-start gap-4 relative">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 shrink-0 z-10">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Pris en traitement</p>
              </div>
            </div>
          )}

          {/* Résolution */}
          {(incident.statut === 'resolu' || incident.statut === 'clos') && (
            <div className="flex items-start gap-4 relative">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0 z-10">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Incident résolu</p>
                <p className="text-xs text-slate-500">
                  {formatDateFR(incident.date_resolution)}
                  {incident.resolved_by_nom ? ` — par ${incident.resolved_by_nom}` : ''}
                </p>
                {incident.cout_reparation && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    💰 Coût : {formatMGA(incident.cout_reparation)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Clos */}
          {incident.statut === 'clos' && (
            <div className="flex items-start gap-4 relative">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0 z-10">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Incident clos définitivement</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description & Actions prises */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {incident.description && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm text-slate-700 leading-relaxed">{incident.description}</p>
          </div>
        )}
        {incident.actions_prises && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Actions prises</p>
            <p className="text-sm text-slate-700 leading-relaxed">{incident.actions_prises}</p>
          </div>
        )}
        {incident.numero_sinistre && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">N° Sinistre assurance</p>
            <p className="text-sm font-mono text-slate-700">{incident.numero_sinistre}</p>
          </div>
        )}
      </div>

      <IncidentFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          if (id) incidentService.getIncident(parseInt(id)).then(setIncident).catch(() => {})
          toast.success('Incident mis à jour')
        }}
        mode="resoudre"
        incident={incident}
        vehicles={vehicles}
      />
    </div>
  )
}
