/**
 * MissionFormModal.tsx
 * Modal de création/modification d'une mission — TransiFlow.
 *
 * Formulaire en 3 sections :
 *   1. Trajet : lieux, date, heures, distance
 *   2. Affectation : véhicule et chauffeur
 *   3. Chargement : type, poids, notes
 *
 * Fonctionnalités :
 *   - Suggestions de villes via Nominatim
 *   - Calcul d'itinéraire et de consommation
 *   - Vérification des conflits avant soumission
 *   - Véhicules/chauffeurs occupés apparaissent grisés
 *   - Deux boutons : "Enregistrer comme brouillon" et "Planifier"
 */

import { useState, useEffect, useRef } from 'react'
import type { Mission, MissionFormData, MissionStatut } from '../../types/mission'
import type { Vehicle } from '../../services/vehicleService'
import type { Driver } from '../../types/driver'
import type { Client } from '../../types/client'
import * as missionService from '../../services/missionService'
import { getClients } from '../../services/clientService'
import CityAutocomplete from '../ui/CityAutocomplete'
import { calculerItineraire, calculerCarburant } from '../../services/geoService'
import type { Ville, Itineraire } from '../../services/geoService'

// ─────────────────────────────────────────────────────────────────────────────
// Interface des props
// ─────────────────────────────────────────────────────────────────────────────

interface MissionFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: MissionFormData) => Promise<void>
  initialData?: Mission | null
  vehicles?: Vehicle[]
  drivers?: Driver[]
  isLoading?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// État initial du formulaire
// ─────────────────────────────────────────────────────────────────────────────

