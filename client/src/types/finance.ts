/**
 * finance.ts
 * Types TypeScript pour la gestion financière — TransiFlow.
 */

export type CategoriDepense = 'carburant' | 'peage' | 'salaire' | 'maintenance' | 'autre'

export interface Depense {
  id:               number
  mission_id?:      number | null
  vehicle_id?:      number | null
  categorie:        CategoriDepense
  montant:          number
  devise:           string
  description?:     string | null
  date_depense:     string
  justificatif_url?: string | null
  created_by?:      number | null
  created_at:       string
  // Champs joints
  lieu_depart?:     string
  lieu_arrivee?:    string
  immatriculation?: string
  created_by_nom?:  string
}

export interface Budget {
  id?:                number
  vehicle_id:         number
  mois:               number
  annee:              number
  budget_carburant:   number
  budget_maintenance: number
  budget_total:       number
  immatriculation?:   string
}

export interface StatsFinancieres {
  total_depenses:        number
  par_categorie:         { categorie: string; total: number }[]
  par_vehicule:          { immatriculation: string; total: number }[]
  par_mois:              { mois: string; total: number }[]
  cout_moyen_par_km:     number
  cout_moyen_par_mission: number
}

export interface CoutMission {
  par_categorie: { categorie: string; total: number }[]
  total_general: number
}

export interface ComparaisonBudget {
  budget:      number
  reel:        number
  ecart:       number
  pourcentage: number
}

export interface DepenseFormData {
  mission_id?:      number | null
  vehicle_id?:      number | null
  categorie:        CategoriDepense | ''
  montant:          string
  devise:           string
  description:      string
  date_depense:     string
  justificatif_url?: string
}
