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
 *   - Suggestions de villes pour les lieux
 *   - Vérification des conflits avant soumission
 *   - Véhicules/chauffeurs occupés apparaissent grisés
 *   - Deux boutons : "Enregistrer comme brouillon" et "Planifier"
 */

import { useState, useEffect, useRef } from 'react'
import type { Mission, MissionFormData, MissionStatut } from '../../types/mission'
import { VILLES_PRINCIPALES } from '../../types/mission'
import type { Vehicle } from '../../services/vehicleService'
import type { Driver } from '../../types/driver'
import * as missionService from '../../services/missionService'

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

  // ── État pour les suggestions ──
  const [showDepartSuggestions, setShowDepartSuggestions] = useState(false)
  const [showArriveeSuggestions, setShowArriveeSuggestions] = useState(false)
  const [filteredVilles, setFilteredVilles] = useState<string[]>([])

  // ── État pour les conflits ──
  const [conflits, setConflits] = useState<{ vehicle?: boolean; driver?: boolean }>({})
  const [occupiedVehicleIds, setOccupiedVehicleIds] = useState<number[]>([])
  const [occupiedDriverIds, setOccupiedDriverIds] = useState<number[]>([])

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
        notes: initialData.notes || '',
      })
    } else {
      setFormData(initialFormData)
    }
    setConflits({})
    setSubmitError(null)
  }, [initialData, isOpen])

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
    setConflits({})
    setSubmitError(null)
    onClose()
  }

  // ── Gestion des suggestions de villes ──
  const handleDepartChange = (value: string) => {
    setFormData(prev => ({ ...prev, lieu_depart: value }))
    if (value.length > 0) {
      setFilteredVilles(
        VILLES_PRINCIPALES.filter(v =>
          v.toLowerCase().includes(value.toLowerCase())
        )
      )
      setShowDepartSuggestions(true)
    } else {
      setShowDepartSuggestions(false)
    }
  }

  const handleArriveeChange = (value: string) => {
    setFormData(prev => ({ ...prev, lieu_arrivee: value }))
    if (value.length > 0) {
      setFilteredVilles(
        VILLES_PRINCIPALES.filter(v =>
          v.toLowerCase().includes(value.toLowerCase())
        )
      )
      setShowArriveeSuggestions(true)
    } else {
      setShowArriveeSuggestions(false)
    }
  }

  const selectVille = (ville: string, field: 'depart' | 'arrivee') => {
    if (field === 'depart') {
      setFormData(prev => ({ ...prev, lieu_depart: ville }))
      setShowDepartSuggestions(false)
    } else {
      setFormData(prev => ({ ...prev, lieu_arrivee: ville }))
      setShowArriveeSuggestions(false)
    }
  }

  // ── Vérification des conflits ──
  const checkConflits = async () => {
    if (!formData.date_mission || (!formData.vehicle_id && !formData.driver_id)) {
      setConflits({})
      return
    }

    try {
      const response = await missionService.createMission({
        ...formData,
        statut: 'brouillon',
      } as MissionFormData)

      if (!response.succes) {
        // Gérer la réponse d'erreur
      }
    } catch (error: unknown) {
      const response = error as { response?: { data?: { conflits?: { vehicle?: unknown; driver?: unknown } } } }
      if (response.response?.data?.conflits) {
        setConflits({
          vehicle: !!response.response.data.conflits.vehicle,
          driver: !!response.response.data.conflits.driver,
        })
      }
    }
  }

  // ── Soumission ──
  const handleSubmit = async (statut: MissionStatut) => {
    setSubmitError(null)

    // Validation
    if (!formData.lieu_depart.trim()) {
      setSubmitError('Le lieu de départ est obligatoire')
      return
    }
    if (!formData.lieu_arrivee.trim()) {
      setSubmitError('Le lieu d\'arrivée est obligatoire')
    }
    if (formData.lieu_depart.trim().toLowerCase() === formData.lieu_arrivee.trim().toLowerCase()) {
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
    if (statut === 'planifiee' && (conflits.vehicle || conflits.driver)) {
      setSubmitError('Conflit détecté : le véhicule ou le chauffeur est déjà occupé à cette date')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({ ...formData, statut })
      handleClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Fermer les suggestions au clic extérieur ──
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowDepartSuggestions(false)
        setShowArriveeSuggestions(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

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
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isEditing ? `Modifier la mission #${String(initialData.id).padStart(4, '0')}` : 'Nouvelle mission'}
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
        <div className="p-6 space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lieu de départ */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Lieu de départ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lieu_depart}
                  onChange={(e) => handleDepartChange(e.target.value)}
                  onFocus={() => setShowDepartSuggestions(true)}
                  placeholder="Ville de départ..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {showDepartSuggestions && filteredVilles.length > 0 && (
                  <ul className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredVilles.map((ville) => (
                      <li
                        key={ville}
                        onClick={() => selectVille(ville, 'depart')}
                        className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        {ville}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Lieu d'arrivée */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Lieu d'arrivée <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lieu_arrivee}
                  onChange={(e) => handleArriveeChange(e.target.value)}
                  onFocus={() => setShowArriveeSuggestions(true)}
                  placeholder="Ville d'arrivée..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {showArriveeSuggestions && filteredVilles.length > 0 && (
                  <ul className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredVilles.map((ville) => (
                      <li
                        key={ville}
                        onClick={() => selectVille(ville, 'arrivee')}
                        className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        {ville}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

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

            {/* Distance */}
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
                onBlur={checkConflits}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Sélectionner un véhicule...</option>
                {vehicles
                  .filter(v => v.statut === 'actif')
                  .sort((a, b) => {
                    // Trier pour mettre les véhicules occupés à la fin
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
              {conflits.vehicle && (
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
                onBlur={checkConflits}
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
              {conflits.driver && (
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
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between rounded-b-xl">
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