// client/src/services/factureService.ts

import api from './api'
import type { Facture, FactureStats, Paiement, PaiementsResponse } from '../types/client'

export const getFactures = async (params?: {
  client_id?: number
  statut?: string
  date_debut?: string
  date_fin?: string
  page?: number
  limit?: number
}) => {
  const response = await api.get('/api/factures', { params })
  return response.data
}

export const getFacture = async (id: number) => {
  const response = await api.get(`/api/factures/${id}`)
  return response.data.donnees as Facture
}

export const createFacture = async (data: Partial<Facture>) => {
  const response = await api.post('/api/factures', data)
  return response.data.donnees as Facture
}

export const updateFacture = async (id: number, data: Partial<Facture>) => {
  const response = await api.put(`/api/factures/${id}`, data)
  return response.data.donnees as Facture
}

export const marquerFacturePayee = async (
  id: number,
  data: { mode_paiement: string; date_paiement?: string }
) => {
  const response = await api.patch(`/api/factures/${id}/payer`, data)
  return response.data.donnees as Facture
}

export const annulerFacture = async (id: number) => {
  const response = await api.patch(`/api/factures/${id}/annuler`)
  return response.data.donnees as Facture
}

export const getFactureStats = async (params?: { date_debut?: string; date_fin?: string }) => {
  const response = await api.get('/api/factures/stats', { params })
  return response.data.donnees as FactureStats
}

// Fonction utilitaire pour télécharger un PDF
export const downloadFacturePDF = async (id: number, numero: string) => {
  try {
    const response = await api.get(`/api/factures/${id}/pdf`, {
      responseType: 'blob'
    })
    
    // Créer un lien temporaire pour forcer le téléchargement
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Facture-${numero}.pdf`)
    document.body.appendChild(link)
    link.click()
    
    // Nettoyage
    link.parentNode?.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Erreur lors du téléchargement du PDF:', error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Paiements progressifs
// ─────────────────────────────────────────────────────────────────────────────

/** Récupère les paiements d'une facture + solde restant */
export const getPaiements = async (factureId: number): Promise<PaiementsResponse> => {
  const response = await api.get(`/api/factures/${factureId}/paiements`)
  return response.data.donnees as PaiementsResponse
}

/** Enregistre un paiement (acompte ou solde) */
export const addPaiement = async (
  factureId: number,
  data: {
    montant:        number
    mode_paiement:  string
    date_paiement?: string
    reference?:     string
    notes?:         string
  }
): Promise<{ paiement: Paiement; montant_paye: number; solde_restant: number; statut_facture: string }> => {
  const response = await api.post(`/api/factures/${factureId}/paiements`, data)
  return response.data.donnees
}
