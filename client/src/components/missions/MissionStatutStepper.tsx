/**
 * MissionStatutStepper.tsx
 * Composant visuel du workflow de statut d'une mission — TransiFlow.
 *
 * Affiche une timeline horizontale avec les 4 étapes principales :
 *   Brouillon → Planifiée → En cours → Terminée
 *                        ↘ Annulée
 *
 * Props :
 *   - statut: le statut actuel de la mission
 *   - onStatutChange: callback pour changer le statut (optionnel)
 *   - canEdit: si l'utilisateur peut modifier le statut
 */

import { useState } from 'react'
import type { MissionStatut } from '../../types/mission'
import { STATUT_LABELS, WORKFLOW_STATUT } from '../../types/mission'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration visuelle des étapes
// ─────────────────────────────────────────────────────────────────────────────

interface StepConfig {
  key: MissionStatut
  label: string
  icon: React.ReactNode
}

const STEPS: StepConfig[] = [
  {
    key: 'brouillon',
    label: 'Brouillon',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.862 4.489l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    ),
  },
  {
    key: 'planifiee',
    label: 'Planifiée',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    key: 'en_cours',
    label: 'En cours',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'terminee',
    label: 'Terminée',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Styles par statut
// ─────────────────────────────────────────────────────────────────────────────

function getStepStyles(status: MissionStatut, currentIndex: number, currentStatusIndex: number) {
  const isCompleted = currentIndex < currentStatusIndex
  const isCurrent = currentIndex === currentStatusIndex
  const isAnnulee = status === 'annulee'

  if (isAnnulee && currentIndex > 0) {
    // Pour une mission annulée, seule l'étape brouillon est active
    return {
      circle: 'bg-slate-100 text-slate-400 border-slate-200',
      line: 'bg-slate-100',
      label: 'text-slate-400',
    }
  }

  if (isCompleted) {
    return {
      circle: 'bg-emerald-100 text-emerald-600 border-emerald-200',
      line: 'bg-emerald-400',
      label: 'text-emerald-700 font-medium',
    }
  }

  if (isCurrent) {
    return {
      circle: 'bg-blue-100 text-blue-600 border-blue-300 ring-2 ring-blue-100',
      line: 'bg-slate-200',
      label: 'text-blue-700 font-semibold',
    }
  }

  return {
    circle: 'bg-white text-slate-400 border-slate-200',
    line: 'bg-slate-200',
    label: 'text-slate-400',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface des props
// ─────────────────────────────────────────────────────────────────────────────

interface MissionStatutStepperProps {
  statut: MissionStatut
  onStatutChange?: (nouveauStatut: MissionStatut) => void
  canEdit?: boolean
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function MissionStatutStepper({
  statut,
  onStatutChange,
  canEdit = false,
  className = '',
}: MissionStatutStepperProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingStatut, setPendingStatut] = useState<MissionStatut | null>(null)

  // Cas spécial : mission annulée
  if (statut === 'annulee') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-red-700">Annulée</span>
        </div>
        <div className="flex-1 h-1 bg-red-200 rounded-full" />
        <div className="flex items-center gap-2 opacity-50">
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200">
            <span className="text-xs">✓</span>
          </div>
          <span className="text-sm text-slate-400">Terminée (non atteinte)</span>
        </div>
      </div>
    )
  }

  // Trouver l'index du statut actuel
  const currentStatusIndex = STEPS.findIndex(s => s.key === statut)

  // Transitions autorisées depuis le statut actuel
  const transitionsAutorisees = WORKFLOW_STATUT[statut] || []

  // Bouton d'action contextuel
  const getActionButton = () => {
    if (!canEdit || !onStatutChange) return null

    const nextStatut = transitionsAutorisees.find(s => s !== 'annulee')

    if (!nextStatut) return null

    const buttonLabels: Record<string, string> = {
      'brouillon': 'Planifier',
      'planifiee': 'Démarrer',
      'en_cours': 'Marquer terminée',
    }

    return (
      <button
        onClick={() => {
          setPendingStatut(nextStatut)
          setShowConfirmDialog(true)
        }}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        {buttonLabels[statut] || 'Étape suivante'}
      </button>
    )
  }

  // Bouton annuler
  const getCancelButton = () => {
    if (!canEdit || !onStatutChange) return null
    if (statut === 'terminee') return null

    return (
      <button
        onClick={() => {
          setPendingStatut('annulee')
          setShowConfirmDialog(true)
        }}
        className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Annuler la mission
      </button>
    )
  }

  const handleConfirmStatutChange = () => {
    if (pendingStatut && onStatutChange) {
      onStatutChange(pendingStatut)
    }
    setShowConfirmDialog(false)
    setPendingStatut(null)
  }

  return (
    <div className={`${className}`}>
      {/* Timeline horizontale */}
      <div className="flex items-center">
        {STEPS.map((step, index) => {
          const styles = getStepStyles(statut, index, currentStatusIndex)
          const isLast = index === STEPS.length - 1

          return (
            <div key={step.key} className="flex items-center">
              {/* Étape */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${styles.circle}`}>
                  {index < currentStatusIndex ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    step.icon
                  )}
                </div>
                <span className={`text-xs whitespace-nowrap ${styles.label}`}>
                  {step.label}
                </span>
              </div>

              {/* Ligne de connexion */}
              {!isLast && (
                <div className={`w-12 md:w-20 h-1 mx-2 rounded-full ${styles.line}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Boutons d'action */}
      {(canEdit || onStatutChange) && (
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
          {getActionButton()}
          {getCancelButton()}
        </div>
      )}

      {/* Dialog de confirmation */}
      {showConfirmDialog && pendingStatut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowConfirmDialog(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                pendingStatut === 'annulee' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {pendingStatut === 'annulee' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">
                  {pendingStatut === 'annulee' ? 'Annuler la mission' : 'Confirmer le changement'}
                </h3>
                <p className="text-sm text-slate-500">
                  {pendingStatut === 'annulee'
                    ? 'Cette action est irréversible.'
                    : `Passer au statut "${STATUT_LABELS[pendingStatut]}" ?`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmStatutChange}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  pendingStatut === 'annulee'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}