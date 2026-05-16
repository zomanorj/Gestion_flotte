/**
 * DashboardLayout.tsx
 * Layout principal de l'application avec sidebar fixe et zone de contenu.
 *
 * Structure :
 *   ┌──────────┬─────────────────────────────────────┐
 *   │          │ Header (breadcrumb | user info)      │
 *   │ Sidebar  ├─────────────────────────────────────┤
 *   │ (240px)  │                                     │
 *   │          │   <Outlet /> → contenu de la page   │
 *   │          │                                     │
 *   └──────────┴─────────────────────────────────────┘
 *
 * Responsive :
 *   - Desktop (lg+) : sidebar fixe toujours visible
 *   - Mobile       : sidebar masquée, révélée par le bouton hamburger
 */

import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as corbeilleService from '../services/corbeilleService'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration de la navigation
// ─────────────────────────────────────────────────────────────────────────────

interface ItemNavigation {
  libelle:        string
  chemin:         string
  icone:          React.ReactNode
  rolesAutorises?: string[]  // Si absent : visible par tous
}

/** Tableau de bord */
function IcDashboard() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6
           a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18
           a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18
           A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z
           M13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25
           h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}

/** Flotte / véhicules */
function IcCamion() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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

/** Chauffeurs */
function IcChauffeur() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z
           M4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75
           c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

/** Missions */
function IcMission() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006
           V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0
           L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695
           V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0
           l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  )
}

/** Suivi GPS */
function IcSuivi() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5
           a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

/** Documents */
function IcDocuments() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125
           v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125
           v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25
           a9 9 0 00-9-9z" />
    </svg>
  )
}

/** Finance */
function IcFinance() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
    </svg>
  )
}

/** Maintenance */
function IcMaintenance() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877
           M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17
           l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63
           m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336
           l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276
           a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95
           l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  )
}

/** Incidents */
function IcIncidents() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
           c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0
           L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

/** Rapports & Exports */
function IcRapports() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75
           C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z
           M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25
           c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z
           M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75
           c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

/** Clients */
function IcClients() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6.75h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12.25" />
    </svg>
  )
}

/** Factures */
function IcFactures() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

/** Corbeille */
function IcCorbeille() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166
           m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0
           01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562
           c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916
           c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09
           1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

/** Utilisateurs */
function IcUtilisateurs() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952
           4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07
           M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766
           l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0
           3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0
           015.25 0z" />
    </svg>
  )
}

/** Journal d'activité */
function IcActivite() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0
           1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25
           2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125
           C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6V7.5z" />
    </svg>
  )
}

/** Salaires */
function IcSalaires() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const NAVIGATION: ItemNavigation[] = [
  { libelle: 'Tableau de bord', chemin: '/',          icone: <IcDashboard /> },
  { libelle: 'Flotte',          chemin: '/vehicles',  icone: <IcCamion />    },
  { libelle: 'Chauffeurs',      chemin: '/drivers',   icone: <IcChauffeur /> },
  { libelle: 'Missions',        chemin: '/missions',  icone: <IcMission />   },
  { libelle: 'Suivi',           chemin: '/suivi',     icone: <IcSuivi />     },
  { libelle: 'Documents',       chemin: '/documents', icone: <IcDocuments /> },
  // Rapports : visible uniquement pour admin et gestionnaire
  {
    libelle:        'Rapports',
    chemin:         '/rapports',
    icone:          <IcRapports />,
    rolesAutorises: ['admin', 'gestionnaire'],
  },
  // Finance, Maintenance, Incidents — Sprint 7
  { libelle: 'Finance',      chemin: '/finance',     icone: <IcFinance />     },
  { libelle: 'Maintenance',  chemin: '/maintenance', icone: <IcMaintenance /> },
  { libelle: 'Incidents',    chemin: '/incidents',   icone: <IcIncidents />   },
  // Clients et Facturation
  { libelle: 'Clients',      chemin: '/clients',     icone: <IcClients />     },
  { libelle: 'Factures',     chemin: '/factures',    icone: <IcFactures />    },
  {
    libelle:        'Salaires',
    chemin:         '/salaires',
    icone:          <IcSalaires />,
    rolesAutorises: ['admin'],
  },
  {
    libelle:        'Corbeille',
    chemin:         '/corbeille',
    icone:          <IcCorbeille />,
    rolesAutorises: ['admin'],
  },
  // Sprint 9 : gestion des utilisateurs + journal d'activité
  {
    libelle:        'Utilisateurs',
    chemin:         '/utilisateurs',
    icone:          <IcUtilisateurs />,
    rolesAutorises: ['admin'],
  },
  {
    libelle:        'Activité',
    chemin:         '/activite',
    icone:          <IcActivite />,
    rolesAutorises: ['admin'],
  },
]

// Labels des chemins pour le breadcrumb
const LABELS_CHEMINS: Record<string, string> = {
  '/':          'Tableau de bord',
  '/vehicles':  'Flotte',
  '/drivers':   'Chauffeurs',
  '/missions':  'Missions',
  '/suivi':     'Suivi',
  '/documents': 'Documents',
  '/rapports':    'Rapports & Exports',
  '/finance':     'Finance',
  '/maintenance': 'Maintenance',
  '/incidents':   'Incidents',
  '/clients':     'Clients',
  '/factures':    'Factures',
  '/salaires':    'Salaires',
  '/corbeille':     'Corbeille',
  '/utilisateurs':  'Utilisateurs',
  '/activite':      'Journal d\'activité',
  '/profil':        'Mon profil',
}

