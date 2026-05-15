/**
 * IncidentsPage.tsx
 * Page de gestion des incidents — TransiFlow.
 *
 * Sections :
 *   - Bandeau incidents critiques
 *   - KPIs
 *   - Graphiques (par type, par gravité)
 *   - Liste des incidents avec filtres
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }   from 'react-router-dom'
import toast             from 'react-hot-toast'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

import { useAuth }           from '../contexts/AuthContext'
import * as incidentService  from '../services/incidentService'
import * as vehicleService   from '../services/vehicleService'
import * as driverService    from '../services/driverService'
import IncidentFormModal     from '../components/incidents/IncidentFormModal'
import EmptyState            from '../components/ui/EmptyState'
import { useConfirm }        from '../hooks/useConfirm'
import { formatMGA, formatDateCourte } from '../utils/format'
import type { Incident, TypeIncident, GraviteIncident, StatutIncident,
              StatsIncidents } from '../types/incident'
import {
  LABELS_TYPE_INCIDENT, LABELS_GRAVITE, LABELS_STATUT_INCIDENT,
  COULEURS_GRAVITE, COULEURS_TYPE_INCIDENT,
} from '../types/incident'
import type { Vehicle } from '../services/vehicleService'
import type { Driver }  from '../types/driver'

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs statuts incidents
// ─────────────────────────────────────────────────────────────────────────────

const COULEURS_STATUT: Record<StatutIncident, string> = {
  ouvert:        'bg-red-100 text-red-700',
  en_traitement: 'bg-orange-100 text-orange-700',
  resolu:        'bg-emerald-100 text-emerald-700',
  clos:          'bg-slate-100 text-slate-500',
}

function SkeletonTable() {
  return (
    <div className="animate-pulse space-y-3 px-4 py-2">
      {[0,1,2,3].map(i => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="w-16 h-6 bg-slate-200 rounded-full" />
          <div className="flex-1 h-4 bg-slate-100 rounded" />
          <div className="w-20 h-6 bg-slate-200 rounded-full" />
          <div className="w-24 h-4 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const { utilisateur } = useAuth()
  const navigate        = useNavigate()
  const { confirm, ConfirmModalComponent } = useConfirm()

  const [incidents,    setIncidents]    = useState<Incident[]>([])
  const [incCritiques, setIncCritiques] = useState<Incident[]>([])
  const [stats,        setStats]        = useState<StatsIncidents | null>(null)
  const [total,        setTotal]        = useState(0)
  const [totalPages,   setTotalPages]   = useState(1)
  const [page,         setPage]         = useState(1)
  const [loading,      setLoading]      = useState(true)

  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreGravite, setFiltreGravite] = useState('')
  const [filtreType,   setFiltreType]   = useState('')

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers,  setDrivers]  = useState<Driver[]>([])

  const [modalMode,      setModalMode]      = useState<'declarer' | 'resoudre'>('declarer')
  const [selectedInc,    setSelectedInc]    = useState<Incident | null>(null)
  const [isModalOpen,    setIsModalOpen]    = useState(false)

  const canEdit = utilisateur?.role === 'admin' || utilisateur?.role === 'gestionnaire'

  useEffect(() => {
    vehicleService.getVehicles({ limit: 100 }).then(r => setVehicles(r.donnees)).catch(() => {})
    driverService.getDrivers({ limit: 100 }).then(r => setDrivers(r.donnees)).catch(() => {})
    incidentService.getIncidentsOuverts().then(all => {
      setIncCritiques(all.filter(i => i.gravite === 'critique' || i.gravite === 'grave'))
    }).catch(() => {})
    incidentService.getStatsIncidents().then(setStats).catch(() => setStats(null))
  }, [])

  const charger = useCallback(() => {
    setLoading(true)
    incidentService.getIncidents({
      statut:  filtreStatut  || undefined,
      gravite: filtreGravite || undefined,
      type:    filtreType    || undefined,
      page, limit: 20,
    }).then(r => {
      setIncidents(r.donnees)
      setTotal(r.pagination.total)
      setTotalPages(r.pagination.totalPages)
    }).catch(() => setIncidents([]))
    .finally(() => setLoading(false))
  }, [filtreStatut, filtreGravite, filtreType, page])

  useEffect(() => { charger() }, [charger])

  const handleClore = async (inc: Incident) => {
    const ok = await confirm({
      title: 'Clore l\'incident',
      message: 'Clore définitivement cet incident ? Cette action est irréversible.',
      confirmLabel: 'Clore définitivement',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await incidentService.cloreIncident(inc.id)
      toast.success('Incident clos')
      charger()
    } catch { toast.error('Erreur') }
  }

  // Données PieChart types
  const dataTypes = stats?.par_type.map(t => ({
    name: LABELS_TYPE_INCIDENT[t.type as TypeIncident] ?? t.type,
    value: t.count,
    fill: COULEURS_TYPE_INCIDENT[t.type as TypeIncident] ?? '#94A3B8',
  })) ?? []

  const dataGravite = stats?.par_gravite.map(g => ({
    name: LABELS_GRAVITE[g.gravite as GraviteIncident] ?? g.gravite,
    value: g.count,
  })) ?? []

  const COULEURS_GRAVITE_CHART: Record<string, string> = {
    faible: '#94A3B8', moyen: '#F97316', grave: '#EF4444', critique: '#7F1D1D',
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Incidents & Pannes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Déclaration, suivi et résolution des incidents</p>
        </div>
        <button
          onClick={() => { setSelectedInc(null); setModalMode('declarer'); setIsModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Déclarer un incident
        </button>
      </div>

      {/* Bandeau critiques */}
      {incCritiques.length > 0 && (
        <div className="bg-red-600 text-white rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <span className="text-lg shrink-0">🚨</span>
          <p className="text-sm font-semibold">
            {incCritiques.length} incident{incCritiques.length > 1 ? 's' : ''} critique{incCritiques.length > 1 ? 's' : ''} nécessite{incCritiques.length === 1 ? '' : 'nt'} une action immédiate
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ouverts',          value: stats?.par_statut.find(s => s.statut === 'ouvert')?.count || 0,        color: 'bg-red-50 text-red-600' },
          { label: 'En traitement',    value: stats?.par_statut.find(s => s.statut === 'en_traitement')?.count || 0, color: 'bg-orange-50 text-orange-600' },
          { label: 'Résolus ce mois',  value: incidents.filter(i => i.statut === 'resolu').length,                   color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Coût réparations', value: formatMGA(stats?.cout_total_reparations),                              color: 'bg-slate-50 text-slate-600', isText: true },
        ].map(({ label, value, color, isText }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} mb-4`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className={`font-bold text-slate-800 mb-1 ${isText ? 'text-base' : 'text-2xl'}`}>{value}</p>
            <p className="text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      {stats && (dataTypes.length > 0 || dataGravite.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">Incidents par type</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={dataTypes} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {dataTypes.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
                <Legend formatter={v => <span className="text-xs text-slate-600">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">Incidents par gravité</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={dataGravite} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {dataGravite.map((entry, i) => (
                    <Cell key={i} fill={COULEURS_GRAVITE_CHART[entry.name.toLowerCase()] ?? '#94A3B8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={v => <span className="text-xs text-slate-600">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Liste des incidents</h2>
          <div className="flex gap-2 ml-auto flex-wrap">
            <select value={filtreGravite}
              onChange={e => { setFiltreGravite(e.target.value); setPage(1) }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none">
              <option value="">Toutes gravités</option>
              {(['faible','moyen','grave','critique'] as GraviteIncident[]).map(g => (
                <option key={g} value={g}>{LABELS_GRAVITE[g]}</option>
              ))}
            </select>
            <select value={filtreStatut}
              onChange={e => { setFiltreStatut(e.target.value); setPage(1) }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none">
              <option value="">Tous statuts</option>
              {(['ouvert','en_traitement','resolu','clos'] as StatutIncident[]).map(s => (
                <option key={s} value={s}>{LABELS_STATUT_INCIDENT[s]}</option>
              ))}
            </select>
            <select value={filtreType}
              onChange={e => { setFiltreType(e.target.value); setPage(1) }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none">
              <option value="">Tous types</option>
              {(['panne','accident','vol','infraction','retard','autre'] as TypeIncident[]).map(t => (
                <option key={t} value={t}>{LABELS_TYPE_INCIDENT[t]}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <SkeletonTable /> : incidents.length === 0 ? (
          <EmptyState
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m9-.27a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0zM12 15.75h.007v.008H12v-.008z" />
            </svg>}
            title="Aucun incident"
            description="Aucun incident déclaré pour ces filtres."
            actionLabel="Déclarer un incident"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Gravité','Date','Titre','Véhicule','Chauffeur','Type','Statut','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incidents.map(inc => (
                  <tr key={inc.id}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      inc.gravite === 'critique' ? 'bg-red-50/30' : ''
                    }`}
                    onClick={() => navigate(`/incidents/${inc.id}`)}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${COULEURS_GRAVITE[inc.gravite]} ${
                        inc.gravite === 'critique' ? 'animate-pulse' : ''
                      }`}>
                        {inc.gravite === 'critique' ? '⚠ ' : ''}{LABELS_GRAVITE[inc.gravite]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateCourte(inc.date_incident)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[200px] truncate">{inc.titre}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inc.immatriculation}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {inc.driver_prenom ? `${inc.driver_prenom} ${inc.driver_nom}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {LABELS_TYPE_INCIDENT[inc.type_incident]}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${COULEURS_STATUT[inc.statut]}`}>
                        {LABELS_STATUT_INCIDENT[inc.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-xs">
                        {canEdit && (inc.statut === 'ouvert' || inc.statut === 'en_traitement') && (
                          <button
                            onClick={() => { setSelectedInc(inc); setModalMode('resoudre'); setIsModalOpen(true) }}
                            className="text-emerald-600 hover:text-emerald-800 font-medium">
                            Résoudre
                          </button>
                        )}
                        {utilisateur?.role === 'admin' && inc.statut === 'resolu' && (
                          <button onClick={() => handleClore(inc)}
                            className="text-slate-400 hover:text-slate-600 font-medium">
                            Clore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">{total} incidents</p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40">← Préc.</button>
              <span className="text-xs text-slate-600">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40">Suiv. →</button>
            </div>
          </div>
        )}
      </div>

      <IncidentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          charger()
          incidentService.getIncidentsOuverts().then(all => {
            setIncCritiques(all.filter(i => i.gravite === 'critique' || i.gravite === 'grave'))
          }).catch(() => {})
          incidentService.getStatsIncidents().then(setStats).catch(() => {})
        }}
        mode={modalMode}
        incident={selectedInc}
        vehicles={vehicles}
        drivers={drivers}
      />
      {ConfirmModalComponent}
    </div>
  )
}
