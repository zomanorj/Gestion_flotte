/**
 * trackingService.ts
 * Service de communication avec l'API pour le suivi GPS — Transport STTA.
 *
 * Ce module centralise tous les appels HTTP vers les endpoints de suivi.
 *
 * Fonctions exportées :
 *   - getActiveVehicles()           → Liste des véhicules en mission avec positions
 *   - getMissionTracking(id)        → Historique des positions d'une mission
 *   - updatePosition(data)          → Mettre à jour une position GPS
 */

import apiClient from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Position {
  latitude: number
  longitude: number
  vitesse: number
  horodatage: string | null
  est_simulee?: boolean
}

export interface TrackingMission {
  mission_id: number
  lieu_depart: string
  lieu_arrivee: string
  date_mission: string
  heure_depart: string | null
  statut: string
  vehicle: {
    immatriculation: string
    type: string
  }
  driver: {
    nom: string
    prenom: string
    telephone: string | null
  }
  position: Position | null
}

export interface TrackingHistorique {
  id: number
  latitude: number
  longitude: number
  vitesse: number
  horodatage: string
}

export interface UpdatePositionData {
  mission_id: number
  latitude: number
  longitude: number
  vitesse?: number
  horodatage?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Réponses API
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveVehiclesResponse {
  succes: boolean
  donnees: TrackingMission[]
  metadata: {
    total: number
    horodatage: string
  }
}

interface MissionTrackingResponse {
  succes: boolean
  donnees: {
    mission: {
      id: number
      lieu_depart: string
      lieu_arrivee: string
      statut: string
    }
    historique: TrackingHistorique[]
  }
}

interface UpdatePositionResponse {
  succes: boolean
  message: string
  donnees: {
    id: number
    latitude: number
    longitude: number
    vitesse: number
    horodatage: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions du service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getActiveVehicles
 * Récupère toutes les missions en cours avec leur dernière position connue.
 */
export async function getActiveVehicles(): Promise<ActiveVehiclesResponse> {
  const { data } = await apiClient.get<ActiveVehiclesResponse>('/api/tracking/active')
  return data
}

/**
 * getMissionTracking
 * Récupère l'historique des positions d'une mission spécifique.
 */
export async function getMissionTracking(missionId: number): Promise<MissionTrackingResponse> {
  const { data } = await apiClient.get<MissionTrackingResponse>(`/api/tracking/mission/${missionId}`)
  return data
}

/**
 * updatePosition
 * Met à jour la position GPS d'un véhicule pour une mission.
 * Réservé aux chauffeurs qui sont assignés à la mission.
 */
export async function updatePosition(data: UpdatePositionData): Promise<UpdatePositionResponse> {
  const { data: response } = await apiClient.post<UpdatePositionResponse>(
    '/api/tracking/position',
    data
  )
  return response
}