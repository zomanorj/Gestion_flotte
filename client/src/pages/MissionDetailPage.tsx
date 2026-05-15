/**
 * MissionDetailPage.tsx
 * Page de détail d'une mission — TransiFlow.
 *
 * Affiche :
 *   - Breadcrumb de navigation
 *   - Hero section avec référence et statut
 *   - MissionStatutStepper (workflow visuel)
 *   - Grille d'infos : Trajet, Affectation, Chargement, Notes
 *   - Liens vers les fiches véhicule et chauffeur
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuth } from '../contexts/AuthContext'
import MissionStatutStepper from '../components/missions/MissionStatutStepper'

import type { Mission, MissionStatut } from '../types/mission'
import { STATUT_COLORS, STATUT_LABELS } from '../types/mission'
import * as missionService from '../services/missionService'
import { downloadBonLivraison } from '../services/documentService'
import { getInitials } from '../utils/avatarColor'
import * as financeService from '../services/financeService'
import DepenseFormModal from '../components/finance/DepenseFormModal'
import { formatMGA, formatDateCourte } from '../utils/format'
import type { Depense, CategoriDepense } from '../types/finance'
import type { Client } from '../types/client'
import { getClient } from '../services/clientService'
import * as factureService from '../services/factureService'

const LABELS_CATEGORIE: Record<CategoriDepense, string> = {
  carburant: '⛽ Carburant', peage: '🛣 Péage',
  salaire: '👷 Salaire', maintenance: '🔧 Maintenance', autre: '📦 Autre',
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton de chargement
// ─────────────────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-slate-200 rounded w-48" />
      <div className="h-24 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 bg-slate-200 rounded-xl" />
        <div className="h-40 bg-slate-200 rounded-xl" />
        <div className="h-40 bg-slate-200 rounded-xl" />
        <div className="h-40 bg-slate-200 rounded-xl" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte d'information
// ─────────────────────────────────────────────────────────────────────────────

interface InfoCardProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}

function InfoCard({ title, icon, children, className = '' }: InfoCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { utilisateur } = useAuth()

  const [mission, setMission] = useState<Mission | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadLoading, setDownloadLoading] = useState(false)

  // États pour la section coûts
  const [depenses, setDepenses]           = useState<Depense[]>([])
  const [coutTotal, setCoutTotal]         = useState(0)
  const [loadingDepenses, setLoadingDepenses] = useState(false)
  const [isDepenseModalOpen, setIsDepenseModalOpen] = useState(false)

  // États pour le client lié
  const [client, setClient] = useState<Client | null>(null)
  const [loadingClient, setLoadingClient] = useState(false)

  // ── Charger la mission ──
  useEffect(() => {
    if (!id) return

    missionService.getMission(parseInt(id, 10))
      .then(response => {
        setMission(response.donnees)
        setError(null)
      })
      .catch(() => {
        setError('Impossible de charger les détails de la mission')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [id])

  // ── Charger le client lié à la mission ──
  useEffect(() => {
    if (mission?.client_id) {
      setLoadingClient(true)
      getClient(mission.client_id)
        .then(clientData => {
          setClient(clientData)
        })
        .catch(() => {
          console.error('Erreur chargement client')
        })
        .finally(() => {
          setLoadingClient(false)
        })
    } else {
      setClient(null)
    }
  }, [mission?.client_id])

  // ── Vérifier si une facture existe déjà pour cette mission ──
  const canGenerateInvoice = mission && mission.statut === 'terminee' && client && !loadingClient

  // ── Générer une facture depuis la mission ──
  const handleGenerateInvoice = async () => {
    if (!mission || !client) return

    try {
      // Calculer un montant HT basé sur la distance (tarif exemple: 3000 MGA/km)
      const montantHT = (mission.distance_km || 0) * 3000
      const tauxTVA = 20

      const factureData = {
        client_id: client.id,
        mission_id: mission.id,
        description: `Transport ${mission.lieu_depart} → ${mission.lieu_arrivee} le ${mission.date_mission}`,
        montant_ht: montantHT,
        taux_tva: tauxTVA,
        date_emission: new Date().toISOString().split('T')[0],
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        statut: 'brouillon' as const,
      }

      const facture = await factureService.createFacture(factureData)
      toast.success(`Facture ${facture.numero || 'créée'} avec succès`)
      navigate(`/factures/${facture.id || ''}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
    }
  }

  // ── Gestion du changement de statut ──
  const handleStatutChange = async (nouveauStatut: MissionStatut) => {
    if (!id) return

    try {
      const response = await missionService.updateStatut(parseInt(id, 10), nouveauStatut)
      setMission(response.donnees)
      toast.success('Statut mis à jour avec succès')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
    }
  }

  // ── Chargement des coûts de la mission ──
  const chargerCouts = useCallback(() => {
    if (!id) return
    setLoadingDepenses(true)
    Promise.all([
      financeService.getDepenses({ mission_id: parseInt(id, 10), limit: 50 }),
      financeService.getCoutMission(parseInt(id, 10)),
    ]).then(([dep, cout]) => {
      setDepenses(dep.donnees)
      setCoutTotal(cout.total_general)
    }).catch(() => {}).finally(() => setLoadingDepenses(false))
  }, [id])

  useEffect(() => { chargerCouts() }, [chargerCouts])

  // ── Permissions ──
  const canEdit = utilisateur?.role === 'admin' || utilisateur?.role === 'gestionnaire'

  // ── Vérifier si on peut télécharger le bon de livraison ──
  const canDownloadBL = mission && mission.statut !== 'brouillon' && mission.statut !== 'annulee'

  // ── Télécharger le bon de livraison ──
  const handleDownloadBL = async () => {
    if (!mission) return

    setDownloadLoading(true)
    try {
      await downloadBonLivraison(mission.id)
      toast.success('Bon de livraison téléchargé')
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error)
      toast.error('Erreur lors du téléchargement du PDF')
    } finally {
      setDownloadLoading(false)
    }
  }

  // ── Formatage de la date ──
  const formatDateFR = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb skeleton */}
        <div className="h-4 bg-slate-200 rounded w-64" />
        <DetailSkeleton />
      </div>
    )
  }

  if (error || !mission) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/missions" className="hover:text-blue-600">Missions</Link>
          <span>/</span>
          <span>Détail</span>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg
            className="w-12 h-12 text-red-400 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m9-.27a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0z" />
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-red-700 font-medium">{error || 'Mission introuvable'}</p>
          <button
            onClick={() => navigate('/missions')}
            className="mt-4 px-4 py-2 text-sm text-red-600 hover:bg-red-100 rounded-lg transition-colors"
          >
            Retour aux missions
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/" className="hover:text-blue-600">Tableau de bord</Link>
        <span>/</span>
        <Link to="/missions" className="hover:text-blue-600">Missions</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">Mission #{String(mission.id).padStart(4, '0')}</span>
      </div>

      {/* ── Bandeau client lié à la mission ── */}
      {mission.client_id && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
          {/* Icône immeuble */}
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          {/* Infos client */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">Client</p>
            <p className="text-sm font-medium text-slate-800 truncate">{mission.client_nom}</p>
            {mission.client_telephone && (
              <p className="text-xs text-slate-500">
                <span className="mr-1">📞</span>{mission.client_telephone}
              </p>
            )}
          </div>
          {/* Lien vers fiche client */}
          <Link
            to={`/clients/${mission.client_id}`}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap transition-colors"
          >
            Voir la fiche &rarr;
          </Link>
        </div>
      )}

      {/* ── Hero Section ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">
                Mission #{String(mission.id).padStart(4, '0')}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[mission.statut]}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                {STATUT_LABELS[mission.statut]}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {formatDateFR(mission.date_mission)}
              {mission.heure_depart && ` à ${mission.heure_depart.substring(0, 5)}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canDownloadBL && (
              <button
                onClick={handleDownloadBL}
                disabled={downloadLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${downloadLoading ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {downloadLoading ? '...' : 'Bon de livraison'}
              </button>
            )}
            {canGenerateInvoice && (
              <button
                onClick={handleGenerateInvoice}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Générer facture
              </button>
            )}
            <button
              onClick={() => navigate('/missions')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 1l9-9 9 9M15 12V3" />
              </svg>
              Retour à la liste
            </button>
          </div>
        </div>

        {/* Stepper de statut */}
        <MissionStatutStepper
          statut={mission.statut}
          onStatutChange={canEdit ? handleStatutChange : undefined}
          canEdit={canEdit}
        />
      </div>

      {/* ── Grille d'informations ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Carte Trajet */}
        <InfoCard
          title="Trajet"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          }
        >
          <div className="space-y-4">
            {/* Départ */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.125 3.375c0 .621-.504 1.125-1.125 1.125h-.75a.75.75 0 010-1.5h.75c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-.75a.75.75 0 010-1.5h.75c.621 0 1.125.504 1.125 1.125v.375" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Départ</p>
                <p className="font-medium text-slate-800">{mission.lieu_depart}</p>
              </div>
            </div>

            {/* Ligne pointillée */}
            <div className="flex items-center gap-3 pl-4">
              <div className="flex-1 border-t-2 border-dashed border-slate-300 relative">
                <div className="absolute right-0 -top-1.5 w-3 h-3 text-slate-300">
                  <svg fill="currentColor" viewBox="0 0 12 12">
                    <path d="M2 6h8M8 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
              </div>
              {mission.distance_km && (
                <span className="text-xs text-slate-500">{mission.distance_km} km</span>
              )}
            </div>

            {/* Arrivée */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Arrivée</p>
                <p className="font-medium text-slate-800">{mission.lieu_arrivee}</p>
              </div>
            </div>
          </div>
        </InfoCard>

        {/* Carte Affectation */}
        <InfoCard
          title="Affectation"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20 14.66V20.25a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 20.25v-2.5m16 0v-2.5m0 0a2.25 2.25 0 00-2.25-2.25H8.25a2.25 2.25 0 00-2.25 2.25m6 0V9m0 0c0-.494-.125-.964-.347-1.378a2.25 2.25 0 00-3.353-.622 2.25 2.25 0 00-.347 1.378V12m0 0h3" />
            </svg>
          }
        >
          <div className="space-y-4">
            {/* Véhicule */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Véhicule</p>
              {mission.vehicle ? (
                <Link
                  to={`/vehicles/${mission.vehicle_id}`}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H3m16.5 0h-.375M3.75 18.75V7.5A2.25 2.25 0 016 5.25h10.5A2.25 2.25 0 0118.75 7.5v6.75m-15 4.5h.375m14.625 0h.375m-14.625 0H3.75M18.75 14.25h-3.375a.75.75 0 01-.75-.75v-3a.75.75 0 01.75-.75h2.625c.621 0 1.125.504 1.125 1.125v3.375z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                      {mission.vehicle.immatriculation}
                    </p>
                    <p className="text-xs text-slate-500">{mission.vehicle.type} — cap. {mission.vehicle.capacite}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <p className="text-slate-400 text-sm">Aucun véhicule assigné</p>
              )}
            </div>

            {/* Chauffeur */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Chauffeur</p>
              {mission.driver ? (
                <Link
                  to={`/drivers/${mission.driver_id}`}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                    {getInitials(mission.driver.prenom, mission.driver.nom)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 group-hover:text-emerald-600 transition-colors">
                      {mission.driver.prenom} {mission.driver.nom.toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-500">Permis : {mission.driver.numero_permis}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <p className="text-slate-400 text-sm">Aucun chauffeur assigné</p>
              )}
            </div>
          </div>
        </InfoCard>

        {/* Carte Chargement */}
        <InfoCard
          title="Chargement"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          }
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Type</p>
              <p className="font-medium text-slate-800">{mission.chargement || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Poids</p>
              <p className="font-medium text-slate-800">
                {mission.poids_tonne ? `${mission.poids_tonne} tonnes` : '—'}
              </p>
            </div>
          </div>
        </InfoCard>

        {/* Carte Informations complémentaires */}
        <InfoCard
          title="Informations"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Créée le</span>
              <span className="text-slate-800 font-medium">
                {new Date(mission.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dernière modification</span>
              <span className="text-slate-800 font-medium">
                {new Date(mission.updated_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {mission.heure_arrivee_prevue && (
              <div className="flex justify-between">
                <span className="text-slate-500">Arrivée prévue</span>
                <span className="text-slate-800 font-medium">{mission.heure_arrivee_prevue.substring(0, 5)}</span>
              </div>
            )}
          </div>
        </InfoCard>

        {/* Section Coûts de la mission */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Coûts de la mission</h3>
              {canEdit && (
                <button
                  onClick={() => setIsDepenseModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ajouter une dépense
                </button>
              )}
            </div>

            {loadingDepenses ? (
              <div className="animate-pulse p-6 space-y-3">
                {[0,1,2].map(i => <div key={i} className="h-4 bg-slate-200 rounded" />)}
              </div>
            ) : depenses.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">
                Aucune dépense enregistrée pour cette mission.
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-50">
                  {depenses.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600">{LABELS_CATEGORIE[d.categorie]}</span>
                        {d.description && (
                          <span className="text-xs text-slate-400 truncate max-w-[200px]">{d.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400">{formatDateCourte(d.date_depense)}</span>
                        <span className="text-sm font-semibold text-slate-800">{formatMGA(d.montant)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <span className="text-sm font-bold text-slate-800">
                    Total : {formatMGA(coutTotal)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Carte Notes (pleine largeur) */}
        {mission.notes && (
          <div className="md:col-span-2">
            <InfoCard
              title="Notes"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.862 4.489l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              }
            >
              <p className="text-slate-600 whitespace-pre-wrap">{mission.notes}</p>
            </InfoCard>
          </div>
        )}
      </div>

      {/* Modal dépense liée à la mission */}
      <DepenseFormModal
        isOpen={isDepenseModalOpen}
        onClose={() => setIsDepenseModalOpen(false)}
        onSuccess={chargerCouts}
        defaultMissionId={mission?.id}
        defaultVehicleId={mission?.vehicle_id ?? undefined}
      />
    </div>
  )
}