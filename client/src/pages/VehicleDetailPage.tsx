/**
 * VehicleDetailPage.tsx
 * Page de détail d'un véhicule de la flotte — TransiFlow.
 *
 * Affiche toutes les informations d'un véhicule identifié par son :id dans l'URL :
 *   - Header : breadcrumb, bouton retour, immatriculation, badge statut, actions
 *   - Informations générales : type, capacité, kilométrage
 *   - Documents & Validité  : assurance + visite technique avec badges colorés
 *   - Notes                 : texte libre ou message "aucune note"
 *   - Historique missions   : tableau des 5 dernières missions
 *
 * États gérés :
 *   - Skeleton loading pendant le chargement initial
 *   - Page d'erreur 404 si le véhicule n'existe pas
 *   - Modal de modification pré-remplie
 *   - Confirmation + toast pour l'archivage
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuth }           from '../contexts/AuthContext'
import VehicleFormModal      from '../components/vehicles/VehicleFormModal'
import apiClient             from '../services/api'

import * as vehicleService   from '../services/vehicleService'
import type { Vehicle, VehicleFormData } from '../services/vehicleService'

import {
  formatDateFR,
  calculerJoursRestants,
  getDocumentEtat,
  getStatutClasses,
  getStatutLabel,
  getTypeLabel,
} from '../utils/vehicleUtils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Structure minimale d'une mission pour l'historique (Sprint 4 complétera ce type) */
interface MissionHistorique {
  id:           number
  lieu_depart:  string
  lieu_arrivee: string
  date_mission: string
  chauffeur_nom?: string
  statut:       'planifiee' | 'en_cours' | 'terminee' | 'annulee'
}

// ─────────────────────────────────────────────────────────────────────────────
// Service missions (minimal — endpoint à implémenter au Sprint 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getMissionsVehicle
 * Récupère les 5 dernières missions d'un véhicule.
 * Retourne [] silencieusement si l'endpoint n'existe pas encore (404).
 */
