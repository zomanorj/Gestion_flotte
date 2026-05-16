/**
 * driver.ts
 * Types TypeScript pour la gestion des chauffeurs — TransiFlow.
 *
 * Ce module définit toutes les interfaces et types utilisés
 * pour la manipulation des données de chauffeurs.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types de base
// ─────────────────────────────────────────────────────────────────────────────

/** Statuts possibles d'un chauffeur */
export type DriverStatut = 'actif' | 'en_conge' | 'inactif'

/** État du permis de conduire */
export type PermisEtat = 'valide' | 'bientot_expire' | 'expire'

// ─────────────────────────────────────────────────────────────────────────────
// Interface principale d'un chauffeur
// ─────────────────────────────────────────────────────────────────────────────

/** Interface principale d'un chauffeur */
export interface Driver {
  id:                     number
  user_id?:               number
  nom:                    string
  prenom:                 string
  telephone:              string
  numero_permis:          string
  date_expiration_permis: string        // Format YYYY-MM-DD
  statut:                 DriverStatut
  photo_url?:             string | null
  date_embauche?:         string | null // Format YYYY-MM-DD
  notes?:                 string | null
  salaire_base?:          number | null
  prime_mission?:         number | null
  created_at:             string
  updated_at:             string
}

/** Chauffeur avec état du permis (pour les alertes) */
export interface DriverAvecAlerte extends Driver {
  etat_permis:    PermisEtat
  message_permis: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres de filtrage
// ─────────────────────────────────────────────────────────────────────────────

/** Paramètres de filtrage pour la liste des chauffeurs */
export interface DriverFilters {
  page?:    number
  limit?:   number
  search?:  string
  statut?:  DriverStatut | 'tous' | ''
}

// ─────────────────────────────────────────────────────────────────────────────
// Réponses API
// ─────────────────────────────────────────────────────────────────────────────

/** Réponse paginée de l'API pour la liste des chauffeurs */
export interface DriverListResponse {
  succes: boolean
  donnees: Driver[]
  pagination: {
    page:        number
    limit:       number
    total:       number
    totalPages:  number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

/** Réponse de l'API pour les alertes permis */
export interface DriverAlertesResponse {
  succes: boolean
  donnees: DriverAvecAlerte[]
  resume: {
    total:            number
    expires:          number
    bientotExpires:   number
  }
}

/** Réponse de l'API pour un chauffeur unique */
export interface DriverDetailResponse {
  succes: boolean
  message?: string
  donnees: Driver
}

/** Réponse de comptage */
export interface DriverCountResponse {
  succes: boolean
  donnees: { total: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Données de formulaire
// ─────────────────────────────────────────────────────────────────────────────

/** Données pour créer ou modifier un chauffeur */
export interface DriverFormData {
  nom:                    string
  prenom:                 string
  telephone?:             string
  numero_permis:          string
  date_expiration_permis: string
  statut?:                DriverStatut
  photo_url?:             string
  date_embauche?:         string
  notes?:                 string
}

// ─────────────────────────────────────────────────────────────────────────────
// Missions (pour la page détail)
// ─────────────────────────────────────────────────────────────────────────────

/** Statuts possibles d'une mission */
export type MissionStatut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

/** Interface d'une mission */
export interface Mission {
  id:            number
  vehicle_id:    number
  driver_id:     number
  lieu_depart:   string
  lieu_arrivee:  string
  date_mission:  string
  chargement?:   string | null
  statut:        MissionStatut
  created_at:    string
}

/** Réponse API pour la liste des missions */
export interface MissionListResponse {
  succes: boolean
  donnees: Mission[]
  pagination?: {
    page:        number
    limit:       number
    total:       number
    totalPages:  number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}