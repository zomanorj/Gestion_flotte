/**
 * incident.ts
 * Types TypeScript pour les incidents — TransiFlow.
 */

export type TypeIncident = 'panne' | 'accident' | 'vol' | 'infraction' | 'retard' | 'autre'
export type GraviteIncident = 'faible' | 'moyen' | 'grave' | 'critique'
export type StatutIncident = 'ouvert' | 'en_traitement' | 'resolu' | 'clos'

export interface Incident {
  id:               number
  mission_id?:      number | null
  vehicle_id:       number
  driver_id?:       number | null
  type_incident:    TypeIncident
  gravite:          GraviteIncident
  statut:           StatutIncident
  titre:            string
  description?:     string | null
  lieu?:            string | null
  latitude?:        number | null
  longitude?:       number | null
  date_incident:    string
  date_resolution?: string | null
  actions_prises?:  string | null
  cout_reparation?: number | null
  numero_sinistre?: string | null
  declared_by?:     number | null
  resolved_by?:     number | null
  created_at:       string
  updated_at:       string
  // Champs joints
  immatriculation?:   string
  driver_nom?:        string
  driver_prenom?:     string
  driver_tel?:        string
  lieu_depart?:       string
  lieu_arrivee?:      string
  declared_by_nom?:   string
  resolved_by_nom?:   string
}

export const LABELS_TYPE_INCIDENT: Record<TypeIncident, string> = {
  panne:      'Panne',
  accident:   'Accident',
  vol:        'Vol',
  infraction: 'Infraction',
  retard:     'Retard',
  autre:      'Autre',
}

export const LABELS_GRAVITE: Record<GraviteIncident, string> = {
  faible:   'Faible',
  moyen:    'Moyen',
  grave:    'Grave',
  critique: 'Critique',
}

export const LABELS_STATUT_INCIDENT: Record<StatutIncident, string> = {
  ouvert:        'Ouvert',
  en_traitement: 'En traitement',
  resolu:        'Résolu',
  clos:          'Clos',
}

/** Couleurs Tailwind par gravité (bg + text) */
export const COULEURS_GRAVITE: Record<GraviteIncident, string> = {
  faible:   'bg-slate-100 text-slate-700',
  moyen:    'bg-orange-100 text-orange-700',
  grave:    'bg-red-100 text-red-700',
  critique: 'bg-red-900 text-white',
}

/** Couleurs des types pour Recharts */
export const COULEURS_TYPE_INCIDENT: Record<TypeIncident, string> = {
  panne:      '#EF4444',
  accident:   '#F97316',
  vol:        '#8B5CF6',
  infraction: '#EAB308',
  retard:     '#06B6D4',
  autre:      '#94A3B8',
}

export interface IncidentFormData {
  vehicle_id?:    number | null
  driver_id?:     number | null
  mission_id?:    number | null
  type_incident?: TypeIncident | ''
  gravite?:       GraviteIncident | ''
  statut?:        StatutIncident
  titre?:         string
  description?:   string
  lieu?:          string
  date_incident?: string
  numero_sinistre?: string
}

export interface ResoudreIncidentData {
  actions_prises:   string
  cout_reparation:  string
  date_resolution:  string
  remettre_en_service: boolean
}

export interface StatsIncidents {
  total:                         number
  par_type:                      { type: TypeIncident; count: number }[]
  par_gravite:                   { gravite: GraviteIncident; count: number }[]
  par_statut:                    { statut: StatutIncident; count: number }[]
  cout_total_reparations:        number
  taux_resolution:               number
  delai_moyen_resolution_heures: number
}
