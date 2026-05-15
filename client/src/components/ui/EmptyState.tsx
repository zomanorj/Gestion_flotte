/**
 * EmptyState.tsx
 * Composant réutilisable pour afficher un état vide — Transport STTA.
 *
 * Utilisé sur toutes les pages de liste quand aucune donnée n'est disponible
 * ou quand une recherche ne retourne aucun résultat.
 *
 * Props :
 *   - icon        : nœud React (icône SVG)
 *   - title       : titre principal de l'état vide
 *   - description : sous-texte explicatif
 *   - actionLabel : label du bouton d'action (optionnel)
 *   - onAction    : handler du bouton (optionnel)
 */

import type { ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon:         ReactNode
  title:        string
  description:  string
  actionLabel?: string
  onAction?:    () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant EmptyState
// ─────────────────────────────────────────────────────────────────────────────

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">

      {/* Icône */}
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-5">
        {icon}
      </div>

      {/* Titre */}
      <h3 className="text-base font-semibold text-slate-700 mb-1.5">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
        {description}
      </p>

      {/* Bouton d'action optionnel */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-150"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
