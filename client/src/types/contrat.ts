/**
 * contrat.ts
 * Types TypeScript pour les contrats clients — TransiFlow.
 */

export interface Contrat {
  id:                        number
  client_id:                 number
  client_nom?:               string
  numero:                    string
  titre:                     string
  statut:                    'actif' | 'expire' | 'suspendu' | 'resilie'
  date_debut:                string
  date_fin?:                 string
  tarif_km?:                 number
  tarif_mission?:            number
  conditions_paiement?:      string
  delai_paiement_jours:      number
  remise_pourcentage:        number
  renouvellement_auto:       boolean
  duree_renouvellement_mois: number
  notes?:                    string
  created_at:                string
}
