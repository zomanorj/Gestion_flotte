/**
 * FinancePage.tsx
 * Page de gestion financière — TransiFlow.
 *
 * Sections :
 *   - KPIs (total, coût/mission, coût/km, économies)
 *   - Graphiques Recharts (par catégorie, évolution mensuelle, top véhicules)
 *   - Budget vs Réel
 *   - Liste des dépenses avec filtres
 */

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'

import { useAuth }            from '../contexts/AuthContext'
import * as financeService    from '../services/financeService'
import * as vehicleService    from '../services/vehicleService'
import * as missionService    from '../services/missionService'
import DepenseFormModal       from '../components/finance/DepenseFormModal'
import EmptyState             from '../components/ui/EmptyState'
import { useConfirm }         from '../hooks/useConfirm'
import { formatMGA, formatDateCourte } from '../utils/format'
import type { Depense, StatsFinancieres, Budget, CategoriDepense } from '../types/finance'
import type { Vehicle }       from '../services/vehicleService'
import type { Mission }       from '../types/mission'

// ─────────────────────────────────────────────────────────────────────────────
// Config couleurs par catégorie
// ─────────────────────────────────────────────────────────────────────────────

const COULEURS_CAT: Record<CategoriDepense, string> = {
  carburant:   '#F59E0B',
  peage:       '#6366F1',
  salaire:     '#10B981',
  maintenance: '#EF4444',
  autre:       '#94A3B8',
}

const LABELS_CAT: Record<CategoriDepense, string> = {
  carburant:   '⛽ Carburant',
  peage:       '🛣 Péage',
  salaire:     '👷 Salaire',
  maintenance: '🔧 Maintenance',
  autre:       '📦 Autre',
}

type Periode = 'mois' | '3mois' | 'annee' | 'custom'

function getPeriodeDates(p: Periode): { debut: string; fin: string } {
  const fin = new Date().toISOString().split('T')[0]
  const now = new Date()
  let debut = fin
  if (p === 'mois')  { const d = new Date(now.getFullYear(), now.getMonth(), 1); debut = d.toISOString().split('T')[0] }
  if (p === '3mois') { debut = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0] }
  if (p === 'annee') { debut = `${now.getFullYear()}-01-01` }
  return { debut, fin }
}

