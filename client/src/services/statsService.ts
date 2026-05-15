/**
 * statsService.ts
 * Service de communication avec l'API pour les statistiques — Transport STTA.
 *
 * Ce module centralise tous les appels HTTP vers les endpoints statistiques.
 *
 * Fonctions exportées :
 *   - getDashboardStats()     → GET /api/stats/dashboard
 *   - getMissionStats(params) → GET /api/stats/missions?date_debut=X&date_fin=Y
 *   - getFleetStats()         → GET /api/stats/flotte
 */

import apiClient from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Types TypeScript
// ─────────────────────────────────────────────────────────────────────────────

/** Statistiques complètes pour le tableau de bord */
export interface DashboardStats {
  vehicules: {
    total:             number
    actifs:            number
    en_revision:       number
    alertes_documents: number
  }
  chauffeurs: {
    total:           number
    actifs:          number
    en_conge:        number
    alertes_permis:  number
  }
  missions: {
    total:               number
    aujourd_hui:         number
    en_cours:            number
    cette_semaine:       number
    terminees_ce_mois:   number
    taux_ponctualite:    number
  }
  alertes_total: number
}

/** Statistiques détaillées des missions sur une période */
export interface MissionStats {
  missions_par_jour:       { date: string; count: number }[]
  missions_par_statut:     { statut: string; count: number }[]
  top_trajets:             { trajet: string; count: number }[]
  missions_par_semaine:    { semaine: string; count: number }[]
  total_km_parcourus:      number
  total_tonnes_transportees: number
}

/** Statistiques de la flotte de véhicules */
export interface FleetStats {
  vehicules_par_type:  { type: string; count: number }[]
  utilisation_flotte:  number
  km_par_vehicule:     { immatriculation: string; km: number }[]
}

/** Paramètres de filtrage pour getMissionStats */
export interface MissionStatsParams {
  date_debut?: string
  date_fin?:   string
}

/** Structure de réponse API générique pour les stats */
interface StatsResponse<T> {
  succes:  boolean
  donnees: T
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions du service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getDashboardStats
 * Récupère en un seul appel toutes les statistiques nécessaires au tableau de bord :
 * compteurs véhicules, chauffeurs, missions du jour et alertes.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<StatsResponse<DashboardStats>>('/api/stats/dashboard')
  return data.donnees
}

/**
 * getMissionStats
 * Récupère les statistiques détaillées des missions sur une période donnée.
 * Par défaut : les 30 derniers jours si aucun paramètre n'est fourni.
 */
export async function getMissionStats(params: MissionStatsParams = {}): Promise<MissionStats> {
  const searchParams = new URLSearchParams()
  if (params.date_debut) searchParams.set('date_debut', params.date_debut)
  if (params.date_fin)   searchParams.set('date_fin', params.date_fin)

  const queryString = searchParams.toString()
  const url = `/api/stats/missions${queryString ? `?${queryString}` : ''}`

  const { data } = await apiClient.get<StatsResponse<MissionStats>>(url)
  return data.donnees
}

/**
 * getFleetStats
 * Récupère les statistiques de la flotte : répartition par type,
 * taux d'utilisation et kilométrage par véhicule.
 */
export async function getFleetStats(): Promise<FleetStats> {
  const { data } = await apiClient.get<StatsResponse<FleetStats>>('/api/stats/flotte')
  return data.donnees
}
