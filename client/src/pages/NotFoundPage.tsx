/**
 * NotFoundPage.tsx
 * Page 404 — Transport STTA.
 *
 * Affichée quand l'utilisateur accède à une URL inexistante.
 * Design sobre avec un SVG camion stylisé et un bouton de retour.
 */

import { useNavigate } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// SVG camion avec point d'interrogation
// ─────────────────────────────────────────────────────────────────────────────

function SvgCamionInconnu() {
  return (
    <svg
      width="120"
      height="80"
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-slate-300"
    >
      {/* Carrosserie du camion */}
      <rect x="5" y="20" width="70" height="40" rx="4" fill="currentColor" />
      {/* Cabine */}
      <rect x="75" y="30" width="35" height="30" rx="4" fill="currentColor" />
      {/* Pare-brise */}
      <rect x="82" y="34" width="20" height="14" rx="2" fill="white" fillOpacity="0.6" />
      {/* Roue avant */}
      <circle cx="90" cy="62" r="9" fill="#94A3B8" />
      <circle cx="90" cy="62" r="4" fill="white" fillOpacity="0.5" />
      {/* Roue arrière */}
      <circle cx="25" cy="62" r="9" fill="#94A3B8" />
      <circle cx="25" cy="62" r="4" fill="white" fillOpacity="0.5" />
      {/* Roue milieu */}
      <circle cx="55" cy="62" r="9" fill="#94A3B8" />
      <circle cx="55" cy="62" r="4" fill="white" fillOpacity="0.5" />
      {/* Point d'interrogation */}
      <text x="30" y="45" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">?</text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">

      {/* Numéro 404 géant */}
      <p className="text-[72px] font-black leading-none text-slate-200 select-none mb-2">
        404
      </p>

      {/* Illustration SVG */}
      <div className="mb-6">
        <SvgCamionInconnu />
      </div>

      {/* Titre */}
      <h1 className="text-xl font-bold text-slate-700 mb-2">
        Page introuvable
      </h1>

      {/* Sous-titre */}
      <p className="text-sm text-slate-500 text-center max-w-sm mb-8">
        La page que vous cherchez n'existe pas ou a été déplacée.
        Vérifiez l'URL ou revenez au tableau de bord.
      </p>

      {/* Bouton principal */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-150 mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Retour au tableau de bord
      </button>

      {/* Lien secondaire */}
      <a
        href="mailto:support@stta.mg"
        className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        Signaler un problème
      </a>
    </div>
  )
}
