/**
 * DashboardPage.tsx
 * Page tableau de bord principal du système Transport STTA.
 *
 * Sprint 2 : connecté aux vraies données de l'API véhicules.
 *   - KPI "Véhicules actifs"   → GET /api/vehicles/count?statut=actif
 *   - KPI "Alertes documents"  → GET /api/vehicles/alertes (nombre total)
 *   - KPI "Chauffeurs"         → placeholder (Sprint 3)
 *   - KPI "Missions du jour"   → placeholder (Sprint 4)
 *   - Section alertes rapides  → liste des 3 premiers véhicules en alerte
 *
 * Chaque KPI charge ses données indépendamment (skeleton par carte, pas de loader global).
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

import { useAuth }                        from '../contexts/AuthContext'
import * as vehicleService                from '../services/vehicleService'
import * as driverService                 from '../services/driverService'
import type { VehicleAvecAlerte }         from '../services/vehicleService'
import { formatDateFR, getDocumentEtat, calculerJoursRestants }  from '../utils/vehicleUtils'

// ─────────────────────────────────────────────────────────────────────────────
// Icônes SVG des KPI (inchangées depuis Sprint 1)
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

function IcMission() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006
           V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0
           L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695
           V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0
           l4.994 2.497c.317.158.69.158 1.006 0z" />
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

// Badge "Sprint X" pour les KPIs pas encore connectés
function BadgeSprint({ numero }: { numero: number }) {
  return (
    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full shrink-0">
      Sprint {numero}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant SectionAlertesRapides — bloc en dessous des KPIs
// ─────────────────────────────────────────────────────────────────────────────

interface SectionAlertesProps {
  alertes:   VehicleAvecAlerte[]
  isLoading: boolean
}

function SectionAlertesRapides({ alertes, isLoading }: SectionAlertesProps) {
  // On n'affiche que les 3 premières alertes
  const alertesAffichees = alertes.slice(0, 3)

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

  if (alertes.length === 0) {
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
            {alertes.length}
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
        {alertesAffichees.map((vehicleAlerte) => {
          // Calculer le document le plus urgent à afficher
          const etatAssurance = getDocumentEtat(vehicleAlerte.date_assurance)
          const etatVisite    = getDocumentEtat(vehicleAlerte.date_visite_technique)

          // Déterminer quel document est le plus problématique
          const documentProbleme =
            etatAssurance === 'expiree'         ? { label: 'Assurance expirée',         urgent: true }
          : etatVisite    === 'expiree'         ? { label: 'Visite technique expirée',   urgent: true }
          : etatAssurance === 'bientot_expiree' ? { label: 'Assurance bientôt expirée',  urgent: false }
          :                                       { label: 'Visite technique bientôt expirée', urgent: false }

          // Trouver la date la plus proche pour l'échéance
          const dateRef = etatAssurance !== 'valide'
            ? vehicleAlerte.date_assurance
            : vehicleAlerte.date_visite_technique

          const joursRestants = dateRef ? calculerJoursRestants(dateRef) : null

          return (
            <Link
              key={vehicleAlerte.id}
              to={`/vehicles/${vehicleAlerte.id}`}
              className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors group"
            >
              {/* Immatriculation */}
              <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors w-28 shrink-0">
                {vehicleAlerte.immatriculation}
              </span>

              {/* Type de problème */}
              <span className="text-sm text-slate-500 flex-1 px-4">
                {documentProbleme.label}
              </span>

              {/* Jours restants */}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                documentProbleme.urgent
                  ? 'bg-red-100 text-red-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {joursRestants === null
                  ? '—'
                  : joursRestants < 0
                    ? `${Math.abs(joursRestants)}j dépassé`
                    : `${joursRestants}j restants`
                }
              </span>
            </Link>
          )
        })}
      </div>

      {/* Footer si plus de 3 alertes */}
      {alertes.length > 3 && (
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
          <Link to="/vehicles" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            + {alertes.length - 3} autre{alertes.length - 3 > 1 ? 's' : ''} alerte{alertes.length - 3 > 1 ? 's' : ''}
          </Link>
        </div>
      )}
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

  // ── État : alertes documents ──
  const [alertes,              setAlertes]              = useState<VehicleAvecAlerte[]>([])
  const [nbAlertes,            setNbAlertes]            = useState<number | null>(null)
  const [loadingAlertes,       setLoadingAlertes]       = useState(true)

  // ── État : chauffeurs actifs ──
  const [nbChauffeursActifs,   setNbChauffeursActifs]   = useState<number | null>(null)
  const [loadingChauffeurs,    setLoadingChauffeurs]    = useState(true)

  // ── Chargement indépendant de chaque KPI ──

  useEffect(() => {
    // KPI 1 : nombre de véhicules actifs
    vehicleService.countVehicles('actif')
      .then(reponse => setNbVehiculesActifs(reponse.donnees.total))
      .catch(() => setNbVehiculesActifs(0))
      .finally(() => setLoadingVehicules(false))
  }, [])

  useEffect(() => {
    // KPI 2 : alertes documents + liste pour la section rapide
    vehicleService.getAlertes()
      .then(reponse => {
        setNbAlertes(reponse.resume.total)
        setAlertes(reponse.donnees)
      })
      .catch(() => {
        setNbAlertes(0)
        setAlertes([])
      })
      .finally(() => setLoadingAlertes(false))
  }, [])

  useEffect(() => {
    // KPI 3 : nombre de chauffeurs actifs
    driverService.countDrivers('actif')
      .then(reponse => setNbChauffeursActifs(reponse.donnees.total))
      .catch(() => setNbChauffeursActifs(0))
      .finally(() => setLoadingChauffeurs(false))
  }, [])

  // ── Données d'affichage ──
  const prenom         = utilisateur?.nom.split(' ')[0] ?? 'utilisateur'
  const dateAujourdhui = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  })

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

          {/* KPI 2 : Alertes documents (données réelles) */}
          <CarteKPI
            libelle="Alertes documents"
            valeur={nbAlertes !== null ? String(nbAlertes) : '—'}
            icone={<IcAlerte />}
            couleurFond={nbAlertes && nbAlertes > 0 ? 'bg-orange-50' : 'bg-slate-50'}
            couleurIcone={nbAlertes && nbAlertes > 0 ? 'text-orange-500' : 'text-slate-400'}
            description="Assurances, visites"
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

          {/* KPI 4 : Missions du jour — TODO Sprint 4 */}
          <CarteKPI
            libelle="Missions du jour"
            valeur="—"
            icone={<IcMission />}
            couleurFond="bg-purple-50"
            couleurIcone="text-purple-600"
            description="Planifiées et en cours"
            badge={<BadgeSprint numero={4} />}
          />
        </div>
      </section>

      {/* ── Section alertes rapides ── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Alertes documents
        </h2>
        <SectionAlertesRapides
          alertes={alertes}
          isLoading={loadingAlertes}
        />
      </section>

    </div>
  )
}
