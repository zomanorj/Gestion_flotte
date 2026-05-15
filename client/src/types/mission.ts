/**
 * mission.ts
 * Types TypeScript pour la gestion des missions — TransiFlow.
 *
 * Ce module définit toutes les interfaces et types utilisés
 * pour la manipulation des données de missions.
 */

import type { Vehicle } from '../services/vehicleService'
import type { Driver } from './driver'

// ─────────────────────────────────────────────────────────────────────────────
// Types de base
// ─────────────────────────────────────────────────────────────────────────────

/** Statuts possibles d'une mission */
export type MissionStatut = 'brouillon' | 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

/** Transitions de statut autorisées */
export const WORKFLOW_STATUT: Record<MissionStatut, MissionStatut[]> = {
  'brouillon':   ['planifiee', 'annulee'],
  'planifiee':   ['en_cours', 'annulee'],
  'en_cours':    ['terminee'],
  'terminee':    [],
  'annulee':     [],
}

/** Couleurs des statuts pour l'affichage */
export const STATUT_COLORS: Record<MissionStatut, string> = {
  'brouillon':  'bg-slate-100 text-slate-700',
  'planifiee':  'bg-blue-100 text-blue-700',
  'en_cours':   'bg-orange-100 text-orange-700',
  'terminee':   'bg-emerald-100 text-emerald-700',
  'annulee':    'bg-red-100 text-red-700',
}

/** Labels des statuts pour l'affichage */
export const STATUT_LABELS: Record<MissionStatut, string> = {
  'brouillon':  'Brouillon',
  'planifiee':  'Planifiée',
  'en_cours':   'En cours',
  'terminee':   'Terminée',
  'annulee':    'Annulée',
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface principale d'une mission
// ─────────────────────────────────────────────────────────────────────────────

/** Interface principale d'une mission */
export interface Mission {
  id:                    number
  vehicle_id:            number
  driver_id:             number
  vehicle?:              Vehicle | null
  driver?:               Driver | null
  lieu_depart:           string
  lieu_arrivee:          string
  date_mission:          string        // Format YYYY-MM-DD
  heure_depart?:         string | null // Format HH:MM
  heure_arrivee_prevue?: string | null // Format HH:MM
  chargement?:           string | null
  poids_tonne?:          number | null
  distance_km?:          number | null
  statut:                MissionStatut
  notes?:                string | null
  created_by?:           number | null
  created_at:            string
  updated_at:            string
}

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres de filtrage
// ─────────────────────────────────────────────────────────────────────────────

/** Paramètres de filtrage pour la liste des missions */
export interface MissionFilters {
  page?:       number
  limit?:      number
  search?:     string
  statut?:     MissionStatut | 'tous' | ''
  date?:       string
  vehicle_id?: number
  driver_id?:  number
}

// ─────────────────────────────────────────────────────────────────────────────
// Réponses API
// ─────────────────────────────────────────────────────────────────────────────

/** Réponse paginée de l'API pour la liste des missions */
export interface MissionListResponse {
  succes: boolean
  donnees: Mission[]
  pagination: {
    page:        number
    limit:       number
    total:       number
    totalPages:  number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

/** Réponse de l'API pour une mission unique */
export interface MissionDetailResponse {
  succes: boolean
  message?: string
  donnees: Mission
}

/** Réponse de l'API pour les statistiques */
export interface MissionStatsResponse {
  succes: boolean
  donnees: {
    total:      number
    parStatut:  Record<MissionStatut, number>
    aujourdhui: number
  }
}

/** Réponse de comptage */
export interface MissionCountResponse {
  succes: boolean
  donnees: { total: number }
}

/** Réponse en cas de conflit */
export interface MissionConflitResponse {
  succes:  boolean
  message: string
  conflits: {
    vehicle: { mission_id: number; trajet: string } | null
    driver:  { mission_id: number; trajet: string } | null
  }
  messages: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Données de formulaire
// ─────────────────────────────────────────────────────────────────────────────

/** Données pour créer ou modifier une mission */
export interface MissionFormData {
  vehicle_id:            number | null
  driver_id:             number | null
  lieu_depart:           string
  lieu_arrivee:          string
  date_mission:          string
  heure_depart?:         string | null
  heure_arrivee_prevue?: string | null
  chargement?:           string | null
  poids_tonne?:          number | null
  distance_km?:          number | null
  statut?:               MissionStatut
  notes?:                string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Villes principales de Madagascar (pour les suggestions)
// ─────────────────────────────────────────────────────────────────────────────

export const VILLES_PRINCIPALES = [
  'Antananarivo',
  'Toamasina',
  'Mahajanga',
  'Fianarantsoa',
  'Toliary',
  'Antsiranana',
  'Antsirabe',
]