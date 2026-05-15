/**
 * DashboardPage.tsx
 * Page tableau de bord principal du système Transport STTA.
 *
 * Sprint 6 : refonte complète avec un seul appel API pour les KPIs,
 *   graphiques Recharts et tableau des dernières missions.
 *
 *   - KPIs complets        → GET /api/stats/dashboard (1 seul appel)
 *   - Graphiques 30 jours  → GET /api/stats/missions
 *   - Dernières missions   → GET /api/missions?limit=5
 *   - Alertes détaillées   → GET /api/vehicles/alertes + /api/drivers/alertes
 */

import { useState, useEffect }   from 'react'
import { useNavigate, Link }     from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

import { useAuth }                                  from '../contexts/AuthContext'
import { getDashboardStats, getMissionStats }        from '../services/statsService'
import * as vehicleService                          from '../services/vehicleService'
import * as driverService                           from '../services/driverService'
import * as missionService                          from '../services/missionService'
import type { DashboardStats, MissionStats }        from '../services/statsService'
import type { VehicleAvecAlerte }                   from '../services/vehicleService'
import type { DriverAvecAlerte }                    from '../types/driver'
import type { Mission }                             from '../types/mission'
import { STATUT_COLORS, STATUT_LABELS }             from '../types/mission'
import { getDocumentEtat, calculerJoursRestants }   from '../utils/vehicleUtils'

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs des statuts dans le PieChart
// ─────────────────────────────────────────────────────────────────────────────

const COULEUR_STATUT_CHART: Record<string, string> = {
  brouillon: '#6B7280',
  planifiee: '#1E40AF',
  en_cours:  '#D97706',
  terminee:  '#059669',
  annulee:   '#DC2626',
}

// ─────────────────────────────────────────────────────────────────────────────
// Icônes SVG
// ─────────────────────────────────────────────────────────────────────────────

function IcVehicule() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H3m16.5 0h-.375
           M3.75 18.75V7.5A2.25 2.25 0 016 5.25h10.5A2.25 2.25 0 0118.75 7.5v6.75
           m-15 4.5h.375m14.625 0h.375m-14.625 0H3.75
           M18.75 14.25h-3.375a.75.75 0 01-.75-.75v-3a.75.75 0 01.75-.75h2.625
           c.621 0 1.125.504 1.125 1.125v3.375z
           M20.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0" />
    </svg>
  )
}

function IcChauffeur() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952
           4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07
           M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109
           a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z
           m8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IcAlerte() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
           c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z
           M12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

function IcRoute() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 3.75v4.5m0 15.75v-4.5m0 0h16.5m-16.5 0h16.5
           M3.75 3.75l4.5 4.5m-4.5 0l4.5-4.5M20.25 20.25l-4.5-4.5m4.5 4.5l-4.5-4.5" />
    </svg>
  )
}

function IcCamionAlerte() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H3m16.5 0h-.375
           M3.75 18.75V7.5A2.25 2.25 0 016 5.25h10.5A2.25 2.25 0 0118.75 7.5v6.75
           m-15 4.5h.375m14.625 0h.375m-14.625 0H3.75
           M18.75 14.25h-3.375a.75.75 0 01-.75-.75v-3a.75.75 0 01.75-.75h2.625
           c.621 0 1.125.504 1.125 1.125v3.375z" />
    </svg>
  )
}

function IcBadgeAlerte() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z
           M4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75
           c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant SkeletonKPI — squelette pour une carte en chargement
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonKPI() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-slate-200" />
        <div className="w-14 h-5 bg-slate-100 rounded-full" />
      </div>
      <div className="h-8 bg-slate-200 rounded w-16 mb-1.5" />
      <div className="h-3.5 bg-slate-100 rounded w-28" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant CarteKPI — carte de statistique individuelle
// ─────────────────────────────────────────────────────────────────────────────

