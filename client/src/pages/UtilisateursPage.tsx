/**
 * UtilisateursPage.tsx
 * Page de gestion des utilisateurs — TransiFlow.
 * Accessible aux administrateurs uniquement.
 */

import { useState, useEffect, useCallback } from 'react'
import { Navigate }      from 'react-router-dom'
import toast             from 'react-hot-toast'
import { useAuth }       from '../contexts/AuthContext'
import { usePageTitle }  from '../hooks/usePageTitle'
import * as utilisateurService from '../services/utilisateurService'
import type { Utilisateur }    from '../types/utilisateur'
import { formatDateFR }        from '../utils/format'
import EmptyState              from '../components/ui/EmptyState'
import ConfirmModal            from '../components/ui/ConfirmModal'
import UtilisateurFormModal    from '../components/utilisateurs/UtilisateurFormModal'

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs des badges selon le rôle
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

const COULEURS_STATUT: Record<string, string> = {
  actif:    'bg-emerald-100 text-emerald-700',
  inactif:  'bg-slate-100 text-slate-500',
  suspendu: 'bg-orange-100 text-orange-700',
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatage de la dernière connexion en format relatif
// ─────────────────────────────────────────────────────────────────────────────

function formatConnexionRelative(dateStr?: string): { texte: string; rouge: boolean } {
  if (!dateStr) return { texte: 'Jamais connecté', rouge: true }

  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const heures  = Math.floor(diff / 3600000)
  const jours   = Math.floor(diff / 86400000)

  if (minutes < 2)  return { texte: 'À l\'instant', rouge: false }
  if (minutes < 60) return { texte: `Il y a ${minutes} min`, rouge: false }
  if (heures < 24)  return { texte: `Il y a ${heures} h`, rouge: false }
  if (jours < 7)    return { texte: `Il y a ${jours} j`, rouge: false }
  return { texte: formatDateFR(dateStr), rouge: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar utilisateur (initiales colorées selon le rôle)
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ utilisateur }: { utilisateur: Utilisateur }) {
  const initiales = utilisateur.nom
    .split(' ')
    .map(m => m[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${COULEURS_ROLE[utilisateur.role]}`}>
      {initiales}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function UtilisateursPage() {
  usePageTitle('Utilisateurs')
  const { utilisateur: moi } = useAuth()

  // Redirection si l'utilisateur n'est pas admin
  if (moi?.role !== 'admin') return <Navigate to="/" replace />

  const [utilisateurs,    setUtilisateurs]    = useState<Utilisateur[]>([])
  const [isLoading,       setIsLoading]       = useState(true)
  const [search,          setSearch]          = useState('')
  const [filtreRole,      setFiltreRole]       = useState('')
  const [filtreStatut,    setFiltreStatut]     = useState('')
  const [isModalOpen,     setIsModalOpen]      = useState(false)
  const [selectionne,     setSelectionne]      = useState<Utilisateur | null>(null)
  const [confirmDesact,   setConfirmDesact]    = useState<Utilisateur | null>(null)
  const [nvMdpData,       setNvMdpData]        = useState<{ nom: string; mdp: string } | null>(null)

  const charger = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await utilisateurService.getUtilisateurs({
        search:  search  || undefined,
        role:    filtreRole   || undefined,
        statut:  filtreStatut || undefined,
      })
      setUtilisateurs(data.donnees || [])
    } catch {
      toast.error('Erreur lors du chargement des utilisateurs')
    } finally {
      setIsLoading(false)
    }
  }, [search, filtreRole, filtreStatut])

  useEffect(() => {
    const timer = setTimeout(charger, 300)
    return () => clearTimeout(timer)
  }, [charger])

  // Réinitialiser le mot de passe
  async function handleReinitMdp(u: Utilisateur) {
    try {
      const data = await utilisateurService.reinitialiserMdp(u.id)
      setNvMdpData({ nom: u.nom, mdp: data.nouveauMotDePasse })
    } catch {
      toast.error('Erreur lors de la réinitialisation du mot de passe')
    }
  }

  // Désactiver un compte
  async function handleDesactiver() {
    if (!confirmDesact) return
    try {
      await utilisateurService.desactiverCompte(confirmDesact.id)
      toast.success('Compte désactivé')
      setConfirmDesact(null)
      charger()
    } catch {
      toast.error('Erreur lors de la désactivation')
    }
  }

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Utilisateurs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gérez les comptes et les accès à TransiFlow</p>
        </div>
        <button
          onClick={() => { setSelectionne(null); setIsModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvel utilisateur
        </button>
      </div>

      {/* ── Filtres ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filtreRole}
          onChange={e => setFiltreRole(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les rôles</option>
          <option value="admin">Administrateur</option>
          <option value="gestionnaire">Gestionnaire</option>
          <option value="chauffeur">Chauffeur</option>
        </select>
        <select
          value={filtreStatut}
          onChange={e => setFiltreStatut(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
          <option value="suspendu">Suspendu</option>
        </select>
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-8 h-8 bg-slate-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-slate-200 rounded w-40" />
                  <div className="h-3 bg-slate-100 rounded w-52" />
                </div>
                <div className="w-20 h-6 bg-slate-200 rounded-full" />
                <div className="w-16 h-6 bg-slate-100 rounded-full" />
                <div className="w-28 h-4 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : utilisateurs.length === 0 ? (
          <EmptyState
            icon={(
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            )}
            title="Aucun utilisateur trouvé"
            description="Ajoutez des utilisateurs pour leur donner accès à TransiFlow."
            actionLabel="Créer le premier utilisateur"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Utilisateur</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Rôle</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Statut</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Dernière connexion</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {utilisateurs.map(u => {
                  const { texte, rouge } = formatConnexionRelative(u.derniere_connexion)
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      {/* Nom + email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar utilisateur={u} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{u.nom}</p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Rôle */}
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${COULEURS_ROLE[u.role]}`}>
                          {LABELS_ROLE[u.role]}
                        </span>
                      </td>
                      {/* Statut */}
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${COULEURS_STATUT[u.statut] || 'bg-slate-100 text-slate-500'}`}>
                          {u.statut}
                        </span>
                      </td>
                      {/* Dernière connexion */}
                      <td className="px-6 py-4">
                        <span className={`text-xs ${rouge ? 'text-red-400' : 'text-slate-500'}`}>
                          {texte}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Modifier */}
                          <button
                            onClick={() => { setSelectionne(u); setIsModalOpen(true) }}
                            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            Modifier
                          </button>
                          {/* Réinitialiser mdp */}
                          <button
                            onClick={() => handleReinitMdp(u)}
                            className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                          >
                            Réinit. mdp
                          </button>
                          {/* Désactiver */}
                          {u.statut === 'actif' && u.id !== moi?.id && (
                            <button
                              onClick={() => setConfirmDesact(u)}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              Désactiver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal création / édition ── */}
      <UtilisateurFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { charger(); setIsModalOpen(false) }}
        utilisateur={selectionne}
      />

      {/* ── Confirmation désactivation ── */}
      <ConfirmModal
        isOpen={Boolean(confirmDesact)}
        title="Désactiver ce compte ?"
        message={`Le compte de ${confirmDesact?.nom} sera désactivé. L'utilisateur ne pourra plus se connecter.`}
        confirmLabel="Désactiver"
        variant="danger"
        onConfirm={handleDesactiver}
        onCancel={() => setConfirmDesact(null)}
      />

      {/* ── Modal affichage nouveau mot de passe ── */}
      {nvMdpData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNvMdpData(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Nouveau mot de passe</h3>
                <p className="text-xs text-slate-500">pour {nvMdpData.nom}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 flex items-center justify-between gap-3">
              <code className="text-sm font-mono text-slate-800 select-all break-all">{nvMdpData.mdp}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(nvMdpData.mdp)
                  toast.success('Mot de passe copié')
                }}
                className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Copier
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-700 font-medium">
                Ce mot de passe est affiché une seule fois. Notez-le et transmettez-le à l'utilisateur de manière sécurisée.
              </p>
            </div>

            <button
              onClick={() => setNvMdpData(null)}
              className="w-full px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              J'ai noté le mot de passe
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
