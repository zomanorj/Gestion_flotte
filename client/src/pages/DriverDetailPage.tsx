/**
 * DriverDetailPage.tsx
 * Page de détail d'un chauffeur — TransiFlow.
 *
 * Fonctionnalités :
 *   - Breadcrumb de navigation
 *   - Hero section avec grand avatar et informations principales
 *   - Grille d'informations (coordonnées, permis, notes)
 *   - Section missions récentes (avec gestion d'erreur si endpoint absent)
 *   - Boutons d'action (modifier, désactiver)
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuth } from '../contexts/AuthContext'
import * as driverService from '../services/driverService'
import type { Driver, Mission } from '../types/driver'
import {
  getInitials,
  getAvatarColor,
  getPermisBadgeClasses,
  getStatutClasses,
  getStatutLabel,
  formatDateFR,
} from '../utils/avatarColor'

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { utilisateur } = useAuth()

  // ── États ──
  const [driver, setDriver] = useState<Driver | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Vérifier les permissions ──
  const canEdit = utilisateur?.role === 'admin' || utilisateur?.role === 'gestionnaire'
  const canDelete = utilisateur?.role === 'admin'

  // ── Chargement des données ──
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)

      try {
        // Charger le chauffeur
        const driverResponse = await driverService.getDriver(parseInt(id!, 10))
        setDriver(driverResponse.donnees)

        // Charger les missions (peut échouer si endpoint non implémenté)
        try {
          const missionsData = await driverService.getDriverMissions(parseInt(id!, 10))
          setMissions(missionsData.slice(0, 5)) // Max 5 missions
        } catch {
          setMissions([])
        }
      } catch (err) {
        console.error('Erreur chargement détail chauffeur:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      loadData()
    }
  }, [id])

  // ── Handlers ──
  const handleDesactiver = async () => {
    if (!driver) return

    if (!window.confirm(`Voulez-vous vraiment désactiver le chauffeur ${driver.prenom} ${driver.nom} ?`)) {
      return
    }

    setIsSubmitting(true)
    try {
      await driverService.deleteDriver(driver.id)
      toast.success('Chauffeur désactivé avec succès')
      navigate('/drivers')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Calculs ──
  if (!driver && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">Chauffeur introuvable</p>
          <Link to="/drivers" className="text-blue-600 hover:underline mt-2 inline-block">
            Retour à la liste des chauffeurs →
          </Link>
        </div>
      </div>
    )
  }

  // Avatar
  const fullName = driver ? `${driver.prenom} ${driver.nom}` : ''
  const { bg: avatarBg, text: avatarText } = getAvatarColor(fullName)
  const initials = driver ? getInitials(driver.prenom, driver.nom) : '??'

  // Jours restants pour le permis
  const calculerJoursRestants = (dateStr: string) => {
    const aujourdHui = new Date()
    const expiration = new Date(dateStr)
    const diffTemps = expiration.getTime() - aujourdHui.getTime()
    return Math.ceil(diffTemps / (1000 * 60 * 60 * 24))
  }

  const joursRestants = driver?.date_expiration_permis
    ? calculerJoursRestants(driver.date_expiration_permis)
    : null

  // ── Rendu ──
  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center text-sm text-slate-500">
        <Link to="/" className="hover:text-blue-600 transition-colors">
          Tableau de bord
        </Link>
        <span className="mx-2">/</span>
        <Link to="/drivers" className="hover:text-blue-600 transition-colors">
          Chauffeurs
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800 font-medium">
          {driver?.prenom} {driver?.nom?.toUpperCase()}
        </span>
      </nav>

      {/* ── Hero Section ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Grand avatar */}
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${avatarBg} ${avatarText}`}
            >
              {initials}
            </div>

            {/* Informations principales */}
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {driver?.prenom} {driver?.nom?.toUpperCase()}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatutClasses(driver?.statut || '')}`}>
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {driver && getStatutLabel(driver.statut)}
                </span>
                {driver?.date_embauche && (
                  <span className="text-sm text-slate-500">
                    • Depuis {formatDateFR(driver.date_embauche)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/drivers')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Retour
            </button>

            {canEdit && driver && (
              <button
                onClick={() => navigate(`/drivers/${driver.id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.862 4.489l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.5 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Modifier
              </button>
            )}

            {canDelete && driver && driver.statut !== 'inactif' && (
              <button
                onClick={handleDesactiver}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Désactiver
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Grille d'informations ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Carte : Coordonnées */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Coordonnées
          </h2>
          <dl className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 2.25a.75.75 0 000 1.5h1.388c.38 0 .725.217.895.553l.142.284a1.25 1.25 0 01-.276 1.548l-.197.155a4.375 4.375 0 001.528 7.513l.292.064a1.25 1.25 0 01.96 1.218v1.388a.75.75 0 001.5 0v-1.388a2.75 2.75 0 00-2.124-2.68l-.292-.064a2.875 2.875 0 01-1.005-4.945l.197-.155a2.75 2.75 0 00.608-3.406l-.142-.284A2.75 2.75 0 0013.076 4.5H11.25a.75.75 0 000-1.5h1.826a4.25 4.25 0 013.806 2.376l.142.284a4.25 4.25 0 01-.94 5.27l-.197.155a2.875 2.875 0 001.005 4.945l.292.064a4.25 4.25 0 013.288 4.164v1.388a.75.75 0 001.5 0v-1.388a5.75 5.75 0 00-4.44-5.604l-.292-.064a2.75 2.75 0 01-.96-1.218v-1.388a1.25 1.25 0 00-.895-1.197l-.292-.064a2.875 2.875 0 00-1.005-4.945l.197-.155a4.25 4.25 0 00.94-5.27l-.142-.284A4.25 4.25 0 0013.076 4.5H2.25z" />
                </svg>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase">Téléphone</dt>
                <dd className="text-sm font-medium text-slate-800">
                  {driver?.telephone || 'Non renseigné'}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                </svg>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase">Numéro de permis</dt>
                <dd className="text-sm font-medium text-slate-800 font-mono">
                  {driver?.numero_permis}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 12.75a.75.75 0 001.5 0V6a.75.75 0 00-1.5 0v6.75zm2.25 0a.75.75 0 001.5 0V5.25a.75.75 0 00-1.5 0v7.5zm2.25 0a.75.75 0 001.5 0V8.25a.75.75 0 00-1.5 0v4.5zm2.25 0a.75.75 0 001.5 0V3.75a.75.75 0 00-1.5 0v9zm2.25 0a.75.75 0 001.5 0V6a.75.75 0 00-1.5 0v6.75zm2.25 0a.75.75 0 001.5 0V5.25a.75.75 0 00-1.5 0v7.5z" />
                </svg>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase">Statut actuel</dt>
                <dd className="text-sm font-medium text-slate-800">
                  {driver && getStatutLabel(driver.statut)}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Carte : Permis de conduire */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Permis de conduire
          </h2>
          <dl className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase">Date d'expiration</dt>
                <dd className="mt-0.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${driver && getPermisBadgeClasses(driver.date_expiration_permis)}`}>
                    {driver && formatDateFR(driver.date_expiration_permis)}
                  </span>
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <dt className="text-xs text-slate-500 uppercase">Jours restants</dt>
                <dd className="text-sm font-medium text-slate-800">
                  {joursRestants !== null
                    ? joursRestants < 0
                      ? <span className="text-red-600">Expiré depuis {Math.abs(joursRestants)} jours</span>
                      : `${joursRestants} jours`
                    : '—'}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Carte : Notes (pleine largeur) */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Notes
          </h2>
          {driver?.notes ? (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{driver.notes}</p>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span>Aucune note pour ce chauffeur</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section Missions récentes ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Missions récentes
          </h2>
          {missions.length > 0 && (
            <Link to="/missions" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Voir tout →
            </Link>
          )}
        </div>

        {missions.length === 0 ? (
          <div className="py-8 px-5 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            <p className="text-slate-500 text-sm">Aucune mission récente</p>
            <p className="text-slate-400 text-xs mt-1">
              Les missions seront affichées ici une fois le module Missions implémenté
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Véhicule</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Trajet</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {missions.map((mission) => (
                  <tr key={mission.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-600">
                      {new Date(mission.date_mission).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      Véhicule #{mission.vehicle_id}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {mission.lieu_depart} → {mission.lieu_arrivee}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        mission.statut === 'terminee' ? 'bg-green-100 text-green-700' :
                        mission.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                        mission.statut === 'annulee' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {mission.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Chargement...</p>
          </div>
        </div>
      )}
    </div>
  )
}