const initialFormData: MissionFormData = {
  vehicle_id: null,
  driver_id: null,
  lieu_depart: '',
  lieu_arrivee: '',
  date_mission: new Date().toISOString().split('T')[0],
  heure_depart: '',
  heure_arrivee_prevue: '',
  chargement: '',
  poids_tonne: undefined,
  distance_km: undefined,
  depart_lat: null,
  depart_lng: null,
  arrivee_lat: null,
  arrivee_lng: null,
  trajet_points: null,
  notes: '',
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function MissionFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  vehicles = [],
  drivers = [],
  isLoading = false,
}: MissionFormModalProps) {
  // ── État du formulaire ──
  const [formData, setFormData] = useState<MissionFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── État pour la géolocalisation et itinéraire ──
  const [departVille, setDepartVille] = useState<Ville | null>(null)
  const [arriveeVille, setArriveeVille] = useState<Ville | null>(null)
  const [itineraire, setItineraire] = useState<Itineraire | null>(null)
  const [carburant, setCarburant] = useState<number | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // ── État pour les ressources occupées ──
  const [occupiedVehicleIds, setOccupiedVehicleIds] = useState<number[]>([])
  const [occupiedDriverIds, setOccupiedDriverIds] = useState<number[]>([])

  // ── État pour les clients ──
  const [clients, setClients] = useState<Client[]>([])

  // ── Référence pour le modal ──
  const modalRef = useRef<HTMLDivElement>(null)

  // ── Initialiser le formulaire avec les données existantes ──
  useEffect(() => {
    if (initialData) {
      setFormData({
        vehicle_id: initialData.vehicle_id || null,
        driver_id: initialData.driver_id || null,
        lieu_depart: initialData.lieu_depart,
        lieu_arrivee: initialData.lieu_arrivee,
        date_mission: initialData.date_mission,
        heure_depart: initialData.heure_depart || '',
        heure_arrivee_prevue: initialData.heure_arrivee_prevue || '',
        chargement: initialData.chargement || '',
        poids_tonne: initialData.poids_tonne || undefined,
        distance_km: initialData.distance_km || undefined,
        depart_lat: initialData.depart_lat || null,
        depart_lng: initialData.depart_lng || null,
        arrivee_lat: initialData.arrivee_lat || null,
        arrivee_lng: initialData.arrivee_lng || null,
        trajet_points: initialData.trajet_points || null,
        notes: initialData.notes || '',
      })
      // Pour l'édition, on recrée des objets Ville partiels pour l'autocomplete
      if (initialData.depart_lat && initialData.depart_lng) {
        setDepartVille({ nom: initialData.lieu_depart, affichage: initialData.lieu_depart, lat: initialData.depart_lat, lng: initialData.depart_lng })
      }
      if (initialData.arrivee_lat && initialData.arrivee_lng) {
        setArriveeVille({ nom: initialData.lieu_arrivee, affichage: initialData.lieu_arrivee, lat: initialData.arrivee_lat, lng: initialData.arrivee_lng })
      }
    } else {
      setFormData(initialFormData)
      setDepartVille(null)
      setArriveeVille(null)
      setItineraire(null)
      setCarburant(null)
    }
    setSubmitError(null)
  }, [initialData, isOpen])

  // ── Calcul itinéraire — se déclenche dès que les deux villes sont sélectionnées ──
  // Le véhicule N'EST PAS requis ici : la distance doit s'afficher immédiatement.
  useEffect(() => {
    if (!departVille || !arriveeVille) {
      setItineraire(null)
      setCarburant(null)
      return
    }

    const calculer = async () => {
      setIsCalculating(true)
      try {
        const result = await calculerItineraire(departVille, arriveeVille)
        setItineraire(result)

        // Remplir distance_km et coordonnées dans le formulaire
        setFormData(prev => ({
          ...prev,
          distance_km: result.distance_km,
          depart_lat: departVille.lat,
          depart_lng: departVille.lng,
          arrivee_lat: arriveeVille.lat,
          arrivee_lng: arriveeVille.lng,
          trajet_points: JSON.stringify(result.points),
        }))
      } catch (error) {
        console.error('Erreur calcul itinéraire:', error)

        // Fallback haversine (ligne droite) si OSRM est indisponible
        const R = 6371
        const dLat = (arriveeVille.lat - departVille.lat) * Math.PI / 180
        const dLng = (arriveeVille.lng - departVille.lng) * Math.PI / 180
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(departVille.lat * Math.PI / 180) *
          Math.cos(arriveeVille.lat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2)
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        const fallback = {
          distance_km: Math.round(distance * 10) / 10,
          duree_minutes: Math.round((distance / 60) * 60),
          points: [] as [number, number][],
        }
        setItineraire(fallback)
        setFormData(prev => ({
          ...prev,
          distance_km: fallback.distance_km,
          depart_lat: departVille.lat,
          depart_lng: departVille.lng,
          arrivee_lat: arriveeVille.lat,
          arrivee_lng: arriveeVille.lng,
        }))
      } finally {
        setIsCalculating(false)
      }
    }

    calculer()
  }, [departVille, arriveeVille])

  // ── Calcul carburant — séparé, se déclenche quand itinéraire + véhicule sont connus ──
  useEffect(() => {
    if (!itineraire || !formData.vehicle_id) {
      setCarburant(null)
      return
    }
    const vehicule = vehicles.find(v => v.id === formData.vehicle_id)
    if (!vehicule) return
    setCarburant(calculerCarburant(itineraire.distance_km, vehicule.type))
  }, [itineraire, formData.vehicle_id, vehicles])

  // ── Charger la liste des clients actifs ──
  useEffect(() => {
    if (isOpen) {
      loadClients()
    }
  }, [isOpen])

  const loadClients = async () => {
    try {
      const response = await getClients({ statut: 'actif', limit: 100 })
      if (response.succes) {
        setClients(response.donnees)
      }
    } catch (error) {
      console.error('Erreur chargement clients:', error)
    }
  }

  // ── Charger les véhicules/chauffeurs occupés pour la date sélectionnée ──
  useEffect(() => {
    if (isOpen && formData.date_mission) {
      loadOccupiedResources(formData.date_mission)
    }
  }, [formData.date_mission, isOpen])

  // ── Charger les ressources occupées ──
  const loadOccupiedResources = async (date: string) => {
    try {
      const response = await missionService.getMissionsByDate(date)
      const missions = response.donnees
      const vehicleIds = missions
        .filter((m: Mission) => m.vehicle_id && m.statut !== 'annulee')
        .map((m: Mission) => m.vehicle_id) as number[]
      const driverIds = missions
        .filter((m: Mission) => m.driver_id && m.statut !== 'annulee')
        .map((m: Mission) => m.driver_id) as number[]
      setOccupiedVehicleIds([...new Set(vehicleIds)])
      setOccupiedDriverIds([...new Set(driverIds)])
    } catch {
      setOccupiedVehicleIds([])
      setOccupiedDriverIds([])
    }
  }

  // ── Gestion de la fermeture ──
  const handleClose = () => {
    setFormData(initialFormData)
    setDepartVille(null)
    setArriveeVille(null)
    setItineraire(null)
    setCarburant(null)
    setSubmitError(null)
    onClose()
  }

  // ── Soumission ──
  const handleSubmit = async (statut: MissionStatut) => {
    if (isSubmitting) return
    setSubmitError(null)

    // Validation
    if (!formData.lieu_depart.trim() && !departVille) {
      setSubmitError('Le lieu de départ est obligatoire')
      return
    }
    if (!formData.lieu_arrivee.trim() && !arriveeVille) {
      setSubmitError('Le lieu d\'arrivée est obligatoire')
      return
    }
    
    const dName = departVille ? departVille.nom : formData.lieu_depart
    const aName = arriveeVille ? arriveeVille.nom : formData.lieu_arrivee

    if (dName.trim().toLowerCase() === aName.trim().toLowerCase()) {
      setSubmitError('Le lieu de départ et d\'arrivée doivent être différents')
      return
    }
    if (!formData.date_mission) {
      setSubmitError('La date de mission est obligatoire')
      return
    }

    // Pour une mission planifiée, véhicule et chauffeur sont obligatoires
    if (statut === 'planifiee') {
      if (!formData.vehicle_id) {
        setSubmitError('Le véhicule est obligatoire pour planifier une mission')
        return
      }
      if (!formData.driver_id) {
        setSubmitError('Le chauffeur est obligatoire pour planifier une mission')
        return
      }
    }

    // Vérifier les conflits pour une mission planifiée
    if (statut === 'planifiee' && formData.vehicle_id && occupiedVehicleIds.includes(Number(formData.vehicle_id))) {
      setSubmitError('Conflit détecté : ce véhicule est déjà occupé à cette date')
      return
    }
    if (statut === 'planifiee' && formData.driver_id && occupiedDriverIds.includes(Number(formData.driver_id))) {
      setSubmitError('Conflit détecté : ce chauffeur est déjà occupé à cette date')
      return
    }

    setIsSubmitting(true)
    try {
      const finalData: MissionFormData = { ...formData, statut }
      
      if (departVille) {
        finalData.lieu_depart = departVille.nom
        finalData.depart_lat = departVille.lat
        finalData.depart_lng = departVille.lng
      }
      if (arriveeVille) {
        finalData.lieu_arrivee = arriveeVille.nom
        finalData.arrivee_lat = arriveeVille.lat
        finalData.arrivee_lng = arriveeVille.lng
      }
      if (itineraire) {
        finalData.distance_km = itineraire.distance_km
        finalData.trajet_points = JSON.stringify(itineraire.points)
      }

      await onSubmit(finalData)
      handleClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Ne pas afficher si le modal est fermé ──
  if (!isOpen) return null

  const isEditing = !!initialData?.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-[60]">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isEditing ? `Modifier la mission #${String(initialData?.id).padStart(4, '0')}` : 'Nouvelle mission'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEditing ? 'Modifiez les informations de la mission' : 'Planifiez une nouvelle mission de transport'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corps du formulaire */}
        <div className="p-6 space-y-6 overflow-visible">
          {/* Message d'erreur global */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m9-.27a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0z" />
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          {/* Section 1 : Trajet */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Trajet</h3>
            </div>

            {/* Client associé */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Client (optionnel)
              </label>
              <select
                value={formData.client_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Sans client (mission interne)</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.nom}{client.telephone ? ` — ${client.telephone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="z-50">
                <CityAutocomplete
                  label="Lieu de départ"
                  placeholder="Ville de départ..."
                  value={formData.lieu_depart}
                  onChange={(val) => setFormData(prev => ({ ...prev, lieu_depart: val }))}
                  onSelect={(ville) => setDepartVille(ville)}
                />
              </div>

              <div className="z-50">
                <CityAutocomplete
                  label="Lieu d'arrivée"
                  placeholder="Ville d'arrivée..."
                  value={formData.lieu_arrivee}
                  onChange={(val) => setFormData(prev => ({ ...prev, lieu_arrivee: val }))}
                  onSelect={(ville) => setArriveeVille(ville)}
                />
              </div>
            </div>

            {/* Bloc résultat : visible dès que le calcul est en cours ou terminé */}
            {isCalculating && (
              <div className="bg-slate-50 border-l-4 border-slate-200 rounded-r-lg p-3 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            )}

            {!isCalculating && itineraire && (
              <div className="bg-[#EFF6FF] border-l-[3px] border-[#1E40AF] rounded-r-lg p-3 transition-opacity duration-300">
                <p className="text-xs font-semibold text-blue-900 mb-2">
                  Itinéraire calculé automatiquement
                </p>
                <div className="border-t border-blue-200/50 my-2"></div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {/* Distance */}
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <span>🛣</span>
                    <span><span className="font-medium">{itineraire.distance_km}</span> km</span>
                  </div>
                  {/* Durée estimée */}
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <span>⏱</span>
                    <span>
                      <span className="font-medium">
                        {Math.floor(itineraire.duree_minutes / 60)}h{' '}
                        {itineraire.duree_minutes % 60}min
                      </span>
                    </span>
                  </div>
                  {/* Carburant — affiché uniquement quand un véhicule est sélectionné */}
                  {carburant !== null && (
                    <div className="flex items-center gap-1.5 text-blue-800">
                      <span>⛽</span>
                      <span>
                        ~<span className="font-medium">{carburant}</span> litres
                        <span className="text-blue-600 text-xs ml-1">estimés</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Date et heures */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Date de mission <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date_mission}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_mission: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Heure de départ
                </label>
                <input
                  type="time"
                  value={formData.heure_depart || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, heure_depart: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Heure d'arrivée prévue
                </label>
                <input
                  type="time"
                  value={formData.heure_arrivee_prevue || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, heure_arrivee_prevue: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Distance manuelle si pas d'itinéraire calculé */}
            {!itineraire && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Distance (km)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.distance_km || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, distance_km: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="Distance en kilomètres..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Section 2 : Affectation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M20 14.66V20.25a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 20.25v-2.5m16 0v-2.5m0 0a2.25 2.25 0 00-2.25-2.25H8.25a2.25 2.25 0 00-2.25 2.25m6 0V9m0 0c0-.494-.125-.964-.347-1.378a2.25 2.25 0 00-3.353-.622 2.25 2.25 0 00-.347 1.378V12m0 0h3" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Affectation</h3>
            </div>

            {/* Véhicule */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Véhicule
              </label>
              <select
                value={formData.vehicle_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, vehicle_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Sélectionner un véhicule...</option>
                {vehicles
                  .filter(v => v.statut === 'actif')
                  .sort((a, b) => {
                    const aOccupied = occupiedVehicleIds.includes(a.id)
                    const bOccupied = occupiedVehicleIds.includes(b.id)
                    if (aOccupied === bOccupied) return 0
                    return aOccupied ? 1 : -1
                  })
                  .map(vehicle => {
                    const isOccupied = occupiedVehicleIds.includes(vehicle.id)
                    return (
                      <option
                        key={vehicle.id}
                        value={vehicle.id}
                        disabled={isOccupied}
                        className={isOccupied ? 'text-slate-400' : ''}
                      >
                        {vehicle.immatriculation} — {vehicle.type} (cap. {vehicle.capacite})
                        {isOccupied ? ' (occupé)' : ''}
                      </option>
                    )
                  })}
              </select>
              {formData.vehicle_id && occupiedVehicleIds.includes(Number(formData.vehicle_id)) && (
                <p className="mt-1.5 text-xs text-orange-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 9v3.75m9-.27a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Ce véhicule est déjà assigné à une mission ce jour-là
                </p>
              )}
            </div>

            {/* Chauffeur */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Chauffeur
              </label>
              <select
                value={formData.driver_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, driver_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Sélectionner un chauffeur...</option>
                {drivers
                  .filter(d => d.statut === 'actif')
                  .sort((a, b) => {
                    const aOccupied = occupiedDriverIds.includes(a.id)
                    const bOccupied = occupiedDriverIds.includes(b.id)
                    if (aOccupied === bOccupied) return 0
                    return aOccupied ? 1 : -1
                  })
                  .map(driver => {
                    const isOccupied = occupiedDriverIds.includes(driver.id)
                    return (
                      <option
                        key={driver.id}
                        value={driver.id}
                        disabled={isOccupied}
                        className={isOccupied ? 'text-slate-400' : ''}
                      >
                        {driver.prenom} {driver.nom.toUpperCase()} — {driver.numero_permis}
                        {isOccupied ? ' (occupé)' : ''}
                      </option>
                    )
                  })}
              </select>
              {formData.driver_id && occupiedDriverIds.includes(Number(formData.driver_id)) && (
                <p className="mt-1.5 text-xs text-orange-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 9v3.75m9-.27a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Ce chauffeur est déjà assigné à une mission ce jour-là
                </p>
              )}
            </div>
          </div>

          {/* Section 3 : Chargement */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Chargement</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Type de chargement
                </label>
                <input
                  type="text"
                  value={formData.chargement || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, chargement: e.target.value }))}
                  placeholder="Marchandises, passagers..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Poids (tonnes)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.poids_tonne || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, poids_tonne: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Informations complémentaires..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between rounded-b-xl z-[60]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSubmit('brouillon')}
              disabled={isSubmitting || isLoading}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enregistrer comme brouillon
            </button>
            <button
              onClick={() => handleSubmit('planifiee')}
              disabled={isSubmitting || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Enregistrement...' : 'Planifier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}