// Labels des rôles en français
const LABELS_ROLES: Record<string, string> = {
  admin:        'Administrateur',
  gestionnaire: 'Gestionnaire',
  chauffeur:    'Chauffeur',
}

// Couleurs des badges de rôle
const COULEURS_BADGE_ROLE: Record<string, string> = {
  admin:        'bg-red-100 text-red-700',
  gestionnaire: 'bg-blue-100 text-blue-700',
  chauffeur:    'bg-green-100 text-green-700',
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant Sidebar
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProps {
  onFermer: () => void
}

function Sidebar({ onFermer }: SidebarProps) {
  const { utilisateur, logout } = useAuth()
  const navigate = useNavigate()

  // Compteur corbeille — badge rouge si éléments présents
  const [corbeilleCount, setCorbeilleCount] = useState(0)

  useEffect(() => {
    corbeilleService.getCount()
      .then(data => setCorbeilleCount(data.total ?? 0))
      .catch(() => {})
  }, [])

  /** Calcule les initiales du nom (ex: "Rakoto Jean" → "RJ") */
  const initialesUtilisateur = utilisateur?.nom
    .split(' ')
    .map((mot) => mot[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  const handleDeconnexion = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        <div className="w-9 h-9 bg-blue-800 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
          ST
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-800 text-sm leading-tight truncate">TransiFlow</p>
          <p className="text-xs text-slate-400 truncate">TransiFlow Madagascar</p>
        </div>
        {/* Bouton fermer (mobile uniquement) */}
        <button
          onClick={onFermer}
          className="ml-auto text-slate-400 hover:text-slate-600 lg:hidden"
          aria-label="Fermer la navigation"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {NAVIGATION
          // Filtrer les items restreints selon le rôle de l'utilisateur
          .filter(item =>
            !item.rolesAutorises ||
            item.rolesAutorises.includes(utilisateur?.role ?? '')
          )
          .map((item) => (
            <NavLink
              key={item.chemin}
              to={item.chemin}
              // end=true pour "/" : actif seulement sur / exact, pas sur /vehicules etc.
              end={item.chemin === '/'}
              onClick={onFermer}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group
                 ${isActive
                   ? 'bg-blue-50 text-blue-800'
                   : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Barre verticale bleue pour l'item actif */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-800 rounded-r-full" />
                  )}
                  <span className={isActive ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-600'}>
                    {item.icone}
                  </span>
                  <span className="flex-1">{item.libelle}</span>
                  {/* Badge rouge corbeille si des éléments sont présents */}
                  {item.chemin === '/corbeille' && corbeilleCount > 0 && (
                    <span className="text-[11px] font-semibold bg-red-600 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                      {corbeilleCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))
        }
      </nav>

      {/* ── Profil utilisateur + Déconnexion ── */}
      <div className="border-t border-slate-100 p-3 space-y-1">
        {/* Carte profil — cliquable vers /profil */}
        <Link
          to="/profil"
          onClick={onFermer}
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
        >
          {/* Avatar initiales */}
          <div className="w-8 h-8 bg-blue-800 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initialesUtilisateur}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-700 transition-colors">
              {utilisateur?.nom}
            </p>
            {/* Badge rôle */}
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
              COULEURS_BADGE_ROLE[utilisateur?.role ?? 'gestionnaire']
            }`}>
              {LABELS_ROLES[utilisateur?.role ?? 'gestionnaire']}
            </span>
          </div>
          <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        {/* Bouton déconnexion */}
        <button
          onClick={handleDeconnexion}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5
                 A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Déconnexion
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────────────────────────────────────

function DashboardLayout() {
  const { utilisateur } = useAuth()
  const location = useLocation()

  // Contrôle de visibilité de la sidebar sur mobile
  const [sidebarVisible, setSidebarVisible] = useState(false)

  // Libellé de la page courante pour le breadcrumb
  const libellePageCourante = LABELS_CHEMINS[location.pathname] ?? 'Page'

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Overlay backdrop (mobile) — ferme la sidebar au clic ── */}
      {sidebarVisible && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarVisible(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      {/* Mobile : positionnée en fixed, translate pour l'animation
          Desktop (lg+) : statique, toujours visible */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60
          transform transition-transform duration-300 ease-in-out
          ${sidebarVisible ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:translate-x-0 lg:shrink-0
        `}
        aria-label="Navigation principale"
      >
        <Sidebar onFermer={() => setSidebarVisible(false)} />
      </aside>

      {/* ── Zone principale : header + contenu ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3.5 flex items-center gap-4 shrink-0">

          {/* Bouton hamburger (mobile uniquement) */}
          <button
            onClick={() => setSidebarVisible(true)}
            className="text-slate-500 hover:text-slate-700 lg:hidden transition-colors"
            aria-label="Ouvrir la navigation"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-slate-500 flex-1 min-w-0">
            <span className="truncate">TransiFlow</span>
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="font-medium text-slate-800 truncate">{libellePageCourante}</span>
          </nav>

          {/* Infos utilisateur (droite) */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-slate-600 hidden sm:block">{utilisateur?.nom}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium hidden sm:inline-block ${
              COULEURS_BADGE_ROLE[utilisateur?.role ?? 'gestionnaire']
            }`}>
              {LABELS_ROLES[utilisateur?.role ?? 'gestionnaire']}
            </span>
          </div>
        </header>

        {/* Contenu de la page (rendu par <Outlet />) */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
