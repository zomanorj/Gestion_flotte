/**
 * documentService.ts
 * Service de communication avec l'API pour la génération de documents PDF — Transport STTA.
 *
 * Ce module gère le téléchargement des documents PDF :
 *   - Bons de livraison
 *   - Rapports de missions
 *
 * Fonctions exportées :
 *   - downloadBonLivraison(missionId)    → Télécharge le bon de livraison
 *   - downloadRapportMissions(params)    → Télécharge un rapport de missions
 */

import apiClient from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RapportParams {
  date_debut: string
  date_fin: string
  statut?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions du service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * downloadBonLivraison
 * Télécharge le bon de livraison d'une mission.
 * Le fichier est nommé : BL-[missionId]-[date].pdf
 */
export async function downloadBonLivraison(missionId: number): Promise<void> {
  const response = await apiClient.get(`/api/documents/bon-livraison/${missionId}`, {
    responseType: 'blob',
  })

  // Créer un blob à partir de la réponse
  const blob = new Blob([response.data], { type: 'application/pdf' })

  // Récupérer le nom de fichier depuis l'en-tête Content-Disposition
  const contentDisposition = response.headers['content-disposition']
  let filename = `BL-${missionId}.pdf`

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/)
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1]
    }
  }

  // Créer un lien temporaire et déclencher le téléchargement
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()

  // Nettoyer
  link.remove()
  window.URL.revokeObjectURL(url)
}

/**
 * downloadRapportMissions
 * Télécharge un rapport PDF des missions sur une période.
 * Le fichier est nommé : rapport-missions-[date_debut]-[date_fin].pdf
 */
export async function downloadRapportMissions(params: RapportParams): Promise<void> {
  const response = await apiClient.get('/api/documents/rapport-missions', {
    params,
    responseType: 'blob',
  })

  // Créer un blob à partir de la réponse
  const blob = new Blob([response.data], { type: 'application/pdf' })

  // Récupérer le nom de fichier depuis l'en-tête Content-Disposition
  const contentDisposition = response.headers['content-disposition']
  let filename = `rapport-missions-${params.date_debut}-${params.date_fin}.pdf`

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/)
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1]
    }
  }

  // Créer un lien temporaire et déclencher le téléchargement
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()

  // Nettoyer
  link.remove()
  window.URL.revokeObjectURL(url)
}