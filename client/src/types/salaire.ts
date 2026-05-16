/**
 * Types TypeScript — module Salaires / primes chauffeurs (TransiFlow).
 *
 * Alignés sur le schéma PostgreSQL (`type_salaire`, `mois_concerne`, etc.).
 * Les libellés métier (« mensuel », « prime »…) correspondent aux valeurs API actuelles
 * (`fixe` = mensuel récurrent, `mission` = prime de mission, `bonus`).
 */

export interface Salaire {
  id: number
  driver_id: number
  mission_id?: number | null
  type_salaire: 'fixe' | 'mission' | 'bonus' | string
  montant: number
  date_paiement?: string | null
  mois_concerne?: string | null
  statut: 'en_attente' | 'partiel' | 'paye' | 'annule' | string
  montant_paye?: number
  notes?: string | null
  created_at: string
  // Jointures API
  driver_nom?: string
  driver_prenom?: string
  lieu_depart?: string
  lieu_arrivee?: string
}

export interface SalaireStats {
  total_a_payer: number
  total_paye: number
  total_en_attente: number
  par_chauffeur: SalaireParChauffeur[]
}

export interface SalaireParChauffeur {
  driver_id: number
  nom: string
  prenom: string
  total: number
  paye: number
  restant: number
  statut: string
  nb_missions: number
}

export interface PaiementSalaire {
  montant: number
  mode_paiement: 'mvola' | 'virement' | 'especes'
  notes?: string
}

/** Données du formulaire création / édition salaire */
export interface SalaireFormData {
  driver_id: number | ''
  type_salaire: string
  montant: number | string
  statut: string
  mois_concerne: string
  notes: string
}
