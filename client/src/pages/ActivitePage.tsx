/**
 * ActivitePage.tsx
 * Page du journal d'activité — TransiFlow.
 * Accessible aux administrateurs uniquement.
 */

import { useState, useEffect, useCallback } from 'react'
import { Navigate }      from 'react-router-dom'
import toast             from 'react-hot-toast'
import { useAuth }       from '../contexts/AuthContext'
import { usePageTitle }  from '../hooks/usePageTitle'
import * as activiteService from '../services/activiteService'

// ─────────────────────────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────────────────────────

interface EntreeActivite {
  id:           number
  user_id:      number | null
  user_nom:     string | null
  user_email:   string | null
  user_role:    string | null
  action:       string
  entite:       string | null
  entite_id:    number | null
  description:  string
  ip_address:   string | null
  created_at:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration des icônes et couleurs par type d'action
// ─────────────────────────────────────────────────────────────────────────────

function IconeAction({ action }: { action: string }) {
  if (action === 'connexion') {
    return (
      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
      </svg>
    )
  }
  if (action === 'creation') {
    return (
      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    )
  }
  if (action === 'modification') {
    return (
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    )
  }
  if (action === 'suppression' || action === 'suppression_definitive') {
    return (
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    )
  }
  if (action === 'paiement') {
    return (
      <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
      </svg>
    )
  }
  if (action === 'restauration') {
    return (
      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    )
  }
  // Action par défaut
  return (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  )
}

function couleurFondAction(action: string): string {
  if (action === 'creation')                                    return 'bg-emerald-50'
  if (action === 'modification')                               return 'bg-blue-50'
  if (action === 'suppression' || action === 'suppression_definitive') return 'bg-red-50'
  if (action === 'paiement')                                   return 'bg-emerald-100'
  if (action === 'restauration')                               return 'bg-orange-50'
  return 'bg-slate-100'
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatage de la date relative
// ─────────────────────────────────────────────────────────────────────────────

function formatRelatif(dateStr: string): string {
  const diff    = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const heures  = Math.floor(diff / 3600000)
  const jours   = Math.floor(diff / 86400000)

  if (minutes < 2)  return 'À l\'instant'
  if (minutes < 60) return `Il y a ${minutes} min`
  if (heures < 24)  return `Il y a ${heures} h`
  if (jours < 7)    return `Il y a ${jours} j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Initiales avatar
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ nom, role }: { nom: string | null; role: string | null }) {
  const initiales = nom
    ? nom.split(' ').map(m => m[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const couleur = role === 'admin'
    ? 'bg-red-100 text-red-700'
    : role === 'gestionnaire'
    ? 'bg-blue-100 text-blue-700'
    : role === 'chauffeur'
    ? 'bg-green-100 text-green-700'
    : 'bg-slate-100 text-slate-500'

  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${couleur}`}>
      {initiales}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ActivitePage() {
  usePageTitle('Journal d\'activité')
  const { utilisateur } = useAuth()

  if (utilisateur?.role !== 'admin') return <Navigate to="/" replace />

  const [activite,     setActivite]     = useState<EntreeActivite[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [filtreAction, setFiltreAction] = useState('')
  const [filtreEntite, setFiltreEntite] = useState('')
  const [dateDebut,    setDateDebut]    = useState('')
  const [dateFin,      setDateFin]      = useState('')
  const [page,         setPage]         = useState(1)
  const [totalPages,   setTotalPages]   = useState(1)

  const charger = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await activiteService.getActivite({
        action:     filtreAction || undefined,
        entite:     filtreEntite || undefined,
        date_debut: dateDebut    || undefined,
        date_fin:   dateFin      || undefined,
        page,
        limit: 30,
      })
      setActivite(data.donnees || [])
      setTotalPages(data.pagination?.pages || 1)
    } catch {
      toast.error('Erreur lors du chargement du journal')
    } finally {
      setIsLoading(false)
    }
  }, [filtreAction, filtreEntite, dateDebut, dateFin, page])

  useEffect(() => { charger() }, [charger])

  function handleFiltrer() {
    setPage(1)
    charger()
  }

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Journal d'activité</h1>
        <p className="text-sm text-slate-500 mt-0.5">Historique complet des actions réalisées dans TransiFlow</p>
      </div>

      {/* ── Filtres ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Action</label>
          <select
            value={filtreAction}
            onChange={e => setFiltreAction(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les actions</option>
            <option value="connexion">Connexion</option>
            <option value="creation">Création</option>
            <option value="modification">Modification</option>
            <option value="suppression">Suppression</option>
            <option value="restauration">Restauration</option>
            <option value="paiement">Paiement</option>
            <option value="reinitialisation_mdp">Réinit. mdp</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Entité</label>
          <select
            value={filtreEntite}
            onChange={e => setFiltreEntite(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les entités</option>
            <option value="users">Utilisateurs</option>
            <option value="vehicles">Véhicules</option>
            <option value="drivers">Chauffeurs</option>
            <option value="missions">Missions</option>
            <option value="clients">Clients</option>
            <option value="factures">Factures</option>
            <option value="contrats">Contrats</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Depuis</label>
          <input
            type="date"
            value={dateDebut}
            onChange={e => setDateDebut(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Jusqu'au</label>
          <input
            type="date"
            value={dateFin}
            onChange={e => setDateFin(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleFiltrer}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Filtrer
        </button>
      </div>

      {/* ── Timeline ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-6 py-4 animate-pulse">
                <div className="w-8 h-8 bg-slate-200 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="h-3 w-20 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : activite.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Aucune activité enregistrée pour ces critères.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activite.map(entree => (
              <div key={entree.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                {/* Icône action */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${couleurFondAction(entree.action)}`}>
                  <IconeAction action={entree.action} />
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 leading-relaxed">{entree.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {entree.user_nom && (
                      <div className="flex items-center gap-1.5">
                        <Avatar nom={entree.user_nom} role={entree.user_role} />
                        <span className="text-xs text-slate-500">{entree.user_nom}</span>
                      </div>
                    )}
                    {entree.entite && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {entree.entite}
                        {entree.entite_id ? ` #${entree.entite_id}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Horodatage */}
                <span className="text-xs text-slate-400 shrink-0 mt-0.5">{formatRelatif(entree.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-slate-100">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <span className="text-sm text-slate-500">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
