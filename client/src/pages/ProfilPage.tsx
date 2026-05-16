/**
 * ProfilPage.tsx
 * Page de profil personnel de l'utilisateur connecté — TransiFlow.
 * Accessible à tous les rôles.
 */

import { useState, useEffect } from 'react'
import { Link }               from 'react-router-dom'
import toast                  from 'react-hot-toast'
import { useAuth }            from '../contexts/AuthContext'
import { usePageTitle }       from '../hooks/usePageTitle'
import * as utilisateurService from '../services/utilisateurService'
import type { Utilisateur }    from '../types/utilisateur'
import { formatDateFR }        from '../utils/format'

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs et labels selon le rôle
// ─────────────────────────────────────────────────────────────────────────────

const COULEURS_ROLE: Record<string, string> = {
  admin:        'bg-red-100 text-red-700',
  gestionnaire: 'bg-blue-100 text-blue-700',
  chauffeur:    'bg-green-100 text-green-700',
}

const LABELS_ROLE: Record<string, string> = {
  admin:        'Administrateur',
  gestionnaire: 'Gestionnaire',
  chauffeur:    'Chauffeur',
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicateur de force du mot de passe
// ─────────────────────────────────────────────────────────────────────────────

function indicateurForceMdp(mdp: string): { niveau: number; label: string; couleur: string } {
  if (!mdp) return { niveau: 0, label: '', couleur: '' }
  let score = 0
  if (mdp.length >= 8)           score++
  if (mdp.length >= 12)          score++
  if (/[A-Z]/.test(mdp))        score++
  if (/[0-9]/.test(mdp))        score++
  if (/[^A-Za-z0-9]/.test(mdp)) score++

  if (score <= 1) return { niveau: 1, label: 'Faible',   couleur: 'bg-red-500'    }
  if (score <= 2) return { niveau: 2, label: 'Moyen',    couleur: 'bg-orange-400' }
  if (score <= 3) return { niveau: 3, label: 'Bon',      couleur: 'bg-yellow-400' }
  return               { niveau: 4, label: 'Excellent', couleur: 'bg-green-500'  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  usePageTitle('Mon profil')
  const { utilisateur: moi } = useAuth()

  const [profil,           setProfil]           = useState<Utilisateur | null>(null)
  const [isLoading,        setIsLoading]         = useState(true)

  // Champs formulaire infos
  const [nom,              setNom]              = useState('')
  const [email,            setEmail]            = useState('')
  const [telephone,        setTelephone]         = useState('')
  const [isSavingInfos,    setIsSavingInfos]    = useState(false)

  // Champs formulaire sécurité
  const [ancienMdp,        setAncienMdp]         = useState('')
  const [nouveauMdp,       setNouveauMdp]        = useState('')
  const [confirmerMdp,     setConfirmerMdp]      = useState('')
  const [isSavingMdp,      setIsSavingMdp]       = useState(false)
  const [afficherMdp,      setAfficherMdp]       = useState(false)

  const forceMdp = indicateurForceMdp(nouveauMdp)

  // Charger le profil
  useEffect(() => {
    setIsLoading(true)
    utilisateurService.getMonProfil()
      .then(data => {
        setProfil(data)
        setNom(data.nom || '')
        setEmail(data.email || '')
        setTelephone(data.telephone || '')
      })
      .catch(() => toast.error('Erreur lors du chargement du profil'))
      .finally(() => setIsLoading(false))
  }, [])

  // Initiales pour l'avatar
  const initiales = profil?.nom
    ? profil.nom.split(' ').map(m => m[0]).join('').toUpperCase().slice(0, 2)
    : moi?.nom?.split(' ').map((m: string) => m[0]).join('').toUpperCase().slice(0, 2) ?? '?'

  const role = profil?.role || moi?.role || 'gestionnaire'

  // Enregistrer les informations de profil
  async function handleSauvegarderInfos(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Format d\'email invalide')
      return
    }
    setIsSavingInfos(true)
    try {
      await utilisateurService.updateMonProfil({ nom, email, telephone: telephone || undefined })
      toast.success('Profil mis à jour avec succès')
    } catch {
      toast.error('Erreur lors de la mise à jour du profil')
    } finally {
      setIsSavingInfos(false)
    }
  }

  // Changer le mot de passe
  async function handleChangerMdp(e: React.FormEvent) {
    e.preventDefault()
    if (!ancienMdp || !nouveauMdp) {
      toast.error('Tous les champs sont requis')
      return
    }
    if (nouveauMdp.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (nouveauMdp !== confirmerMdp) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setIsSavingMdp(true)
    try {
      await utilisateurService.changerMonMdp({ ancienMotDePasse: ancienMdp, nouveauMotDePasse: nouveauMdp })
      toast.success('Mot de passe changé avec succès')
      setAncienMdp('')
      setNouveauMdp('')
      setConfirmerMdp('')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Erreur lors du changement de mot de passe')
    } finally {
      setIsSavingMdp(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-200 rounded-full shrink-0" />
            <div className="space-y-2">
              <div className="h-6 bg-slate-200 rounded w-40" />
              <div className="h-4 bg-slate-100 rounded w-52" />
              <div className="h-6 bg-slate-100 rounded-full w-24" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Hero / avatar ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar 80px */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 ${COULEURS_ROLE[role]}`}>
            {initiales}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 truncate">{profil?.nom}</h1>
            <p className="text-sm text-slate-500 truncate">{profil?.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${COULEURS_ROLE[role]}`}>
                {LABELS_ROLE[role]}
              </span>
              {profil?.derniere_connexion && (
                <span className="text-xs text-slate-400">
                  Dernière connexion : {formatDateFR(profil.derniere_connexion)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section : compte chauffeur associé ── */}
      {profil?.driver_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">Compte chauffeur associé</p>
              <p className="text-xs text-blue-600">
                {profil.driver_prenom} {profil.driver_nom}
              </p>
            </div>
          </div>
          <Link
            to={`/drivers/${profil.driver_id}`}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
          >
            Voir la fiche
          </Link>
        </div>
      )}

      {/* ── Formulaire : Mes informations ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Mes informations</h2>
          <p className="text-xs text-slate-500 mt-0.5">Mettez à jour vos informations personnelles</p>
        </div>
        <form onSubmit={handleSauvegarderInfos} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={telephone}
              onChange={e => setTelephone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+261 34 00 000 00"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingInfos}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {isSavingInfos ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Formulaire : Sécurité ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Sécurité</h2>
          <p className="text-xs text-slate-500 mt-0.5">Changez votre mot de passe régulièrement</p>
        </div>
        <form onSubmit={handleChangerMdp} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={ancienMdp}
              onChange={e => setAncienMdp(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Votre mot de passe actuel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={afficherMdp ? 'text' : 'password'}
                value={nouveauMdp}
                onChange={e => setNouveauMdp(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                placeholder="Minimum 8 caractères"
              />
              <button
                type="button"
                onClick={() => setAfficherMdp(v => !v)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            {/* Indicateur de force */}
            {nouveauMdp && (
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmerMdp}
              onChange={e => setConfirmerMdp(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                confirmerMdp && nouveauMdp !== confirmerMdp ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
              placeholder="Retaper le nouveau mot de passe"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingMdp}
              className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              {isSavingMdp ? 'Changement...' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