interface CarteKPIProps {
  libelle:      string
  valeur:       string
  icone:        React.ReactNode
  couleurFond:  string
  couleurIcone: string
  description?: string
  description2?: string
  isLoading?:   boolean
  onClick?:     () => void
  badge?:       React.ReactNode
}

function CarteKPI({
  libelle, valeur, icone, couleurFond, couleurIcone,
  description, description2, isLoading, onClick, badge,
}: CarteKPIProps) {
  if (isLoading) return <SkeletonKPI />

  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      className={`
        bg-white rounded-xl border border-slate-200 p-5
        hover:shadow-sm transition-shadow duration-150 text-left w-full
        ${onClick ? 'cursor-pointer hover:border-slate-300' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${couleurFond} ${couleurIcone}`}>
          {icone}
        </div>
        {badge}
      </div>
      <p className="text-3xl font-bold text-slate-800 mb-1">{valeur}</p>
      <p className="text-sm font-medium text-slate-600">{libelle}</p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      {description2 && <p className="text-xs text-slate-400 mt-0.5">{description2}</p>}
    </Wrapper>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant SkeletonChart — squelette pendant le chargement des graphiques
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
      <div className="h-48 bg-slate-100 rounded-lg" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip personnalisé pour le LineChart
// ─────────────────────────────────────────────────────────────────────────────

function TooltipLigne({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-slate-600">{payload[0].value} mission{payload[0].value > 1 ? 's' : ''} le {label}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip personnalisé pour le PieChart
// ─────────────────────────────────────────────────────────────────────────────

function TooltipCamembert({ active, payload }: {
  active?:  boolean
  payload?: { name: string; value: number; payload: { percent: number } }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-0.5">
        {STATUT_LABELS[item.name as keyof typeof STATUT_LABELS] ?? item.name}
      </p>
      <p className="text-slate-500">
        {item.value} mission{item.value > 1 ? 's' : ''} ({Math.round((item.payload?.percent ?? 0) * 100)}%)
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Type unifié pour les alertes (véhicules + chauffeurs)
// ─────────────────────────────────────────────────────────────────────────────

interface AlerteUnifiee {
  type:          'vehicule' | 'chauffeur'
  id:            number
  libelle:       string
  message:       string
  joursRestants: number | null
  urgent:        boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Alertes Rapides
// ─────────────────────────────────────────────────────────────────────────────

interface SectionAlertesProps {
  alertesUnifiees: AlerteUnifiee[]
  isLoading:       boolean
}

function SectionAlertesRapides({ alertesUnifiees, isLoading }: SectionAlertesProps) {
  const alertesTrie = [...alertesUnifiees].sort((a, b) => {
    if (a.joursRestants === null) return 1
    if (b.joursRestants === null) return -1
    return a.joursRestants - b.joursRestants
  })
  const alertesAffichees = alertesTrie.slice(0, 5)

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/3" />
            <div className="h-5 bg-slate-200 rounded-full w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (alertesUnifiees.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
        <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-emerald-800">
          Tous les documents sont à jour ✓
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
                   c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0
                   L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Alertes documents</h2>
          <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
            {alertesUnifiees.length}
          </span>
        </div>
        <Link to="/vehicles" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
          Voir tout →
        </Link>
      </div>
      <div className="divide-y divide-slate-50">
        {alertesAffichees.map((alerte) => (
          <Link
            key={`${alerte.type}-${alerte.id}`}
            to={alerte.type === 'vehicule' ? `/vehicles/${alerte.id}` : `/drivers/${alerte.id}`}
            className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                alerte.type === 'vehicule' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {alerte.type === 'vehicule' ? <IcCamionAlerte /> : <IcBadgeAlerte />}
              </div>
              <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                {alerte.libelle}
              </span>
            </div>
            <span className="text-sm text-slate-500 flex-1 px-4">{alerte.message}</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
              alerte.urgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {alerte.joursRestants === null
                ? '—'
                : alerte.joursRestants < 0
                  ? `${Math.abs(alerte.joursRestants)}j dépassé`
                  : `${alerte.joursRestants}j restants`
              }
            </span>
          </Link>
        ))}
      </div>
      {alertesUnifiees.length > 5 && (
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
          <Link to="/vehicles" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            + {alertesUnifiees.length - 5} autre{alertesUnifiees.length - 5 > 1 ? 's' : ''} alerte{alertesUnifiees.length - 5 > 1 ? 's' : ''}
          </Link>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Dernières Missions
// ─────────────────────────────────────────────────────────────────────────────

interface SectionDernieresMissionsProps {
  missions:  Mission[]
  isLoading: boolean
}

function SkeletonLigneMission() {
  return (
    <div className="flex items-center gap-3 py-3 animate-pulse">
      <div className="w-16 h-4 bg-slate-200 rounded" />
      <div className="flex-1 h-4 bg-slate-100 rounded" />
      <div className="w-24 h-4 bg-slate-100 rounded" />
      <div className="w-20 h-4 bg-slate-100 rounded" />
      <div className="w-20 h-6 bg-slate-200 rounded-full" />
    </div>
  )
}

function SectionDernieresMissions({ missions, isLoading }: SectionDernieresMissionsProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="h-5 bg-slate-200 rounded w-1/4 mb-4 animate-pulse" />
        <div className="divide-y divide-slate-50">
          <SkeletonLigneMission />
          <SkeletonLigneMission />
          <SkeletonLigneMission />
          <SkeletonLigneMission />
          <SkeletonLigneMission />
        </div>
      </div>
    )
  }

  if (missions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-3">
        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
          <IcRoute />
        </div>
        <p className="text-sm font-medium text-slate-500">Aucune mission enregistrée</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Dernières missions</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Réf</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trajet</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Chauffeur</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {missions.map((mission) => {
              const chauffeurNom = mission.driver
                ? `${mission.driver.prenom} ${mission.driver.nom}`
                : 'Non assigné'
              const dateFormatee = new Date(mission.date_mission).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'short',
              })

              return (
                <tr
                  key={mission.id}
                  onClick={() => navigate(`/missions/${mission.id}`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-3.5 text-xs font-medium text-slate-400">
                    #{String(mission.id).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-700 max-w-[200px]">
                    <div className="flex items-center gap-1 truncate">
                      <span className="truncate">{mission.lieu_depart}</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <span className="truncate">{mission.lieu_arrivee}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-500 hidden md:table-cell">
                    {chauffeurNom}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 hidden sm:table-cell">
                    {dateFormatee}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      STATUT_COLORS[mission.statut] ?? 'bg-slate-100 text-slate-700'
                    }`}>
                      {STATUT_LABELS[mission.statut] ?? mission.statut}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
        <Link to="/missions" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
          Voir toutes les missions →
        </Link>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal DashboardPage
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { utilisateur } = useAuth()
  const navigate        = useNavigate()

  // ── État global des KPIs (un seul appel API) ──
  const [dashStats,     setDashStats]     = useState<DashboardStats | null>(null)
  const [loadingDash,   setLoadingDash]   = useState(true)

  // ── État graphiques (appel indépendant) ──
  const [missionStats,     setMissionStats]     = useState<MissionStats | null>(null)
  const [loadingCharts,    setLoadingCharts]    = useState(true)

  // ── État alertes détaillées (pour la liste) ──
  const [alertesVehicules, setAlertesVehicules] = useState<VehicleAvecAlerte[]>([])
  const [alertesPermis,    setAlertesPermis]    = useState<DriverAvecAlerte[]>([])
  const [loadingAlertes,   setLoadingAlertes]   = useState(true)

  // ── État dernières missions ──
  const [dernieresMissions,    setDernieresMissions]    = useState<Mission[]>([])
  const [loadingMissions,      setLoadingMissions]      = useState(true)

  // ── Chargement des KPIs en un seul appel ──
  useEffect(() => {
    getDashboardStats()
      .then(setDashStats)
      .catch(() => setDashStats(null))
      .finally(() => setLoadingDash(false))
  }, [])

  // ── Chargement des graphiques (30 derniers jours) ──
  useEffect(() => {
    const dateDebut = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dateFin   = new Date().toISOString().split('T')[0]
    getMissionStats({ date_debut: dateDebut, date_fin: dateFin })
      .then(setMissionStats)
      .catch(() => setMissionStats(null))
      .finally(() => setLoadingCharts(false))
  }, [])

  // ── Chargement des alertes détaillées ──
  useEffect(() => {
    Promise.all([
      vehicleService.getAlertes().then(r => setAlertesVehicules(r.donnees)).catch(() => []),
      driverService.getPermisAlertes().then(r => setAlertesPermis(r.donnees)).catch(() => []),
    ]).finally(() => setLoadingAlertes(false))
  }, [])

  // ── Chargement des 5 dernières missions ──
  useEffect(() => {
    missionService.getMissions({ limit: 5 })
      .then(r => setDernieresMissions(r.donnees))
      .catch(() => setDernieresMissions([]))
      .finally(() => setLoadingMissions(false))
  }, [])

  // ── Fusion des alertes pour la section rapide ──
  const alertesUnifiees: AlerteUnifiee[] = [
    ...alertesVehicules.map((v) => {
      const etatAssurance = getDocumentEtat(v.date_assurance)
      const etatVisite    = getDocumentEtat(v.date_visite_technique)
      let message = ''
      let dateRef: string | null = null

      if (etatAssurance === 'expiree')            { message = 'Assurance expirée'; dateRef = v.date_assurance }
      else if (etatVisite === 'expiree')          { message = 'Visite technique expirée'; dateRef = v.date_visite_technique }
      else if (etatAssurance === 'bientot_expiree') { message = 'Assurance bientôt expirée'; dateRef = v.date_assurance }
      else if (etatVisite === 'bientot_expiree')  { message = 'Visite technique bientôt expirée'; dateRef = v.date_visite_technique }

      const joursRestants = dateRef ? calculerJoursRestants(dateRef) : null
      return {
        type: 'vehicule' as const,
        id: v.id,
        libelle: v.immatriculation,
        message,
        joursRestants,
        urgent: etatAssurance === 'expiree' || etatVisite === 'expiree',
      }
    }),
    ...alertesPermis.map((d) => {
      const joursRestants = d.date_expiration_permis
        ? calculerJoursRestants(d.date_expiration_permis)
        : null
      const message = d.etat_permis === 'expire'
        ? 'Permis expiré'
        : `Permis expire dans ${joursRestants !== null ? joursRestants : 'X'} jours`
      return {
        type: 'chauffeur' as const,
        id: d.id,
        libelle: `${d.prenom} ${d.nom}`,
        message,
        joursRestants,
        urgent: d.etat_permis === 'expire',
      }
    }),
  ]

  // ── Données d'affichage ──
  const prenom         = utilisateur?.nom.split(' ')[0] ?? 'utilisateur'
  const dateAujourdhui = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const nbAlertes = dashStats?.alertes_total ?? 0

  return (
    <div className="space-y-6">

      {/* ── En-tête de bienvenue ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Bonjour, {prenom} 👋</h1>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">{dateAujourdhui}</p>
        </div>
        <button
          onClick={() => navigate('/missions')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-150"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle mission
        </button>
      </div>

      {/* ── Section 1 : 4 KPI Cards ── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Vue d'ensemble</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Carte Véhicules */}
          <CarteKPI
            libelle="Véhicules actifs"
            valeur={dashStats ? String(dashStats.vehicules.actifs) : '—'}
            icone={<IcVehicule />}
            couleurFond="bg-blue-50"
            couleurIcone="text-blue-600"
            description={dashStats ? `sur ${dashStats.vehicules.total} au total` : 'Flotte disponible'}
            isLoading={loadingDash}
            onClick={() => navigate('/vehicles')}
            badge={
              !loadingDash && (dashStats?.vehicules.alertes_documents ?? 0) > 0 ? (
                <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  ⚠ {dashStats!.vehicules.alertes_documents} alerte{dashStats!.vehicules.alertes_documents > 1 ? 's' : ''}
                </span>
              ) : undefined
            }
          />

          {/* Carte Chauffeurs */}
          <CarteKPI
            libelle="Chauffeurs actifs"
            valeur={dashStats ? String(dashStats.chauffeurs.actifs) : '—'}
            icone={<IcChauffeur />}
            couleurFond="bg-emerald-50"
            couleurIcone="text-emerald-600"
            description={dashStats ? `sur ${dashStats.chauffeurs.total} au total` : 'Prêts à être affectés'}
            isLoading={loadingDash}
            onClick={() => navigate('/drivers')}
            badge={
              !loadingDash && (dashStats?.chauffeurs.alertes_permis ?? 0) > 0 ? (
                <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  ⚠ {dashStats!.chauffeurs.alertes_permis} permis
                </span>
              ) : undefined
            }
          />

          {/* Carte Missions aujourd'hui */}
          <CarteKPI
            libelle="Missions aujourd'hui"
            valeur={dashStats ? String(dashStats.missions.aujourd_hui) : '—'}
            icone={<IcRoute />}
            couleurFond="bg-orange-50"
            couleurIcone="text-orange-600"
            description={dashStats ? `${dashStats.missions.en_cours} en cours` : undefined}
            description2={dashStats ? `${dashStats.missions.cette_semaine} terminées cette semaine` : undefined}
            isLoading={loadingDash}
            onClick={() => navigate('/missions')}
          />

          {/* Carte Alertes */}
          <CarteKPI
            libelle={nbAlertes === 0 ? 'Tout est à jour ✓' : 'Alertes documents'}
            valeur={dashStats ? String(nbAlertes) : '—'}
            icone={<IcAlerte />}
            couleurFond={nbAlertes > 0 ? 'bg-red-50' : 'bg-slate-50'}
            couleurIcone={nbAlertes > 0 ? 'text-red-500' : 'text-slate-400'}
            description="documents à renouveler"
            isLoading={loadingDash}
            onClick={() => navigate('/vehicles')}
          />

        </div>
      </section>

      {/* ── Section 2 : Graphiques Recharts ── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Activité des 30 derniers jours
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Graphique 1 : LineChart missions par jour */}
          {loadingCharts ? <SkeletonChart /> : (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Évolution des missions</p>
              {missionStats && missionStats.missions_par_jour.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={missionStats.missions_par_jour}
                    margin={{ top: 4, right: 8, bottom: 4, left: -20 }}
                  >
                    <defs>
                      <linearGradient id="colorMissions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <Tooltip content={<TooltipLigne />} />
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
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          )}

          {/* Graphique 2 : PieChart répartition par statut */}
          {loadingCharts ? <SkeletonChart /> : (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Répartition par statut</p>
              {missionStats && missionStats.missions_par_statut.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={missionStats.missions_par_statut}
                      dataKey="count"
                      nameKey="statut"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {missionStats.missions_par_statut.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COULEUR_STATUT_CHART[entry.statut] ?? '#94A3B8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipCamembert />} />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs text-slate-600">
                          {STATUT_LABELS[value as keyof typeof STATUT_LABELS] ?? value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          )}

        </div>
      </section>

      {/* ── Section 3 : Activité récente — Dernières missions ── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Activité récente
        </h2>
        <SectionDernieresMissions
          missions={dernieresMissions}
          isLoading={loadingMissions}
        />
      </section>

      {/* ── Section 4 : Alertes rapides (liste détaillée) ── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Alertes documents
        </h2>
        <SectionAlertesRapides
          alertesUnifiees={alertesUnifiees}
          isLoading={loadingAlertes}
        />
      </section>

    </div>
  )
}
