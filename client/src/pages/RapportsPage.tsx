/**
 * RapportsPage.tsx
 * Page statistiques et exports — TransiFlow.
 *
 * Accessible uniquement aux rôles admin et gestionnaire.
 * Affiche des graphiques analytiques et permet l'export de données Excel.
 *
 * Sections :
 *   1. Statistiques des missions (graphiques + KPIs sur période)
 *   2. Statistiques de la flotte
 *   3. Exports Excel (missions, véhicules, chauffeurs)
 */

import { useState, useEffect } from 'react'
import { Navigate }            from 'react-router-dom'
import toast                   from 'react-hot-toast'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

import { useAuth }                                       from '../contexts/AuthContext'
import { getMissionStats, getFleetStats, getDashboardStats } from '../services/statsService'
import { exportMissions, exportVehicules, exportChauffeurs } from '../services/exportService'
import type { MissionStats, FleetStats, DashboardStats }     from '../services/statsService'

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs
// ─────────────────────────────────────────────────────────────────────────────

const COULEURS_TYPE = ['#1E40AF', '#059669', '#D97706', '#7C3AED', '#DB2777']

// ─────────────────────────────────────────────────────────────────────────────
// Icônes SVG
// ─────────────────────────────────────────────────────────────────────────────

function IcRoute() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 3.75v4.5m0 15.75v-4.5m0 0h16.5m-16.5 0h16.5
           M3.75 3.75l4.5 4.5m-4.5 0l4.5-4.5M20.25 20.25l-4.5-4.5m4.5 4.5l-4.5-4.5" />
    </svg>
  )
}

function IcPoids() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591
           M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636
           M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  )
}

function IcHorloge() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IcExcel() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125
           v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6
           m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125
           h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────────────────────────

type PeriodePredefinie = '7j' | '30j' | '3mois' | 'custom'