async function getMissionsVehicle(vehicleId: number): Promise<MissionHistorique[]> {
  try {
    const { data } = await apiClient.get(
      `/api/missions?vehicle_id=${vehicleId}&limit=5&sort=desc`
    )
    return (data.donnees ?? []) as MissionHistorique[]
  } catch {
    // L'endpoint /api/missions n'est pas encore implémenté (Sprint 4)
    // On retourne silencieusement un tableau vide
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant BadgeDocument
// Badge coloré pour l'état d'un document (assurance ou visite technique)
// ─────────────────────────────────────────────────────────────────────────────

interface BadgeDocumentProps {
  dateStr: string | null
}

function BadgeDocument({ dateStr }: BadgeDocumentProps) {
  const etat         = getDocumentEtat(dateStr)
  const joursRestants = dateStr ? calculerJoursRestants(dateStr) : null

  // Configuration visuelle selon l'état du document
  const configEtat = {
    valide:          { classes: 'bg-emerald-100 text-emerald-700', label: 'Valide' },
    bientot_expiree: { classes: 'bg-orange-100  text-orange-700',  label: 'Bientôt expirée' },
    expiree:         { classes: 'bg-red-100     text-red-700',     label: 'Expirée' },
  }[etat]

  return (
    <div className="space-y-1">
      {/* Date formatée */}
      <p className="text-sm font-medium text-slate-800">{formatDateFR(dateStr)}</p>

      {/* Badge coloré */}
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${configEtat.classes}`}>
        {configEtat.label}
      </span>

      {/* Jours restants / dépassés */}
      {joursRestants !== null && (
        <p className="text-xs text-slate-400">
          {joursRestants >= 0
            ? `${joursRestants} jour${joursRestants > 1 ? 's' : ''} restant${joursRestants > 1 ? 's' : ''}`
            : `Expirée depuis ${Math.abs(joursRestants)} jour${Math.abs(joursRestants) > 1 ? 's' : ''}`
          }
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant SkeletonDetail (squelette de chargement)
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonDetail() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-48" />
          <div className="flex items-center gap-3">
            <div className="h-8 bg-slate-200 rounded w-36" />
            <div className="h-6 bg-slate-200 rounded-full w-20" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-slate-200 rounded-lg w-24" />
          <div className="h-9 bg-slate-200 rounded-lg w-24" />
        </div>
      </div>

      {/* Grille de cartes skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="h-5 bg-slate-200 rounded w-1/2" />
            <div className="border-t border-slate-100 pt-4 space-y-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex justify-between items-center">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Notes skeleton (pleine largeur) */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="h-5 bg-slate-200 rounded w-1/4" />
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant BadgeMissionStatut — badge coloré pour le statut d'une mission
// ─────────────────────────────────────────────────────────────────────────────

function BadgeMissionStatut({ statut }: { statut: MissionHistorique['statut'] }) {
  const config = {
    planifiee: { classes: 'bg-blue-100  text-blue-700',    label: 'Planifiée'  },
    en_cours:  { classes: 'bg-orange-100 text-orange-700', label: 'En cours'   },
    terminee:  { classes: 'bg-emerald-100 text-emerald-700', label: 'Terminée' },
    annulee:   { classes: 'bg-slate-100  text-slate-600',  label: 'Annulée'    },
  }[statut] ?? { classes: 'bg-slate-100 text-slate-600', label: statut }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      {config.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant LigneInfo — ligne étiquette / valeur dans une carte
// ─────────────────────────────────────────────────────────────────────────────

interface LigneInfoProps {
  label:   string
  valeur:  React.ReactNode
}

function LigneInfo({ label, valeur }: LigneInfoProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{valeur}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal VehicleDetailPage
// ─────────────────────────────────────────────────────────────────────────────

export default function VehicleDetailPage() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const { utilisateur } = useAuth()

  // ── État de la page ──
  const [vehicle,      setVehicle]      = useState<Vehicle | null>(null)
  const [missions,     setMissions]     = useState<MissionHistorique[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [erreur404,    setErreur404]    = useState(false)
  const [isModalOpen,  setIsModalOpen]  = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isArchiving,  setIsArchiving]  = useState(false)

  // ── Permissions ──
  const peutModifier = utilisateur?.role === 'admin' || utilisateur?.role === 'gestionnaire'
  const peutArchiver = utilisateur?.role === 'admin'

  // ── Chargement initial : véhicule + missions ──
  useEffect(() => {
    if (!id) return

    const chargerDonnees = async () => {
      setIsLoading(true)
      setErreur404(false)

      try {
        // Chargement parallèle du véhicule et de ses missions
        const [reponseVehicle, listeMissions] = await Promise.all([
          vehicleService.getVehicle(Number(id)),
          getMissionsVehicle(Number(id)),
        ])

        setVehicle(reponseVehicle.donnees)
        setMissions(listeMissions)
      } catch (erreur: unknown) {
        const status = (erreur as { response?: { status?: number } })?.response?.status
        if (status === 404) {
          setErreur404(true)
        } else {
          toast.error('Impossible de charger les données du véhicule')
          navigate('/vehicles')
        }
      } finally {
        setIsLoading(false)
      }
    }

    chargerDonnees()
  }, [id, navigate])

  // ── Handler : soumettre la modification ──
  const handleSoumettreModification = async (data: VehicleFormData) => {
    if (!vehicle) return
    setIsSubmitting(true)
    try {
      const reponse = await vehicleService.updateVehicle(vehicle.id, data)
      setVehicle(reponse.donnees)
      setIsModalOpen(false)
      toast.success('Véhicule modifié avec succès')
    } catch (erreur: unknown) {
      const message = (erreur as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de la modification'
      toast.error(message)
      throw erreur // Le modal reste ouvert en cas d'erreur
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Handler : archiver le véhicule ──
  const handleArchiver = async () => {
    if (!vehicle) return
    const confirme = window.confirm(
      `Voulez-vous vraiment archiver le véhicule ${vehicle.immatriculation} ?\n` +
      'Cette action est réversible via le formulaire de modification.'
    )
    if (!confirme) return

    setIsArchiving(true)
    try {
      await vehicleService.deleteVehicle(vehicle.id)
      toast.success(`Véhicule ${vehicle.immatriculation} archivé`)
      navigate('/vehicles')
    } catch {
      toast.error("Erreur lors de l'archivage")
    } finally {
      setIsArchiving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendu : skeleton loading
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Bouton retour */}
        <button
          onClick={() => navigate('/vehicles')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Retour à la flotte
        </button>
        <SkeletonDetail />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendu : erreur 404
  // ─────────────────────────────────────────────────────────────────────────
  if (erreur404 || !vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="font-semibold text-slate-700 mb-1">Véhicule introuvable</p>
        <p className="text-sm text-slate-400 mb-5">
          Le véhicule demandé n'existe pas ou a été supprimé.
        </p>
        <button
          onClick={() => navigate('/vehicles')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retour à la flotte
        </button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendu principal
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header : breadcrumb + retour ── */}
      <div>
        {/* Breadcrumb cliquable */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <Link to="/" className="hover:text-slate-600 transition-colors">Tableau de bord</Link>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <Link to="/vehicles" className="hover:text-slate-600 transition-colors">Flotte</Link>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-slate-600 font-medium">{vehicle.immatriculation}</span>
        </nav>

        {/* Titre + actions */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          {/* Bouton retour + titre */}
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => navigate('/vehicles')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Retour
            </button>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">
                {vehicle.immatriculation}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${getStatutClasses(vehicle.statut)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {getStatutLabel(vehicle.statut)}
              </span>
            </div>
          </div>

          {/* Boutons d'action (admin/gestionnaire uniquement) */}
          {(peutModifier || peutArchiver) && (
            <div className="flex items-center gap-2">
              {peutModifier && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M16.862 4.489l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07
                         a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z
                         m0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.5 21H5.25A2.25 2.25 0 013 18.75V8.25
                         A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  Modifier
                </button>
              )}
              {peutArchiver && vehicle.statut !== 'archive' && (
                <button
                  onClick={handleArchiver}
                  disabled={isArchiving}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isArchiving ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5
                           M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375
                           c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  )}
                  Archiver
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Grille d'informations ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Carte : Informations générales */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H3m16.5 0h-.375
                     M3.75 18.75V7.5A2.25 2.25 0 016 5.25h10.5A2.25 2.25 0 0118.75 7.5v6.75m-15 4.5h.375
                     m14.625 0h.375m-14.625 0H3.75M18.75 14.25h-3.375a.75.75 0 01-.75-.75v-3
                     a.75.75 0 01.75-.75h2.625c.621 0 1.125.504 1.125 1.125v3.375z
                     M20.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-800">Informations générales</h2>
          </div>

          <div className="divide-y divide-slate-50">
            <LigneInfo label="Type de véhicule"  valeur={getTypeLabel(vehicle.type)} />
            <LigneInfo label="Capacité"          valeur={`${vehicle.capacite} tonne${vehicle.capacite > 1 ? 's' : ''}`} />
            <LigneInfo label="Kilométrage"       valeur={`${vehicle.kilometrage.toLocaleString('fr-FR')} km`} />
            <LigneInfo label="Ajouté le"         valeur={formatDateFR(vehicle.created_at)} />
            <LigneInfo label="Dernière mise à jour" valeur={formatDateFR(vehicle.updated_at)} />
          </div>
        </div>

        {/* Carte : Documents & Validité */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749
                     c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751
                     h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-800">Documents & Validité</h2>
          </div>

          <div className="space-y-5">
            {/* Assurance */}
            <div className="flex items-start justify-between">
              <span className="text-sm text-slate-500 mt-0.5">Assurance</span>
              <BadgeDocument dateStr={vehicle.date_assurance} />
            </div>

            <div className="border-t border-slate-100" />

            {/* Visite technique */}
            <div className="flex items-start justify-between">
              <span className="text-sm text-slate-500 mt-0.5">Visite technique</span>
              <BadgeDocument dateStr={vehicle.date_visite_technique} />
            </div>
          </div>
        </div>

        {/* Carte : Notes (pleine largeur) */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125
                     v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625
                     c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75
                     c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-800">Notes</h2>
          </div>

          {vehicle.notes ? (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {vehicle.notes}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Aucune note pour ce véhicule.
            </p>
          )}
        </div>
      </div>

      {/* ── Section : Historique des missions ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header de la section */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82
                     c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252
                     a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18
                     c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497
                     c.317.158.69.158 1.006 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-800">
              Historique des missions
            </h2>
            {missions.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {missions.length} dernière{missions.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {missions.length === 0 ? (
          /* État vide */
          <div className="py-12 px-4 text-center">
            <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82
                   c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252
                   a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18
                   c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497
                   c.317.158.69.158 1.006 0z" />
            </svg>
            <p className="text-sm text-slate-400">Aucune mission pour ce véhicule</p>
            <p className="text-xs text-slate-300 mt-1">
              L'historique sera disponible au Sprint 4
            </p>
          </div>
        ) : (
          /* Tableau des missions */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Trajet</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Chauffeur</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {missions.map((mission) => (
                  <tr key={mission.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-slate-600">
                      {formatDateFR(mission.date_mission)}
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-slate-800">{mission.lieu_depart}</span>
                      <span className="text-slate-400 mx-1.5">→</span>
                      <span className="text-slate-800">{mission.lieu_arrivee}</span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {mission.chauffeur_nom ?? '—'}
                    </td>
                    <td className="px-6 py-3">
                      <BadgeMissionStatut statut={mission.statut} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de modification ── */}
      <VehicleFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSoumettreModification}
        initialData={vehicle}
        isLoading={isSubmitting}
      />
    </div>
  )
}
