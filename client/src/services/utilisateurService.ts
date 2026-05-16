/**
 * utilisateurService.ts
 * Service de communication avec l'API pour la gestion des utilisateurs — TransiFlow.
 */

import api from './api'
import type { Utilisateur } from '../types/utilisateur'

// ─────────────────────────────────────────────────────────────────────────────
// Gestion des utilisateurs (admin)
// ─────────────────────────────────────────────────────────────────────────────

/** Récupère la liste paginée des utilisateurs avec filtres optionnels */
export async function getUtilisateurs(params?: {
  search?: string
  role?:   string
  statut?: string
  page?:   number
  limit?:  number
}) {
  const response = await api.get('/api/utilisateurs', { params })
  return response.data
}

/** Récupère le détail d'un utilisateur par son ID */
export async function getUtilisateur(id: number) {
  const response = await api.get(`/api/utilisateurs/${id}`)
  return response.data
}

/** Crée un nouvel utilisateur */
export async function createUtilisateur(data: Partial<Utilisateur> & { mot_de_passe: string }) {
  const response = await api.post('/api/utilisateurs', data)
  return response.data
}

/** Met à jour un utilisateur existant */
export async function updateUtilisateur(id: number, data: Partial<Utilisateur>) {
  const response = await api.put(`/api/utilisateurs/${id}`, data)
  return response.data
}

/** Réinitialise le mot de passe d'un utilisateur et retourne le nouveau en clair */
export async function reinitialiserMdp(id: number): Promise<{ nouveauMotDePasse: string }> {
  const response = await api.patch(`/api/utilisateurs/${id}/reinitialiser-mdp`)
  return response.data.donnees
}

/** Désactive le compte d'un utilisateur */
export async function desactiverCompte(id: number) {
  const response = await api.patch(`/api/utilisateurs/${id}/desactiver`)
  return response.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Profil (tous rôles)
// ─────────────────────────────────────────────────────────────────────────────

/** Récupère le profil de l'utilisateur connecté */
export async function getMonProfil(): Promise<Utilisateur> {
  const response = await api.get('/api/profil')
  return response.data.donnees
}

/** Met à jour le profil de l'utilisateur connecté */
export async function updateMonProfil(data: {
  nom?:       string
  email?:     string
  telephone?: string
}) {
  const response = await api.put('/api/profil', data)
  return response.data
}

/** Change le mot de passe de l'utilisateur connecté */
export async function changerMonMdp(data: {
  ancienMotDePasse:   string
  nouveauMotDePasse:  string
}) {
  const response = await api.patch('/api/profil/mot-de-passe', data)
  return response.data
}
