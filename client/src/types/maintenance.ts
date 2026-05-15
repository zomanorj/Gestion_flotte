/**
 * maintenance.ts
 * Types TypeScript pour la maintenance préventive — TransiFlow.
 */

export type TypeMaintenance = 'revision' | 'vidange' | 'pneus' | 'freins' | 'courroie' | 'filtres' | 'autre'
export type StatutMaintenance = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

export interface Maintenance {
  id:                        number
  vehicle_id:                number
  immatriculation?:          string
  km_actuel?:                number
  type_maintenance:          TypeMaintenance
  statut:                    StatutMaintenance
  date_planifiee?:           string | null
  date_realisee?:            string | null
  kilometrage_planifie?:     number | null
  kilometrage_realise?:      number | null
  cout?:                     number | null
  garage?:                   string | null
  description?:              string | null
  pieces_changees?:          string | null  // JSON string
  prochaine_maintenance_km?:   number | null
  prochaine_maintenance_date?: string | null
  created_by?:               number | null
  created_by_nom?:           string
  created_at:                string
  updated_at:                string
}

/** Intervalles recommandés par type */
export const INTERVALLES_MAINTENANCE: Record<TypeMaintenance, { km: number; mois: number }> = {
  revision: { km: 10000, mois: 6  },
  vidange:  { km: 5000,  mois: 3  },
  pneus:    { km: 40000, mois: 24 },
  freins:   { km: 30000, mois: 18 },
  courroie: { km: 60000, mois: 48 },
  filtres:  { km: 15000, mois: 12 },
  autre:    { km: 10000, mois: 6  },
}

export const LABELS_TYPE_MAINTENANCE: Record<TypeMaintenance, string> = {
  revision: 'Révision générale',
  vidange:  'Vidange',
  pneus:    'Changement de pneus',
  freins:   'Freins',
  courroie: 'Courroie de distribution',
  filtres:  'Filtres',
  autre:    'Autre',
}

export const LABELS_STATUT_MAINTENANCE: Record<StatutMaintenance, string> = {
  planifiee: 'Planifiée',
  en_cours:  'En cours',
  terminee:  'Terminée',
  annulee:   'Annulée',
}

export interface MaintenanceFormData {
  vehicle_id?:           number | null
  type_maintenance?:     TypeMaintenance | ''
  statut?:               StatutMaintenance
  date_planifiee?:       string
  kilometrage_planifie?: string
  garage?:               string
  description?:          string
}

export interface TerminerMaintenanceData {
  date_realisee:           string
  cout:                    string
  kilometrage_realise:     string
  pieces_changees:         string[]
  garage:                  string
  prochaine_maintenance_km: string
  prochaine_maintenance_date: string
  planifier_prochaine:     boolean
}
