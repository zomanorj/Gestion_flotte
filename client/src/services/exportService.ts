/**
 * exportService.ts
 * Service de communication avec l'API pour l'export de données Excel — Transport STTA.
 *
 * Ce module gère le téléchargement des fichiers Excel (.xlsx) :
 *   - Export des missions avec filtres optionnels
 *   - Export de la liste complète des véhicules
 *   - Export de la liste complète des chauffeurs
 *
 * Fonctions exportées :
 *   - exportMissions(params)  → GET /api/export/missions → missions-[debut]-[fin].xlsx
 *   - exportVehicules()       → GET /api/export/vehicules → vehicules-[date].xlsx
 *   - exportChauffeurs()      → GET /api/export/chauffeurs → chauffeurs-[date].xlsx
 */

import apiClient from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Paramètres optionnels pour l'export des missions */
export interface ExportMissionsParams {
  date_debut?: string
  date_fin?:   string
  statut?:     string
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaire privé
// ─────────────────────────────────────────────────────────────────────────────

/**
 * triggerDownload
 * Crée un lien temporaire dans le DOM pour déclencher le téléchargement d'un blob.
 * Nettoie l'URL objet après usage pour éviter les fuites mémoire.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions du service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * exportMissions
 * Télécharge un fichier Excel contenant la liste des missions avec filtres optionnels.
 * Le fichier est nommé : missions-[date_debut]-[date_fin].xlsx
 */
export async function exportMissions(params: ExportMissionsParams = {}): Promise<void> {
  const searchParams = new URLSearchParams()
  if (params.date_debut) searchParams.set('date_debut', params.date_debut)
  if (params.date_fin)   searchParams.set('date_fin', params.date_fin)
  if (params.statut)     searchParams.set('statut', params.statut)

  const queryString = searchParams.toString()
  const url = `/api/export/missions${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get(url, { responseType: 'blob' })

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Nom du fichier basé sur la période exportée
  const dateDebut = params.date_debut ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const dateFin   = params.date_fin   ?? new Date().toISOString().split('T')[0]
  triggerDownload(blob, `missions-${dateDebut}-${dateFin}.xlsx`)
}

/**
 * exportVehicules
 * Télécharge un fichier Excel contenant la liste complète des véhicules.
 * Le fichier est nommé : vehicules-[date_aujourd_hui].xlsx
 */
export async function exportVehicules(): Promise<void> {
  const response = await apiClient.get('/api/export/vehicules', { responseType: 'blob' })

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const dateAujourdhui = new Date().toISOString().split('T')[0]
  triggerDownload(blob, `vehicules-${dateAujourdhui}.xlsx`)
}

/**
 * exportChauffeurs
 * Télécharge un fichier Excel contenant la liste complète des chauffeurs.
 * Le fichier est nommé : chauffeurs-[date_aujourd_hui].xlsx
 */
export async function exportChauffeurs(): Promise<void> {
  const response = await apiClient.get('/api/export/chauffeurs', { responseType: 'blob' })

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const dateAujourdhui = new Date().toISOString().split('T')[0]
  triggerDownload(blob, `chauffeurs-${dateAujourdhui}.xlsx`)
}