// ─────────────────────────────────────────────────────────────────────────────
// Squelettes de chargement
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonKPI() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="w-10 h-10 bg-slate-200 rounded-xl mb-4" />
      <div className="h-7 bg-slate-200 rounded w-24 mb-1.5" />
      <div className="h-3.5 bg-slate-100 rounded w-32" />
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="animate-pulse space-y-3 px-4 py-2">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="w-24 h-4 bg-slate-200 rounded" />
          <div className="flex-1 h-4 bg-slate-100 rounded" />
          <div className="w-20 h-4 bg-slate-200 rounded" />
          <div className="w-28 h-4 bg-slate-200 rounded" />
          <div className="w-20 h-6 bg-slate-200 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { utilisateur } = useAuth()
  const { confirm, ConfirmModalComponent } = useConfirm()

  const [periode, setPeriode]           = useState<Periode>('mois')
  const [dateDebut, setDateDebut]       = useState('')
  const [dateFin, setDateFin]           = useState('')

  const [stats, setStats]               = useState<StatsFinancieres | null>(null)
  const [budgets, setBudgets]           = useState<Budget[]>([])
  const [depenses, setDepenses]         = useState<Depense[]>([])
  const [totalDepenses, setTotalDepenses] = useState(0)
  const [pageActuelle, setPageActuelle] = useState(1)
  const [totalPages, setTotalPages]     = useState(1)

  const [loadingStats, setLoadingStats]     = useState(true)
  const [loadingDepenses, setLoadingDepenses] = useState(true)

  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [isModalOpen, setIsModalOpen]         = useState(false)
  const [selectedDepense, setSelectedDepense] = useState<Depense | null>(null)

  const [vehicles, setVehicles]   = useState<Vehicle[]>([])
  const [missions, setMissions]   = useState<Mission[]>([])

  // Chargement ressources
  useEffect(() => {
    vehicleService.getVehicles({ limit: 100 }).then(r => setVehicles(r.donnees)).catch(() => {})
    missionService.getMissions({ limit: 100 }).then(r => setMissions(r.donnees)).catch(() => {})
  }, [])

  // Calcul des dates selon la période
  const { debut, fin } = periode !== 'custom'
    ? getPeriodeDates(periode)
    : { debut: dateDebut, fin: dateFin }

  const chargerStats = useCallback(() => {
    if (!debut || !fin) return
    setLoadingStats(true)
    financeService.getStatsFinancieres(debut, fin)
      .then(setStats).catch(() => setStats(null))
      .finally(() => setLoadingStats(false))

    const annee = new Date().getFullYear()
    financeService.getBudgets(undefined, annee).then(setBudgets).catch(() => setBudgets([]))
  }, [debut, fin])

  const chargerDepenses = useCallback(() => {
    setLoadingDepenses(true)
    financeService.getDepenses({
      date_debut: debut || undefined,
      date_fin:   fin   || undefined,
      categorie:  filtreCategorie || undefined,
      page: pageActuelle, limit: 15,
    }).then(r => {
      setDepenses(r.donnees)
      setTotalDepenses(r.pagination.total)
      setTotalPages(r.pagination.totalPages)
    }).catch(() => setDepenses([]))
    .finally(() => setLoadingDepenses(false))
  }, [debut, fin, filtreCategorie, pageActuelle])

  useEffect(() => { chargerStats() },   [chargerStats])
  useEffect(() => { chargerDepenses() }, [chargerDepenses])

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Supprimer la dépense',
      message: 'Voulez-vous vraiment supprimer cette dépense ? Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await financeService.deleteDepense(id)
      toast.success('Dépense supprimée')
      chargerDepenses()
      chargerStats()
    } catch { toast.error('Erreur lors de la suppression') }
  }

  const canDelete = utilisateur?.role === 'admin'
  const canEdit   = utilisateur?.role === 'admin' || utilisateur?.role === 'gestionnaire'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestion financière</h1>
          <p className="text-sm text-slate-500 mt-0.5">Dépenses, budgets et statistiques</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setSelectedDepense(null); setIsModalOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter une dépense
          </button>
        )}
      </div>

      {/* Sélecteur période */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          {([['mois','Ce mois'],['3mois','3 mois'],['annee','Cette année'],['custom','Personnalisé']] as [Periode, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setPeriode(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                periode === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}>{l}
            </button>
          ))}
        </div>
        {periode === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingStats ? (
          <><SkeletonKPI /><SkeletonKPI /><SkeletonKPI /><SkeletonKPI /></>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center text-red-600 mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-slate-800">{formatMGA(stats?.total_depenses)}</p>
              <p className="text-sm text-slate-600 mt-0.5">Total dépenses</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-slate-800">{formatMGA(stats?.cout_moyen_par_mission)}</p>
              <p className="text-sm text-slate-600 mt-0.5">Coût moyen / mission</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-slate-800">{formatMGA(stats?.cout_moyen_par_km)}</p>
              <p className="text-sm text-slate-600 mt-0.5">Coût moyen / km</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalDepenses}</p>
              <p className="text-sm text-slate-600 mt-0.5">Dépenses enregistrées</p>
            </div>
          </>
        )}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dépenses par catégorie */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Dépenses par catégorie</p>
          {loadingStats ? (
            <div className="h-48 bg-slate-100 rounded-lg animate-pulse" />
          ) : stats && stats.par_categorie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.par_categorie} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="categorie" tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickLine={false} axisLine={false}
                  tickFormatter={v => LABELS_CAT[v as CategoriDepense]?.split(' ')[1] || v} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => formatMGA(v as number)} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {stats.par_categorie.map((entry, i) => (
                    <Cell key={i} fill={COULEURS_CAT[entry.categorie as CategoriDepense] || '#94A3B8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">
              Aucune donnée pour cette période
            </div>
          )}
        </div>

        {/* Évolution mensuelle */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Évolution mensuelle</p>
          {loadingStats ? (
            <div className="h-48 bg-slate-100 rounded-lg animate-pulse" />
          ) : stats && stats.par_mois.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.par_mois} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => formatMGA(v as number)} />
                <Line type="monotone" dataKey="total" stroke="#EF4444" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: '#EF4444' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">
              Aucune donnée pour cette période
            </div>
          )}
        </div>

        {/* Top 5 véhicules */}
        {stats && stats.par_vehicule.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 md:col-span-2">
            <p className="text-sm font-semibold text-slate-700 mb-4">Top 5 véhicules les plus coûteux</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.par_vehicule} layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="immatriculation"
                  tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip formatter={(v) => formatMGA(v as number)} />
                <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Budget vs Réel */}
      {budgets.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Budget vs Réel — {new Date().getFullYear()}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Véhicule','Mois','Budget','Réel','Écart','Consommation'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {budgets.map(b => {
                  const reel = 0  // simplifié — comparaison réelle via API
                  const pct  = b.budget_total > 0 ? Math.round((reel / b.budget_total) * 100) : 0
                  const depasse = pct > 100
                  const nomMois = new Date(2000, b.mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{b.immatriculation ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{nomMois}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatMGA(b.budget_total)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatMGA(reel)}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${depasse ? 'text-red-600' : 'text-emerald-600'}`}>
                        {depasse ? '+' : '-'}{formatMGA(Math.abs(b.budget_total - reel))}
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${depasse ? 'bg-red-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 shrink-0">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Liste des dépenses */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Liste des dépenses</h2>
          <select value={filtreCategorie}
            onChange={e => { setFiltreCategorie(e.target.value); setPageActuelle(1) }}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes les catégories</option>
            {(['carburant','peage','salaire','maintenance','autre'] as CategoriDepense[]).map(c => (
              <option key={c} value={c}>{LABELS_CAT[c]}</option>
            ))}
          </select>
        </div>

        {loadingDepenses ? <SkeletonTable /> : depenses.length === 0 ? (
          <EmptyState
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75" />
            </svg>}
            title="Aucune dépense"
            description="Aucune dépense enregistrée pour cette période."
            actionLabel={canEdit ? 'Ajouter une dépense' : undefined}
            onAction={canEdit ? () => setIsModalOpen(true) : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Date','Mission','Véhicule','Catégorie','Montant','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {depenses.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDateCourte(d.date_depense)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {d.lieu_depart ? `${d.lieu_depart} → ${d.lieu_arrivee}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{d.immatriculation || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{
                            background: (COULEURS_CAT[d.categorie] || '#94A3B8') + '22',
                            color: COULEURS_CAT[d.categorie] || '#94A3B8',
                          }}>
                          {LABELS_CAT[d.categorie]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                        {formatMGA(d.montant)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button onClick={() => { setSelectedDepense(d); setIsModalOpen(true) }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                              Modifier
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(d.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium">
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">{totalDepenses} dépenses au total</p>
                <div className="flex items-center gap-2">
                  <button disabled={pageActuelle <= 1}
                    onClick={() => setPageActuelle(p => p - 1)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    ← Préc.
                  </button>
                  <span className="text-xs text-slate-600">{pageActuelle} / {totalPages}</span>
                  <button disabled={pageActuelle >= totalPages}
                    onClick={() => setPageActuelle(p => p + 1)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    Suiv. →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal dépense */}
      <DepenseFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { chargerDepenses(); chargerStats() }}
        initialData={selectedDepense}
        vehicles={vehicles}
        missions={missions as Mission[]}
      />
      {ConfirmModalComponent}
    </div>
  )
}
