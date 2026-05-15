/**
 * format.ts
 * Fonctions utilitaires de formatage — TransiFlow.
 */

/**
 * formatMGA
 * Formate un montant en ariary malgache.
 * Ex : 150000 → "150 000 MGA"
 */
export function formatMGA(montant: number | string | null | undefined): string {
  if (montant === null || montant === undefined) return '—'
  const n = typeof montant === 'string' ? parseFloat(montant) : montant
  if (isNaN(n)) return '—'
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MGA`
}

/**
 * formatDateFR
 * Formate une date ISO en date française courte.
 * Ex : "2025-05-15" → "15 mai 2025"
 */
export function formatDateFR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/**
 * formatDateCourte
 * Ex : "2025-05-15" → "15/05/2025"
 */
export function formatDateCourte(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

/**
 * formatMois
 * Formate un numéro de mois en label français.
 * Ex : 5 → "Mai"
 */
export function formatMois(mois: number): string {
  return new Date(2000, mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })
}
