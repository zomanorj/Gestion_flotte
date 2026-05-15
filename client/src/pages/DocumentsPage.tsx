/**
 * DocumentsPage.tsx
 * Page de gestion des documents PDF — Transport STTA.
 *
 * Fonctionnalités :
 *   - Liste des bons de livraison pour les missions terminées
 *   - Génération de rapports de missions avec filtres
 *   - Téléchargement des PDF
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuth } from '../contexts/AuthContext'
import * as missionService from '../services/missionService'
import { downloadBonLivraison, downloadRapportMissions } from '../services/documentService'
import type { Mission } from '../types/mission'
import EmptyState from '../components/ui/EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RapportFormData {
  date_debut: string
  date_fin: string
  statut: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton de chargement
// ─────────────────────────────────────────────────────────────────────────────

function DocumentsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-slate-200 rounded w-48" />
      <div className="h-64 bg-slate-200 rounded-xl" />
      <div className="h-64 bg-slate-200 rounded-xl" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { utilisateur } = useAuth()
  const [missions, setMissions] = useState<Mission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [rapportLoading, setRapportLoading] = useState(false)
  const [rapportForm, setRapportForm] = useState<RapportFormData>({
    date_debut: '',
    date_fin: '',
    statut: 'tous',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const isAdmin = utilisateur?.role === 'admin'
  const isGestionnaire = utilisateur?.role === 'gestionnaire'
  const canGenerateRapport = isAdmin || isGestionnaire

  // ── Charger les missions terminées ──
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const response = await missionService.getMissions({
          statut: 'terminee',
          limit: 50,
        })
        setMissions(response.donnees)
      } catch (error) {
        console.error('Erreur chargement missions:', error)
        toast.error('Erreur lors du chargement des missions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMissions()
  }, [])

  // ── Télécharger un bon de livraison ──
  const handleDownloadBL = async (missionId: number) => {
    setDownloadingId(missionId)
    try {
      await downloadBonLivraison(missionId)
      toast.success('Bon de livraison téléchargé')
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error)
      toast.error('Erreur lors du téléchargement du PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Gérer les changements du formulaire ──
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setRapportForm((prev) => ({ ...prev, [name]: value }))
    setFormError(null)
  }

  // ── Valider le formulaire ──
  const validateForm = (): boolean => {
    if (!rapportForm.date_debut) {
      setFormError('La date de début est obligatoire')
      return false
    }
    if (!rapportForm.date_fin) {
      setFormError('La date de fin est obligatoire')
      return false
    }
    if (new Date(rapportForm.date_fin) < new Date(rapportForm.date_debut)) {
      setFormError('La date de fin doit être postérieure à la date de début')
      return false
    }
    return true
  }

  // ── Générer le rapport ──
  const handleGenerateRapport = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setRapportLoading(true)
    try {
      await downloadRapportMissions({
        date_debut: rapportForm.date_debut,
        date_fin: rapportForm.date_fin,
        statut: rapportForm.statut === 'tous' ? undefined : rapportForm.statut,
      })
      toast.success('Rapport généré et téléchargé')
    } catch (error) {
      console.error('Erreur génération rapport:', error)
      toast.error('Erreur lors de la génération du rapport')
    } finally {
      setRapportLoading(false)
    }
  }

  // ── Formater une date ──
  const formatDateFR = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (isLoading) {
    return <DocumentsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/" className="hover:text-blue-600">Tableau de bord</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">Documents</span>
      </div>

      {/* ── Section 1 : Bons de livraison ── */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Bons de livraison</h2>
          <p className="text-sm text-slate-500 mt-1">
            Téléchargez les bons de livraison des missions terminées
          </p>
        </div>

        {missions.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125
                     v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625
                     c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75
                     c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
            title="Aucun document disponible"
            description="Les bons de livraison des missions terminées apparaîtront ici."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Réf
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Trajet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Chauffeur
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {missions.map((mission) => (
                  <tr key={mission.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-slate-800">
                        #{String(mission.id).padStart(4, '0')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600">
                        {formatDateFR(mission.date_mission)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-800">
                        <span className="font-medium">{mission.lieu_depart}</span>
                        <span className="mx-2 text-blue-400">→</span>
                        <span className="font-medium">{mission.lieu_arrivee}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600">
                        {mission.driver
                          ? `${mission.driver.prenom} ${mission.driver.nom.toUpperCase()}`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDownloadBL(mission.id)}
                        disabled={downloadingId === mission.id}
                        className="flex items-center justify-end gap-2 ml-auto px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        <svg
                          className={`w-4 h-4 ${downloadingId === mission.id ? 'animate-pulse' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                        {downloadingId === mission.id ? '...' : 'BL PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section 2 : Rapports (admin/gestionnaire uniquement) ── */}
      {canGenerateRapport && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">Générer un rapport de missions</h2>
            <p className="text-sm text-slate-500 mt-1">
              Créez un rapport PDF récapitulatif des missions sur une période donnée
            </p>
          </div>

          <form onSubmit={handleGenerateRapport} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date de début */}
              <div>
                <label htmlFor="date_debut" className="block text-sm font-medium text-slate-700 mb-1">
                  Date de début <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date_debut"
                  name="date_debut"
                  value={rapportForm.date_debut}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Date de fin */}
              <div>
                <label htmlFor="date_fin" className="block text-sm font-medium text-slate-700 mb-1">
                  Date de fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date_fin"
                  name="date_fin"
                  value={rapportForm.date_fin}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Statut */}
              <div>
                <label htmlFor="statut" className="block text-sm font-medium text-slate-700 mb-1">
                  Statut (optionnel)
                </label>
                <select
                  id="statut"
                  name="statut"
                  value={rapportForm.statut}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="tous">Tous les statuts</option>
                  <option value="brouillon">Brouillon</option>
                  <option value="planifiee">Planifiée</option>
                  <option value="en_cours">En cours</option>
                  <option value="terminee">Terminée</option>
                  <option value="annulee">Annulée</option>
                </select>
              </div>

              {/* Bouton */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={rapportLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <svg
                    className={`w-4 h-4 ${rapportLoading ? 'animate-spin' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  {rapportLoading ? 'Génération...' : 'Générer le rapport PDF'}
                </button>
              </div>
            </div>

            {/* Message d'erreur */}
            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}
          </form>
        </section>
      )}
    </div>
  )
}