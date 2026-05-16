/**
 * CorbeillePage.tsx
 * Page de gestion des éléments supprimés (soft-delete) — TransiFlow.
 *
 * Fonctionnalités prévues :
 *   - Lister les véhicules, chauffeurs et missions avec deleted_at non nul
 *   - Restaurer un élément (reset deleted_at à NULL)
 *   - Suppression définitive (DELETE réel en base)
 *
 * Accès : admin uniquement (visible uniquement dans la sidebar admin)
 */

import { useNavigate } from 'react-router-dom'
import { useAuth }      from '../contexts/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

export default function CorbeillePage() {
  usePageTitle('Corbeille')

  const { utilisateur } = useAuth()
  const navigate        = useNavigate()

  // Redirection si l'utilisateur n'est pas admin
  if (utilisateur && utilisateur.role !== 'admin') {
    navigate('/')
    return null
  }

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Corbeille</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Éléments supprimés — restaurables ou à supprimer définitivement
          </p>
        </div>
      </div>

      {/* ── Contenu placeholder ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">

        {/* Icône poubelle */}
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166
                 m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0
                 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562
                 c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916
                 c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09
                 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </div>

        <p className="text-base font-medium text-slate-700 mb-2">Corbeille vide</p>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          Les véhicules, chauffeurs et missions supprimés apparaîtront ici.
          Vous pourrez les restaurer ou les supprimer définitivement.
        </p>

        {/* Mention fonctionnalité à venir */}
        <p className="mt-6 text-xs text-slate-300 font-mono">
          Fonctionnalité en cours de développement — Sprint 9
        </p>
      </div>
    </div>
  )
}
