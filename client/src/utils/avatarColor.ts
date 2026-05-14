/**
 * avatarColor.ts
 * Utilitaire pour générer des couleurs d'avatar basées sur un nom — Transport STTA.
 *
 * Ce module génère une couleur consistente pour un chauffeur donné
 * en se basant sur son nom. La même entrée produit toujours la même couleur.
 *
 * Utilisation :
 *   const color = getAvatarColor('Jean Dupont')
 *   // Retourne une couleur Tailwind comme 'bg-blue-500'
 */

// Palette de couleurs Tailwind pour les avatars
const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
]

// Couleurs de texte correspondantes (toujours blanc pour le contraste)
const TEXT_COLORS = [
  'text-white',
]

/**
 * getAvatarColor
 * Génère une couleur d'avatar basée sur le nom d'un chauffeur.
 * Utilise un hash simple pour assurer la consistance.
 *
 * @param nom - Le nom complet du chauffeur
 * @returns Un objet avec la couleur de fond et la couleur de texte
 */
export function getAvatarColor(nom: string): { bg: string; text: string } {
  // Calcul d'un hash simple basé sur les caractères du nom
  let hash = 0
  for (let i = 0; i < nom.length; i++) {
    hash = nom.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Conversion en index positif
  const index = Math.abs(hash) % AVATAR_COLORS.length

  return {
    bg: AVATAR_COLORS[index],
    text: TEXT_COLORS[index % TEXT_COLORS.length],
  }
}

/**
 * getInitials
 * Extrait les initiales d'un nom complet.
 *
 * @param prenom - Le prénom du chauffeur
 * @param nom - Le nom du chauffeur
 * @returns Les initiales en majuscules (ex: "JD" pour "Jean Dupont")
 */
export function getInitials(prenom: string, nom: string): string {
  const p = prenom?.trim() || ''
  const n = nom?.trim() || ''

  const firstInitial = p.charAt(0).toUpperCase()
  const lastInitial = n.charAt(0).toUpperCase()

  return firstInitial + lastInitial
}

/**
 * getPermisBadgeClasses
 * Retourne les classes Tailwind pour le badge de statut du permis.
 *
 * @param dateExpiration - La date d'expiration du permis (YYYY-MM-DD)
 * @returns Les classes CSS pour le badge
 */
export function getPermisBadgeClasses(dateExpiration: string): string {
  if (!dateExpiration) return 'bg-slate-100 text-slate-600'

  const aujourdHui = new Date()
  const expiration = new Date(dateExpiration)
  const diffJours = Math.ceil((expiration.getTime() - aujourdHui.getTime()) / (1000 * 60 * 60 * 24))

  if (diffJours < 0) {
    // Permis expiré
    return 'bg-red-100 text-red-700'
  } else if (diffJours <= 30) {
    // Permis expirant bientôt
    return 'bg-orange-100 text-orange-700'
  } else {
    // Permis valide
    return 'bg-green-100 text-green-700'
  }
}

/**
 * getPermisLabel
 * Retourne le libellé pour le statut du permis.
 *
 * @param dateExpiration - La date d'expiration du permis (YYYY-MM-DD)
 * @returns Le libellé du statut
 */
export function getPermisLabel(dateExpiration: string): string {
  if (!dateExpiration) return 'Non renseigné'

  const aujourdHui = new Date()
  const expiration = new Date(dateExpiration)
  const diffJours = Math.ceil((expiration.getTime() - aujourdHui.getTime()) / (1000 * 60 * 60 * 24))

  if (diffJours < 0) {
    return `Expiré depuis ${Math.abs(diffJours)}j`
  } else if (diffJours <= 30) {
    return `${diffJours}j restants`
  } else {
    return `${diffJours}j restants`
  }
}

/**
 * getStatutClasses
 * Retourne les classes Tailwind pour le badge de statut du chauffeur.
 *
 * @param statut - Le statut du chauffeur
 * @returns Les classes CSS pour le badge
 */
export function getStatutClasses(statut: string): string {
  switch (statut) {
    case 'actif':
      return 'bg-green-100 text-green-700'
    case 'en_conge':
      return 'bg-blue-100 text-blue-700'
    case 'inactif':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

/**
 * getStatutLabel
 * Retourne le libellé lisible pour un statut de chauffeur.
 *
 * @param statut - Le statut du chauffeur
 * @returns Le libellé lisible
 */
export function getStatutLabel(statut: string): string {
  switch (statut) {
    case 'actif':
      return 'Actif'
    case 'en_conge':
      return 'En congé'
    case 'inactif':
      return 'Inactif'
    default:
      return statut
  }
}

/**
 * formatDateFR
 * Formate une date au format français (JJ/MM/AAAA).
 *
 * @param dateStr - La date au format YYYY-MM-DD
 * @returns La date formatée en français
 */
export function formatDateFR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}