// client/src/types/client.ts

import type { Mission } from './mission'

export interface Client {
  id: number
  type_client: 'entreprise' | 'particulier' | 'administration'
  nom: string
  nom_contact?: string
  telephone: string
  telephone2?: string
  email?: string
  adresse?: string
  ville?: string
  nif?: string
  stat?: string
  notes?: string
  statut: 'actif' | 'inactif' | 'suspendu'
  created_at: string
  updated_at?: string
  // Stats calculées retournées par l'API
  total_missions?: number
  ca_total?: number
  factures_impayees?: number
  solde_credit?: number
}

/** Mouvement sur le compte crédit client (historique détaillé) */
export interface Transaction {
  id: number
  client_id: number
  facture_id?: number
  type_transaction: 'debit' | 'credit' | 'ajustement'
  montant: number
  solde_avant: number
  solde_apres: number
  description?: string
  created_at: string
}

/** Transaction sur le compte crédit d'un client */
export interface ClientTransaction {
  id: number
  client_id: number
  facture_id?: number
  type_transaction: 'credit' | 'debit'
  montant: number
  description?: string
  created_at: string
}

/** Statut d'une facture — 'partiel' = acompte versé mais solde restant */
export type StatutFacture = 'brouillon' | 'envoyee' | 'partiel' | 'payee' | 'annulee'

/** Paiement individuel enregistré pour une facture */
export interface Paiement {
  id:             number
  facture_id:     number
  montant:        number
  date_paiement:  string
  mode_paiement:  'mvola' | 'virement' | 'especes' | 'cheque' | string
  reference?:     string | null
  notes?:         string | null
  created_by?:    number | null
  created_by_nom?: string | null
  created_at:     string
}

/** Réponse de l'API paiements (/api/factures/:id/paiements) */
export interface PaiementsResponse {
  paiements:     Paiement[]
  montant_ttc:   number
  montant_paye:  number
  solde_restant: number
  etat_paiement: 'non_paye' | 'partiel' | 'paye'
}

export interface Facture {
  id: number
  numero: string
  client_id: number
  client?: Client
  mission_id?: number
  mission?: Mission
  statut: StatutFacture
  date_emission: string
  date_echeance?: string
  montant_ht: number
  taux_tva: number
  montant_tva: number
  montant_ttc: number
  description?: string
  conditions_paiement?: string
  mode_paiement?: 'virement' | 'especes' | 'cheque' | 'mvola' | string
  date_paiement?: string
  notes?: string
  created_by?: number
  created_at: string
  updated_at?: string
  // Champs inclus lors des jointures
  client_nom?: string
  type_client?: string
  lieu_depart?: string
  lieu_arrivee?: string
}

export interface ClientStats {
  total_missions: number
  missions_terminees: number
  ca_total: number
  ca_ce_mois: number
  factures_impayees: number
  montant_impaye: number
}

export interface FactureStats {
  total_emises: number
  total_payees: number
  total_impayees: number
  montant_total_ht: number
  montant_total_ttc: number
  montant_encaisse: number
  montant_en_attente: number
}
