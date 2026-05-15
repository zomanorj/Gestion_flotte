// client/src/services/clientService.ts

import api from './api'
import type { Client, ClientStats } from '../types/client'

export const getClients = async (params?: {
  search?: string
  statut?: string
  type_client?: string
  page?: number
  limit?: number
}) => {
  const response = await api.get('/api/clients', { params })
  return response.data
}

export const getClient = async (id: number) => {
  const response = await api.get(`/api/clients/${id}`)
  return response.data.donnees as Client
}

export const createClient = async (data: Partial<Client>) => {
  const response = await api.post('/api/clients', data)
  return response.data.donnees as Client
}

export const updateClient = async (id: number, data: Partial<Client>) => {
  const response = await api.put(`/api/clients/${id}`, data)
  return response.data.donnees as Client
}

export const deleteClient = async (id: number) => {
  const response = await api.delete(`/api/clients/${id}`)
  return response.data.donnees as Client
}

export const getClientMissions = async (
  id: number,
  params?: { statut?: string; page?: number; limit?: number }
) => {
  const response = await api.get(`/api/clients/${id}/missions`, { params })
  return response.data
}

export const getClientStats = async (id: number) => {
  const response = await api.get(`/api/clients/${id}/stats`)
  return response.data.donnees as ClientStats
}
