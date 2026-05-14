/**
 * DashboardPage.tsx
 * Page tableau de bord principal du système Transport STTA.
 *
 * Affiche :
 *   - Un message de bienvenue personnalisé avec le prénom de l'utilisateur
 *   - 4 cartes KPI avec icônes colorées (à connecter à l'API au Sprint 4)
 *   - Un indicateur visuel que les données seront disponibles prochainement
 */

import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

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

function IcMission() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006
           V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0
           L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695
           V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0
           l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  )
}

function IcAlerte() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7
           V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31
           m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant CarteKPI
// ─────────────────────────────────────────────────────────────────────────────

interface CarteKPIProps {
  libelle:      string    // Ex: "Véhicules actifs"
  valeur:       string    // "—" jusqu'à connexion à l'API
  icone:        ReactNode
  couleurFond:  string    // Classe Tailwind pour le fond de l'icône (ex: "bg-blue-100")
  couleurIcone: string    // Classe Tailwind pour la couleur de l'icône (ex: "text-blue-600")
  description?: string    // Sous-texte optionnel sous la valeur
}

function CarteKPI({ libelle, valeur, icone, couleurFond, couleurIcone, description }: CarteKPIProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow duration-150">
      <div className="flex items-start justify-between mb-4">
        {/* Icône dans un cercle coloré */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${couleurFond} ${couleurIcone}`}>
          {icone}
        </div>
        {/* Indicateur "bientôt disponible" */}
        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
          Sprint 4
        </span>
      </div>

      {/* Valeur numérique principale */}
      <p className="text-3xl font-bold text-slate-800 mb-1">{valeur}</p>

      {/* Libellé */}
      <p className="text-sm font-medium text-slate-600">{libelle}</p>

      {/* Sous-texte optionnel */}
      {description && (
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Données des cartes KPI (statiques pour l'instant — Sprint 4 : appel API)
// ─────────────────────────────────────────────────────────────────────────────

const CARTES_KPI: CarteKPIProps[] = [
  {
    libelle:      'Véhicules actifs',
    valeur:       '—',
    icone:        <IcVehicule />,
    couleurFond:  'bg-blue-50',
    couleurIcone: 'text-blue-600',
    description:  'Flotte disponible ce jour',
  },
  {
    libelle:      'Chauffeurs disponibles',
    valeur:       '—',
    icone:        <IcChauffeur />,
    couleurFond:  'bg-emerald-50',
    couleurIcone: 'text-emerald-600',
    description:  'Prêts à être affectés',
  },
  {
    libelle:      'Missions du jour',
    valeur:       '—',
    icone:        <IcMission />,
    couleurFond:  'bg-orange-50',
    couleurIcone: 'text-orange-500',
    description:  'Planifiées et en cours',
  },
  {
    libelle:      'Alertes actives',
    valeur:       '—',
    icone:        <IcAlerte />,
    couleurFond:  'bg-red-50',
    couleurIcone: 'text-red-500',
    description:  'Permis, assurances expirés',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { utilisateur } = useAuth()

  // Extraction du prénom (premier mot du nom complet)
  const prenom = utilisateur?.nom.split(' ')[0] ?? 'utilisateur'

  // Date du jour formatée en français
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

        {/* Bouton d'action rapide */}
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-800 text-white text-sm font-medium rounded-lg hover:bg-blue-900 transition-colors duration-150">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle mission
        </button>
      </div>

      {/* ── Grille des KPI ── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Vue d'ensemble
        </h2>
        {/* 2 colonnes sur mobile, 4 sur desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CARTES_KPI.map((carte) => (
            <CarteKPI key={carte.libelle} {...carte} />
          ))}
        </div>
      </section>

      {/* ── Bannière informative ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836
                 a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z
                 m-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-800">Sprint 1 — Authentification opérationnelle</p>
          <p className="text-sm text-blue-600 mt-0.5">
            Les données de la flotte, des chauffeurs et des missions seront disponibles
            aux sprints 2, 3 et 4. L'interface est prête à les accueillir.
          </p>
        </div>
      </div>

    </div>
  )
}

export default DashboardPage
