/**
 * DashboardPage.tsx
 * Page tableau de bord principal du système Transport STTA.
 *
 * Sprint 2 : connecté aux vraies données de l'API véhicules.
 *   - KPI "Véhicules actifs"   → GET /api/vehicles/count?statut=actif
 *   - KPI "Alertes documents"  → GET /api/vehicles/alertes + GET /api/drivers/alertes
 *   - KPI "Chauffeurs"         → GET /api/drivers/count?statut=actif
 *   - KPI "Missions du jour"   → GET /api/missions/planning?date=[date]
 *   - Section alertes rapides  → liste mixte véhicules + chauffeurs (max 5)
 *   - Section missions en cours → GET /api/missions?statut=en_cours&limit=4
 *
 * Chaque KPI charge ses données indépendamment (skeleton par carte, pas de loader global).
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

import { useAuth }                        from '../contexts/AuthContext'
import * as vehicleService                from '../services/vehicleService'
import * as driverService                 from '../services/driverService'
import * as missionService                from '../services/missionService'
import type { VehicleAvecAlerte }         from '../services/vehicleService'
import type { DriverAvecAlerte }          from '../types/driver'
import type { Mission }                   from '../types/mission'
import { getDocumentEtat, calculerJoursRestants }  from '../utils/vehicleUtils'

// ─────────────────────────────────────────────────────────────────────────────
// Icônes SVG des KPI
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
  couleurFond:  string       // Classe Tailwind (ex: "bg-blue-50")
  couleurIcone: string       // Classe Tailwind (ex: "text-blue-600")
  description?: string
  isLoading?:   boolean
  onClick?:     () => void   // Rend la carte cliquable (ex: alertes → /vehicles)
  badge?:       React.ReactNode  // Badge optionnel en haut à droite
}

function CarteKPI({
  libelle, valeur, icone, couleurFond, couleurIcone,
  description, isLoading, onClick, badge,
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
        {/* Icône colorée */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${couleurFond} ${couleurIcone}`}>
          {icone}
        </div>
        {/* Badge optionnel (ex: "Todo Sprint 3") */}
        {badge}
      </div>

      {/* Valeur numérique */}
      <p className="text-3xl font-bold text-slate-800 mb-1">{valeur}</p>

      {/* Libellé */}
      <p className="text-sm font-medium text-slate-600">{libelle}</p>

      {/* Sous-texte */}
      {description && (
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      )}
    </Wrapper>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Type unifié pour les alertes (véhicules + chauffeurs)
// ─────────────────────────────────────────────────────────────────────────────

interface AlerteUnifiee {
  type:        'vehicule' | 'chauffeur'
  id:          number
  libelle:     string        // Immatriculation ou nom complet
  message:     string        // Description du problème
  joursRestants: number | null
  urgent:      boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant SectionAlertesRapides — bloc en dessous des KPIs
// ─────────────────────────────────────────────────────────────────────────────

interface SectionAlertesProps {
  alertesUnifiees: AlerteUnifiee[]
  isLoading:       boolean
}

function SectionAlertesRapides({ alertesUnifiees, isLoading }: SectionAlertesProps) {
  // On trie par urgence (moins de jours restants en premier)
  const alertesTrie = [...alertesUnifiees].sort((a, b) => {
    if (a.joursRestants === null) return 1
    if (b.joursRestants === null) return -1
    return a.joursRestants - b.joursRestants
  })

  // On n'affiche que les 5 premières alertes
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
      {/* Header */}
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
        <Link
          to="/vehicles"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          Voir tout →
        </Link>
      </div>

      {/* Liste des alertes */}
      <div className="divide-y divide-slate-50">
        {alertesAffichees.map((alerte) => (
          <Link
            key={`${alerte.type}-${alerte.id}`}
            to={alerte.type === 'vehicule' ? `/vehicles/${alerte.id}` : `/drivers/${alerte.id}`}
            className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors group"
          >
            {/* Icône + Libellé */}
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

            {/* Type de problème */}
            <span className="text-sm text-slate-500 flex-1 px-4">
              {alerte.message}
            </span>

            {/* Jours restants */}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
              alerte.urgent
                ? 'bg-red-100 text-red-700'
                : 'bg-orange-100 text-orange-700'
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

      {/* Footer si plus de 5 alertes */}
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
// Composant SectionMissionsEnCours — liste des missions en cours
// ─────────────────────────────────────────────────────────────────────────────

interface SectionMissionsEnCoursProps {
  missions: Mission[]
  isLoading: boolean
}

// Composant skeleton pour une ligne de mission
function SkeletonLigneMission() {
  return (
    <div className="flex items-center gap-3 py-3 animate-pulse">
      <div className="w-16 h-4 bg-slate-200 rounded" />
      <div className="flex-1 h-4 bg-slate-100 rounded" />
      <div className="w-20 h-6 bg-slate-200 rounded-full" />
    </div>
  )
}

function SectionMissionsEnCours({ missions, isLoading }: SectionMissionsEnCoursProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Missions en cours</h2>
            <div className="w-6 h-5 bg-slate-200 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="divide-y divide-slate-50">
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
        <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-emerald-800">
          Aucune mission en cours pour le moment
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Missions en cours</h2>
          <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
            {missions.length}
          </span>
        </div>
        <Link
          to="/missions?statut=en_cours"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          Voir toutes les missions →
        </Link>
      </div>

      {/* Liste des missions */}
      <div className="divide-y divide-slate-50">
        {missions.slice(0, 4).map((mission) => {
          const immatriculation = mission.vehicle?.immatriculation ?? 'N/A'
          const chauffeurNom = mission.driver
            ? `${mission.driver.prenom} ${mission.driver.nom}`
            : 'Non assigné'
          const initiales = mission.driver
            ? `${mission.driver.prenom[0]}${mission.driver.nom[0]}`.toUpperCase()
            : 'NA'

          return (
            <Link
              key={mission.id}
              to={`/missions/${mission.id}`}
              className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50 transition-colors group"
            >
              {/* Référence mission */}
              <span className="text-xs font-medium text-slate-400 w-14 shrink-0">
                #{String(mission.id).padStart(4, '0')}
              </span>

              {/* Trajet avec flèche */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800 group-hover:text-blue-700 transition-colors">
                  <span className="truncate">{mission.lieu_depart}</span>
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <span className="truncate">{mission.lieu_arrivee}</span>
                </div>
              </div>

              {/* Avatar chauffeur + nom */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold">
                  {initiales}
                </div>
                <span className="text-xs text-slate-500 hidden sm:block max-w-[80px] truncate">
                  {chauffeurNom}
                </span>
              </div>

              {/* Immatriculation véhicule */}
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded shrink-0 hidden md:inline-block">
                {immatriculation}
              </span>

              {/* Heure de départ */}
              {mission.heure_depart && (
                <span className="text-xs text-slate-400 shrink-0 hidden lg:block">
                  {mission.heure_depart}
                </span>
              )}
            </Link>
          )
        })}
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

  // ── État : véhicules actifs ──
  const [nbVehiculesActifs,    setNbVehiculesActifs]    = useState<number | null>(null)
  const [loadingVehicules,     setLoadingVehicules]     = useState(true)

  // ── État : alertes documents véhicules ──
  const [alertesVehicules,     setAlertesVehicules]     = useState<VehicleAvecAlerte[]>([])
  const [nbAlertesVehicules,   setNbAlertesVehicules]   = useState<number | null>(null)
  const [loadingAlertesVehicules, setLoadingAlertesVehicules] = useState(true)

  // ── État : alertes permis chauffeurs ──
  const [alertesPermis,        setAlertesPermis]        = useState<DriverAvecAlerte[]>([])
  const [nbAlertesPermis,      setNbAlertesPermis]      = useState<number | null>(null)
  const [loadingAlertesPermis, setLoadingAlertesPermis] = useState(true)

  // ── État : chauffeurs actifs ──
  const [nbChauffeursActifs,   setNbChauffeursActifs]   = useState<number | null>(null)
  const [loadingChauffeurs,    setLoadingChauffeurs]    = useState(true)

  // ── État : missions du jour ──
  const [nbMissionsJour,       setNbMissionsJour]       = useState<number | null>(null)
  const [loadingMissionsJour,  setLoadingMissionsJour]  = useState(true)

  // ── État : missions en cours ──
  const [missionsEnCours,      setMissionsEnCours]      = useState<Mission[]>([])
  const [loadingMissionsEnCours, setLoadingMissionsEnCours] = useState(true)

  // ── Chargement indépendant de chaque KPI ──

  useEffect(() => {
    // KPI 1 : nombre de véhicules actifs
    vehicleService.countVehicles('actif')
      .then(reponse => setNbVehiculesActifs(reponse.donnees.total))
      .catch(() => setNbVehiculesActifs(0))
      .finally(() => setLoadingVehicules(false))
  }, [])

  useEffect(() => {
    // KPI 2 : alertes documents véhicules
    vehicleService.getAlertes()
      .then(reponse => {
        setNbAlertesVehicules(reponse.resume.total)
        setAlertesVehicules(reponse.donnees)
      })
      .catch(() => {
        setNbAlertesVehicules(0)
        setAlertesVehicules([])
      })
      .finally(() => setLoadingAlertesVehicules(false))
  }, [])

  useEffect(() => {
    // Alertes permis chauffeurs
    driverService.getPermisAlertes()
      .then(reponse => {
        setNbAlertesPermis(reponse.resume.total)
        setAlertesPermis(reponse.donnees)
      })
      .catch(() => {
        setNbAlertesPermis(0)
        setAlertesPermis([])
      })
      .finally(() => setLoadingAlertesPermis(false))
  }, [])

  useEffect(() => {
    // KPI 3 : nombre de chauffeurs actifs
    driverService.countDrivers('actif')
      .then(reponse => setNbChauffeursActifs(reponse.donnees.total))
      .catch(() => setNbChauffeursActifs(0))
      .finally(() => setLoadingChauffeurs(false))
  }, [])

  useEffect(() => {
    // KPI 4 : missions du jour
    const dateAujourdhui = new Date().toISOString().split('T')[0]
    missionService.getMissionsByDate(dateAujourdhui)
      .then(reponse => setNbMissionsJour(reponse.donnees.length))
      .catch(() => setNbMissionsJour(0))
      .finally(() => setLoadingMissionsJour(false))
  }, [])

  useEffect(() => {
    // Missions en cours (max 4)
    missionService.getMissions({ statut: 'en_cours', limit: 4 })
      .then(reponse => setMissionsEnCours(reponse.donnees))
      .catch(() => setMissionsEnCours([]))
      .finally(() => setLoadingMissionsEnCours(false))
  }, [])

  // ── Calcul du nombre total d'alertes (véhicules + permis) ──
  const nbTotalAlertes = (nbAlertesVehicules ?? 0) + (nbAlertesPermis ?? 0)

  // ── Fusion des alertes pour la section rapide ──
  const alertesUnifiees: AlerteUnifiee[] = [
    // Alertes véhicules
    ...alertesVehicules.map((v) => {
      const etatAssurance = getDocumentEtat(v.date_assurance)
      const etatVisite    = getDocumentEtat(v.date_visite_technique)

      // Déterminer le problème le plus urgent
      let message = ''
      let dateRef: string | null = null
      if (etatAssurance === 'expiree') {
        message = 'Assurance expirée'
        dateRef = v.date_assurance
      } else if (etatVisite === 'expiree') {
        message = 'Visite technique expirée'
        dateRef = v.date_visite_technique
      } else if (etatAssurance === 'bientot_expiree') {
        message = 'Assurance expire dans X jours'
        dateRef = v.date_assurance
      } else if (etatVisite === 'bientot_expiree') {
        message = 'Visite technique expire dans X jours'
        dateRef = v.date_visite_technique
      }

      const joursRestants = dateRef ? calculerJoursRestants(dateRef) : null

      // Remplacer "X" par le nombre de jours si message contient "X jours"
      if (message.includes('X jours') && joursRestants !== null) {
        message = message.replace('X jours', `${joursRestants} jours`)
      }

      return {
        type: 'vehicule' as const,
        id: v.id,
        libelle: v.immatriculation,
        message,
        joursRestants,
        urgent: etatAssurance === 'expiree' || etatVisite === 'expiree',
      }
    }),
    // Alertes permis chauffeurs
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
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  })

  // État de chargement global pour la section alertes (les deux API doivent être chargées)
  const loadingAlertes = loadingAlertesVehicules || loadingAlertesPermis

  return (
    <div className="space-y-6">

      {/* ── En-tête de bienvenue ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Bonjour, {prenom} 👋
          </h1>
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

      {/* ── Grille des KPI (chaque carte charge indépendamment) ── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Vue d'ensemble
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* KPI 1 : Véhicules actifs (données réelles) */}
          <CarteKPI
            libelle="Véhicules actifs"
            valeur={nbVehiculesActifs !== null ? String(nbVehiculesActifs) : '—'}
            icone={<IcVehicule />}
            couleurFond="bg-blue-50"
            couleurIcone="text-blue-600"
            description="Flotte disponible"
            isLoading={loadingVehicules}
            onClick={() => navigate('/vehicles')}
          />

          {/* KPI 2 : Alertes documents (véhicules + permis chauffeurs) */}
          <CarteKPI
            libelle="Alertes documents"
            valeur={nbTotalAlertes !== null ? String(nbTotalAlertes) : '—'}
            icone={<IcAlerte />}
            couleurFond={nbTotalAlertes > 0 ? 'bg-orange-50' : 'bg-slate-50'}
            couleurIcone={nbTotalAlertes > 0 ? 'text-orange-500' : 'text-slate-400'}
            description={`${nbAlertesVehicules ?? 0} véhicules · ${nbAlertesPermis ?? 0} permis`}
            isLoading={loadingAlertes}
            onClick={() => navigate('/vehicles')}
          />

          {/* KPI 3 : Chauffeurs actifs (données réelles) */}
          <CarteKPI
            libelle="Chauffeurs actifs"
            valeur={nbChauffeursActifs !== null ? String(nbChauffeursActifs) : '—'}
            icone={<IcChauffeur />}
            couleurFond="bg-emerald-50"
            couleurIcone="text-emerald-600"
            description="Prêts à être affectés"
            isLoading={loadingChauffeurs}
            onClick={() => navigate('/drivers')}
          />

          {/* KPI 4 : Missions du jour (données réelles) */}
          <CarteKPI
            libelle="Missions du jour"
            valeur={nbMissionsJour !== null ? String(nbMissionsJour) : '—'}
            icone={<IcRoute />}
            couleurFond="bg-green-50"
            couleurIcone="text-green-600"
            description="Planifiées et en cours"
            isLoading={loadingMissionsJour}
            onClick={() => navigate('/missions')}
          />
        </div>
      </section>

      {/* ── Section missions en cours ── */}
      <section>
        <SectionMissionsEnCours
          missions={missionsEnCours}
          isLoading={loadingMissionsEnCours}
        />
      </section>

      {/* ── Section alertes rapides ── */}
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