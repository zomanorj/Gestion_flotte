/**
 * UtilisateurFormModal.tsx
 * Modal de création et d'édition d'un utilisateur — TransiFlow.
 *
 * Mode création : nom, email, mot de passe, rôle, driver (si chauffeur), téléphone
 * Mode édition  : mêmes champs sans le mot de passe
 */

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import * as utilisateurService from '../../services/utilisateurService'
import api from '../../services/api'
import type { Utilisateur } from '../../types/utilisateur'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Driver {
  id:     number
  nom:    string
  prenom: string
}

interface UtilisateurFormModalProps {
  isOpen:      boolean
  onClose:     () => void
  onSuccess:   () => void
  utilisateur?: Utilisateur | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicateur de force du mot de passe
// ─────────────────────────────────────────────────────────────────────────────

function indicateurForceMdp(mdp: string): { niveau: number; label: string; couleur: string } {
  if (!mdp) return { niveau: 0, label: '', couleur: '' }
  let score = 0
  if (mdp.length >= 8)        score++
  if (mdp.length >= 12)       score++
  if (/[A-Z]/.test(mdp))     score++
  if (/[0-9]/.test(mdp))     score++
  if (/[^A-Za-z0-9]/.test(mdp)) score++

  if (score <= 1) return { niveau: 1, label: 'Faible',    couleur: 'bg-red-500'    }
  if (score <= 2) return { niveau: 2, label: 'Moyen',     couleur: 'bg-orange-400' }
  if (score <= 3) return { niveau: 3, label: 'Bon',       couleur: 'bg-yellow-400' }
  return               { niveau: 4, label: 'Excellent',  couleur: 'bg-green-500'  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function UtilisateurFormModal({
  isOpen, onClose, onSuccess, utilisateur,
}: UtilisateurFormModalProps) {
  const estEdition = Boolean(utilisateur)

  // Champs du formulaire
  const [nom,             setNom]            = useState('')
  const [email,           setEmail]          = useState('')
  const [motDePasse,      setMotDePasse]      = useState('')
  const [confirmerMdp,    setConfirmerMdp]    = useState('')
  const [role,            setRole]            = useState<'admin' | 'gestionnaire' | 'chauffeur'>('gestionnaire')
  const [driverId,        setDriverId]        = useState<string>('')
  const [telephone,       setTelephone]       = useState('')
  const [isSubmitting,    setIsSubmitting]    = useState(false)
  const [erreurs,         setErreurs]         = useState<string[]>([])
  const [drivers,         setDrivers]         = useState<Driver[]>([])
  const [afficherMdp,     setAfficherMdp]     = useState(false)

  const forceMdp = indicateurForceMdp(motDePasse)

  // Pré-remplir le formulaire en mode édition
  useEffect(() => {
    if (utilisateur) {
      setNom(utilisateur.nom || '')
      setEmail(utilisateur.email || '')
      setRole(utilisateur.role)
      setDriverId(utilisateur.driver_id ? String(utilisateur.driver_id) : '')
      setTelephone(utilisateur.telephone || '')
    } else {
      setNom('')
      setEmail('')
      setMotDePasse('')
      setConfirmerMdp('')
      setRole('gestionnaire')
      setDriverId('')
      setTelephone('')
    }
    setErreurs([])
  }, [utilisateur, isOpen])

  // Charger la liste des chauffeurs pour le select
  useEffect(() => {
    if (!isOpen) return
    api.get('/api/drivers', { params: { limit: 100 } })
      .then(r => setDrivers(r.data.donnees || []))
      .catch(() => setDrivers([]))
  }, [isOpen])

  // Validation frontend
  function valider(): string[] {
    const errs: string[] = []
    if (!nom.trim())   errs.push('Le nom est obligatoire')
    if (!email.trim()) errs.push('L\'email est obligatoire')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push('Format d\'email invalide')

    if (!estEdition) {
      if (!motDePasse)           errs.push('Le mot de passe est obligatoire')
      if (motDePasse.length < 8) errs.push('Le mot de passe doit contenir au moins 8 caractères')
      if (motDePasse !== confirmerMdp) errs.push('Les mots de passe ne correspondent pas')
    }

    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errsValidation = valider()
    if (errsValidation.length > 0) {
      setErreurs(errsValidation)
      return
    }

    setIsSubmitting(true)
    setErreurs([])

    try {
      if (estEdition && utilisateur) {
        await utilisateurService.updateUtilisateur(utilisateur.id, {
          nom, email, role, telephone: telephone || undefined,
          driver_id: driverId ? parseInt(driverId, 10) : undefined,
        })
        toast.success('Utilisateur mis à jour avec succès')
      } else {
        await utilisateurService.createUtilisateur({
          nom, email, mot_de_passe: motDePasse, role, telephone: telephone || undefined,
          driver_id: driverId ? parseInt(driverId, 10) : undefined,
        })
        toast.success('Utilisateur créé avec succès')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string; erreurs?: string[] } } }
      const msg   = error.response?.data?.erreurs?.join(', ') || error.response?.data?.message || 'Erreur lors de l\'enregistrement'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {estEdition ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Erreurs de validation */}
          {erreurs.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <ul className="list-disc list-inside space-y-1">
                {erreurs.map((err, i) => (
                  <li key={i} className="text-sm text-red-600">{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Rakoto Jean"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="utilisateur@example.com"
            />
          </div>

          {/* Mot de passe (création uniquement) */}
          {!estEdition && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mot de passe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={afficherMdp ? 'text' : 'password'}
                    value={motDePasse}
                    onChange={e => setMotDePasse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    placeholder="Minimum 8 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setAfficherMdp(v => !v)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {afficherMdp
                      ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    }
                  </button>
                </div>
                {/* Indicateur de force */}
                {motDePasse && (
                  <div className="mt-1.5">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map(n => (
                        <div
                          key={n}
                          className={`h-1 flex-1 rounded-full transition-colors ${n <= forceMdp.niveau ? forceMdp.couleur : 'bg-slate-200'}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">{forceMdp.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirmer le mot de passe <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmerMdp}
                  onChange={e => setConfirmerMdp(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    confirmerMdp && motDePasse !== confirmerMdp ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Retaper le mot de passe"
                />
              </div>
            </>
          )}

          {/* Rôle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rôle <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'gestionnaire' | 'chauffeur')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="gestionnaire">Gestionnaire</option>
              <option value="chauffeur">Chauffeur</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          {/* Driver associé (si rôle chauffeur) */}
          {role === 'chauffeur' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Associer à un chauffeur
              </label>
              <select
                value={driverId}
                onChange={e => setDriverId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Aucun chauffeur associé --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.prenom} {d.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Téléphone
            </label>
            <input
              type="tel"
              value={telephone}
              onChange={e => setTelephone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+261 34 00 000 00"
            />
          </div>

          {/* Boutons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? (estEdition ? 'Mise à jour...' : 'Création...')
                : (estEdition ? 'Enregistrer' : 'Créer l\'utilisateur')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
