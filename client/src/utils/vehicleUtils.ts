/**
 * vehicleUtils.ts
 * Fonctions utilitaires partagées pour l'affichage des données véhicules.
 *
 * Centralisées ici pour éviter la duplication entre VehiclesPage,
 * VehicleDetailPage et tout autre composant affichant des véhicules.
 *
 * Fonctions exportées :
 *   - formatDateFR          → formate une date ISO en français lisible
 *   - calculerJoursRestants → nombre de jours entre aujourd'hui et une date
 *   - getDocumentEtat       → état d'un document (valide / bientôt expirée / expirée)
 *   - getStatutClasses      → classes Tailwind pour le badge de statut véhicule
 *   - getDateClasses        → classes Tailwind pour la couleur d'une date de document
 *   - getTypeLabel          → libellé lisible d'un type de véhicule
 *   - getStatutLabel        → libellé lisible d'un statut véhicule
 */

import type { VehicleStatut } from '../services/vehicleService'

/**
 * formatDateFR
 * Transforme une date ISO (YYYY-MM-DD ou timestamp) en date lisible française.
 * @example formatDateFR('2025-03-15') → "15 mars 2025"
 */
export function formatDateFR(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day:   'numeric',
      month: 'short',
      year:  'numeric',
    })
  } catch {
    return '—'
  }
}

/**
 * calculerJoursRestants
 * Calcule le nombre de jours entre aujourd'hui et la date cible.
 * Retourne un nombre négatif si la date est déjà dépassée.
 * @example calculerJoursRestants('2025-01-01') → -45 (si on est le 15 fév 2025)
 */
export function calculerJoursRestants(dateStr: string): number {
  const today   = new Date()
  const dateCib = new Date(dateStr)
  // On arrondit au jour entier pour éviter les décimales dues aux heures
  return Math.ceil((dateCib.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * getDocumentEtat
 * Détermine l'état d'un document (assurance, visite technique) par rapport à aujourd'hui.
 * - expiree        : date dépassée ou absente
 * - bientot_expiree: expire dans ≤ 30 jours
 * - valide         : expire dans > 30 jours
 */
export function getDocumentEtat(
  dateStr: string | null
): 'valide' | 'bientot_expiree' | 'expiree' {
  if (!dateStr) return 'expiree'
  const jours = calculerJoursRestants(dateStr)
  if (jours < 0)   return 'expiree'
  if (jours <= 30) return 'bientot_expiree'
  return 'valide'
}

/**
 * getStatutClasses
 * Retourne les classes Tailwind pour le badge de statut d'un véhicule.
 */
export function getStatutClasses(statut: VehicleStatut): string {
  switch (statut) {
    case 'actif':       return 'bg-emerald-100 text-emerald-700'
    case 'en_revision': return 'bg-orange-100 text-orange-700'
    case 'archive':     return 'bg-slate-100 text-slate-600'
    default:            return 'bg-slate-100 text-slate-600'
  }
}

/**
 * getDateClasses
 * Retourne les classes Tailwind pour la couleur d'une date de document.
 */
export function getDateClasses(
  etat: 'valide' | 'bientot_expiree' | 'expiree'
): string {
  switch (etat) {
    case 'valide':          return 'text-emerald-600'
    case 'bientot_expiree': return 'text-orange-600'
    case 'expiree':         return 'text-red-600'
    default:                return 'text-slate-600'
  }
}

/**
 * getTypeLabel
 * Retourne le libellé français d'un type de véhicule.
 */
export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    camion:  'Camion',
    citerne: 'Citerne',
    pickup:  'Pickup',
    autre:   'Autre',
  }
  return labels[type] ?? type
}

/**
 * getStatutLabel
 * Retourne le libellé français d'un statut de véhicule.
 */
export function getStatutLabel(statut: VehicleStatut): string {
  const labels: Record<string, string> = {
    actif:       'Actif',
    en_revision: 'En révision',
    archive:     'Archivé',
  }
  return labels[statut] ?? statut
}