// ─────────────────────────────────────────────────────────────────────────────
// Composant Skeleton réutilisable
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonChart({ height = 220 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
      <div className={`bg-slate-100 rounded-lg`} style={{ height }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltips personnalisés
// ─────────────────────────────────────────────────────────────────────────────

function TooltipSimple({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-slate-600">{label} : <strong>{payload[0].value}</strong></p>
    </div>
  )
}

function TooltipFlotte({ active, payload }: {
  active?: boolean; payload?: { name: string; value: number }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-slate-700 font-medium">{payload[0].name}</p>
      <p className="text-slate-500">{payload[0].value.toLocaleString('fr-FR')} km</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal RapportsPage
// ─────────────────────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const { utilisateur } = useAuth()

  // Accès réservé aux admins et gestionnaires
  if (utilisateur?.role === 'chauffeur') {
    return <Navigate to="/" replace />
  }

  // ── État période ──
  const [periode, setPeriode]           = useState<PeriodePredefinie>('30j')
  const [dateDebut, setDateDebut]       = useState('')
  const [dateFin, setDateFin]           = useState('')

  // ── État statistiques missions ──
  const [missionStats, setMissionStats] = useState<MissionStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // ── État statistiques flotte ──
  const [fleetStats, setFleetStats]     = useState<FleetStats | null>(null)
  const [loadingFleet, setLoadingFleet] = useState(true)

  // ── État KPIs globaux (pour les compteurs sur les cartes export) ──
  const [dashStats, setDashStats]       = useState<DashboardStats | null>(null)

  // ── État exports en cours ──
  const [exportingMissions,   setExportingMissions]   = useState(false)
  const [exportingVehicules,  setExportingVehicules]  = useState(false)
  const [exportingChauffeurs, setExportingChauffeurs] = useState(false)

  // ── Filtres export missions ──
  const [exportDateDebut, setExportDateDebut] = useState('')
  const [exportDateFin,   setExportDateFin]   = useState('')
  const [exportStatut,    setExportStatut]    = useState('')

  // ── Calcul des dates selon la période sélectionnée ──
  function calculerDates(p: PeriodePredefinie): { debut: string; fin: string } {
    const fin   = new Date().toISOString().split('T')[0]
    let debut = fin

    if (p === '7j')    debut = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    if (p === '30j')   debut = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    if (p === '3mois') debut = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    return { debut, fin }
  }

  // ── Chargement des stats missions ──
  function chargerMissionStats(debut: string, fin: string) {
    setLoadingStats(true)
    getMissionStats({ date_debut: debut, date_fin: fin })
      .then(setMissionStats)
      .catch(() => setMissionStats(null))
      .finally(() => setLoadingStats(false))
  }

  // ── Chargement initial ──
  useEffect(() => {
    const { debut, fin } = calculerDates('30j')
    chargerMissionStats(debut, fin)

    getFleetStats()
      .then(setFleetStats)
      .catch(() => setFleetStats(null))
      .finally(() => setLoadingFleet(false))

    getDashboardStats()
      .then(setDashStats)
      .catch(() => setDashStats(null))
  }, [])

  // ── Changement de période ──
  function handlePeriodeChange(p: PeriodePredefinie) {
    setPeriode(p)
    if (p !== 'custom') {
      const { debut, fin } = calculerDates(p)
      chargerMissionStats(debut, fin)
    }
  }

  // ── Actualisation période personnalisée ──
  function handleActualiser() {
    if (!dateDebut || !dateFin) {
      toast.error('Veuillez saisir les deux dates')
      return
    }
    chargerMissionStats(dateDebut, dateFin)
  }

  // ── Handlers export ──
  async function handleExportMissions() {
    setExportingMissions(true)
    try {
      await exportMissions({
        date_debut: exportDateDebut || undefined,
        date_fin:   exportDateFin   || undefined,
        statut:     exportStatut    || undefined,
      })
      toast.success('Export missions téléchargé')
    } catch {
      toast.error('Erreur lors de l\'export')
    } finally {
      setExportingMissions(false)
    }
  }

  async function handleExportVehicules() {
    setExportingVehicules(true)
    try {
      await exportVehicules()
      toast.success('Export flotte téléchargé')
    } catch {
      toast.error('Erreur lors de l\'export')
    } finally {
      setExportingVehicules(false)
    }
  }

  async function handleExportChauffeurs() {
    setExportingChauffeurs(true)
    try {
      await exportChauffeurs()
      toast.success('Export chauffeurs téléchargé')
    } catch {
      toast.error('Erreur lors de l\'export')
    } finally {
      setExportingChauffeurs(false)
    }
  }

  // ── Couleur du taux de ponctualité ──
  const ponctualite = dashStats?.missions.taux_ponctualite ?? 0
  const couleurPonctualite = ponctualite >= 80 ? 'text-emerald-600' : ponctualite >= 50 ? 'text-orange-500' : 'text-red-500'

  // ── Couleur du taux d'utilisation flotte ──
  const tauxUtilisation = fleetStats?.utilisation_flotte ?? 0
  const couleurUtilisation = tauxUtilisation >= 70 ? 'text-emerald-600' : tauxUtilisation >= 40 ? 'text-orange-500' : 'text-red-500'

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
          <span>Tableau de bord</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-slate-700 font-medium">Rapports & Exports</span>
        </nav>
        <h1 className="text-xl font-bold text-slate-800">Rapports & Exports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Analysez vos données et exportez vos rapports</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — Statistiques des missions
      ══════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-blue-600 rounded-full" />
          Statistiques des missions
        </h2>

        {/* Barre de contrôle période */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            {(['7j', '30j', '3mois', 'custom'] as PeriodePredefinie[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodeChange(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  periode === p
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {p === '7j' ? '7 jours' : p === '30j' ? '30 jours' : p === '3mois' ? '3 mois' : 'Personnalisé'}
              </button>
            ))}
          </div>

          {/* Inputs dates personnalisées */}
          {periode === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">→</span>
              <input
                type="date"
                value={dateFin}
                onChange={e => setDateFin(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleActualiser}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Actualiser
              </button>
            </div>
          )}
        </div>

        {/* 3 mini KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Total km */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
              <IcRoute />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">
                {loadingStats ? '—' : (missionStats?.total_km_parcourus ?? 0).toLocaleString('fr-FR')}
              </p>
              <p className="text-xs text-slate-500">km parcourus</p>
            </div>
          </div>

          {/* Total tonnes */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600 shrink-0">
              <IcPoids />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">
                {loadingStats ? '—' : parseFloat(String(missionStats?.total_tonnes_transportees ?? 0)).toFixed(1)}
              </p>
              <p className="text-xs text-slate-500">tonnes transportées</p>
            </div>
          </div>

          {/* Taux ponctualité */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
              <IcHorloge />
            </div>
            <div>
              <p className={`text-xl font-bold ${couleurPonctualite}`}>
                {ponctualite}%
              </p>
              <p className="text-xs text-slate-500">taux de ponctualité</p>
            </div>
          </div>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* LineChart missions par jour */}
          {loadingStats ? <SkeletonChart height={220} /> : (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Missions par jour</p>
              {missionStats && missionStats.missions_par_jour.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={missionStats.missions_par_jour}
                    margin={{ top: 4, right: 8, bottom: 4, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<TooltipSimple />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#1E40AF"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#1E40AF' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                  Aucune donnée pour cette période
                </div>
              )}
            </div>
          )}

          {/* BarChart missions par semaine */}
          {loadingStats ? <SkeletonChart height={220} /> : (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Missions par semaine</p>
              {missionStats && missionStats.missions_par_semaine.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={missionStats.missions_par_semaine}
                    margin={{ top: 4, right: 8, bottom: 4, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="semaine"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<TooltipSimple />} />
                    <Bar dataKey="count" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                  Aucune donnée pour cette période
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tableau top 5 trajets */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-4">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Top 5 trajets</h3>
          </div>
          {loadingStats ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-6 h-6 bg-slate-200 rounded-full" />
                  <div className="flex-1 h-4 bg-slate-100 rounded" />
                  <div className="w-12 h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : missionStats && missionStats.top_trajets.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {missionStats.top_trajets.map((trajet, index) => (
                <div key={index} className="flex items-center gap-4 px-6 py-3.5">
                  {/* Rang */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-slate-200 text-slate-600' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {index + 1}
                  </div>
                  {/* Trajet */}
                  <span className="flex-1 text-sm text-slate-700 truncate">{trajet.trajet}</span>
                  {/* Nombre */}
                  <span className="text-sm font-semibold text-slate-800">
                    {trajet.count} mission{trajet.count > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-slate-400">
              Aucune donnée pour cette période
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — Statistiques flotte
      ══════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-emerald-600 rounded-full" />
          Statistiques flotte
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Taux d'utilisation flotte */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center justify-center text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Taux d'utilisation
            </p>
            <p className={`text-5xl font-black mb-1 ${couleurUtilisation}`}>
              {loadingFleet ? '—' : `${tauxUtilisation}%`}
            </p>
            <p className="text-xs text-slate-400">de la flotte en activité</p>
          </div>

          {/* BarChart horizontal km par véhicule */}
          {loadingFleet ? <SkeletonChart height={200} /> : (
            <div className="bg-white rounded-xl border border-slate-200 p-5 md:col-span-2">
              <p className="text-sm font-semibold text-slate-700 mb-4">
                Kilométrage par véhicule (top 5)
              </p>
              {fleetStats && fleetStats.km_par_vehicule.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={fleetStats.km_par_vehicule}
                    layout="vertical"
                    margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="immatriculation"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip content={<TooltipFlotte />} />
                    <Bar dataKey="km" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          )}

          {/* PieChart véhicules par type */}
          {loadingFleet ? <SkeletonChart height={200} /> : (
            <div className="bg-white rounded-xl border border-slate-200 p-5 md:col-span-3">
              <p className="text-sm font-semibold text-slate-700 mb-4">Répartition par type de véhicule</p>
              {fleetStats && fleetStats.vehicules_par_type.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={fleetStats.vehicules_par_type}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {fleetStats.vehicules_par_type.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COULEURS_TYPE[index % COULEURS_TYPE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs text-slate-600 capitalize">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — Exports
      ══════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-orange-500 rounded-full" />
          Télécharger les données
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Carte export Missions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                <IcExcel />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Export missions</p>
                <p className="text-xs text-slate-500">Liste complète avec filtres</p>
              </div>
            </div>

            {/* Filtres optionnels */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Date début</label>
                  <input
                    type="date"
                    value={exportDateDebut}
                    onChange={e => setExportDateDebut(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Date fin</label>
                  <input
                    type="date"
                    value={exportDateFin}
                    onChange={e => setExportDateFin(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <select
                value={exportStatut}
                onChange={e => setExportStatut(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Tous les statuts</option>
                <option value="brouillon">Brouillon</option>
                <option value="planifiee">Planifiée</option>
                <option value="en_cours">En cours</option>
                <option value="terminee">Terminée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>

            <button
              onClick={handleExportMissions}
              disabled={exportingMissions}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {exportingMissions ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Export en cours…
                </>
              ) : (
                <>
                  <IcExcel />
                  Exporter .xlsx
                </>
              )}
            </button>
          </div>

          {/* Carte export Véhicules */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                <IcExcel />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Export flotte</p>
                <p className="text-xs text-slate-500">Liste complète des véhicules</p>
              </div>
            </div>

            {dashStats && (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                {dashStats.vehicules.total} véhicule{dashStats.vehicules.total > 1 ? 's' : ''} dans la base
              </p>
            )}

            <div className="flex-1" />

            <button
              onClick={handleExportVehicules}
              disabled={exportingVehicules}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {exportingVehicules ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Export en cours…
                </>
              ) : (
                <>
                  <IcExcel />
                  Exporter .xlsx
                </>
              )}
            </button>
          </div>

          {/* Carte export Chauffeurs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                <IcExcel />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Export chauffeurs</p>
                <p className="text-xs text-slate-500">Liste complète des chauffeurs</p>
              </div>
            </div>

            {dashStats && (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                {dashStats.chauffeurs.total} chauffeur{dashStats.chauffeurs.total > 1 ? 's' : ''} dans la base
              </p>
            )}

            <div className="flex-1" />

            <button
              onClick={handleExportChauffeurs}
              disabled={exportingChauffeurs}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {exportingChauffeurs ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Export en cours…
                </>
              ) : (
                <>
                  <IcExcel />
                  Exporter .xlsx
                </>
              )}
            </button>
          </div>

        </div>
      </section>

    </div>
  )
}
