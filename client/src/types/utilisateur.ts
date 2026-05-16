/**
 * utilisateur.ts
 * Types TypeScript pour la gestion des utilisateurs — TransiFlow.
 */

export interface Utilisateur {
  id:                  number
  nom:                 string
  email:               string
  role:                'admin' | 'gestionnaire' | 'chauffeur'
  statut:              'actif' | 'inactif' | 'suspendu'
  driver_id?:          number
  driver_nom?:         string
  driver_prenom?:      string
  telephone?:          string
  photo_url?:          string
  derniere_connexion?: string
  created_at:          string
}
