/**
 * SuiviPage.tsx
 * Page de suivi en temps réel des missions — TransiFlow.
 *
 * Fonctionnalités :
 *   - Carte interactive Leaflet avec les véhicules en mission
 *   - Liste des missions actives avec sélection
 *   - Rafraîchissement automatique toutes les 30 secondes
 *   - Panneau de détail avec bouton PDF
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import * as trackingService from '../services/trackingService'
import { downloadBonLivraison } from '../services/documentService'
import type { TrackingMission } from '../services/trackingService'

// ─────────────────────────────────────────────────────────────────────────────
// Correction bug icône Leaflet par défaut
// ─────────────────────────────────────────────────────────────────────────────

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ─────────────────────────────────────────────────────────────────────────────
// Thèmes de carte
// ─────────────────────────────────────────────────────────────────────────────

const TILE_LAYERS = {
  sombre: {
    label: 'Sombre',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  clair: {
    label: 'Clair',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  standard: {
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sélecteur de thème
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeControlProps {
  theme: string;
  setTheme: (theme: string) => void;
}

const ThemeControl = ({ theme, setTheme }: ThemeControlProps) => {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 1000,
      display: 'flex',
      gap: '4px',
      background: 'rgba(0,0,0,0.4)',
      padding: '4px',
      borderRadius: '10px',
      backdropFilter: 'blur(4px)'
    }}>
      {(Object.keys(TILE_LAYERS) as Array<keyof typeof TILE_LAYERS>).map((t) => {
        let icon = ''
        if (t === 'clair') icon = '☀'
        if (t === 'sombre') icon = '☾'
        if (t === 'standard') icon = '🌍'
        
        const isActive = theme === t
        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            style={{
              background: isActive ? 'white' : 'transparent',
              color: isActive ? '#1E293B' : 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 200ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: isActive ? '600' : '400'
            }}
            title={TILE_LAYERS[t].label}
          >
            <span>{icon}</span>
            <span className="hidden md:inline">{TILE_LAYERS[t].label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icône personnalisée pour les véhicules
// ─────────────────────────────────────────────────────────────────────────────

const createTruckIcon = (progression: number, theme: string) => {
  let color = ''
  if (theme === 'sombre') {
    if (progression < 34) color = '#60A5FA'
    else if (progression < 67) color = '#FBBF24'
    else if (progression < 100) color = '#34D399'
    else color = '#10B981'
  } else {
    if (progression < 34) color = '#1E40AF'
    else if (progression < 67) color = '#D97706'
    else if (progression < 100) color = '#059669'
    else color = '#065F46'
  }

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
      ">
        <!-- Halo lumineux -->
        <div style="
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.25;
          animation: pulse 2s infinite;
        "></div>
        <!-- Corps du marqueur -->
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ">
          <!-- SVG camion blanc -->
          <svg width="18" height="18" viewBox="0 0 24 24"
               fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  })
}




// Centre de la carte (Madagascar)
const MAP_CENTRE: [number, number] = [-19.0, 46.5]
const MAP_ZOOM = 6

// ─────────────────────────────────────────────────────────────────────────────
// Composant pour centrer la carte sur un marqueur
// ─────────────────────────────────────────────────────────────────────────────

interface CenterMapProps {
  position: [number, number] | null
  zoom?: number
}

function CenterMap({ position, zoom = 10 }: CenterMapProps) {
  const map = useMap()

  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 1 })
    }
  }, [position, zoom, map])

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton de chargement
// ─────────────────────────────────────────────────────────────────────────────

function SuiviSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-64 mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 h-[500px] bg-slate-200 rounded-xl" />
        <div className="lg:col-span-3 h-[500px] bg-slate-200 rounded-xl" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function SuiviPage() {
  const navigate = useNavigate()
  const [missions, setMissions] = useState<TrackingMission[]>([])
  const [selectedMission, setSelectedMission] = useState<TrackingMission | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)

  // Thème de la carte
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('transiflow_map_theme') || 'sombre'
  })

  // Persister le thème
  useEffect(() => {
    localStorage.setItem('transiflow_map_theme', theme)
  }, [theme])

  // Rafraîchir les données
  const fetchMissions = async (showToast = false) => {
    try {
      const response = await trackingService.getActiveVehicles()
      setMissions(response.donnees)
      setLastUpdate(new Date())
      if (showToast) {
        toast.success('Carte actualisée')
      }
    } catch (error) {
      console.error('Erreur lors du chargement des missions:', error)
      if (showToast) {
        toast.error('Erreur lors du rafraîchissement')
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Chargement initial
  useEffect(() => {
    fetchMissions()
  }, [])

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMissions()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // Gestion sélection mission
  const handleSelectMission = (mission: TrackingMission) => {
    setSelectedMission(mission)
  }

  // Rafraîchissement manuel
  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchMissions(true)
  }

  // Télécharger le bon de livraison
  const handleDownloadBL = async () => {
    if (!selectedMission) return

    setDownloadLoading(true)
    try {
      await downloadBonLivraison(selectedMission.mission_id)
      toast.success('Bon de livraison téléchargé')
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error)
      toast.error('Erreur lors du téléchargement du PDF')
    } finally {
      setDownloadLoading(false)
    }
  }

  // Calculer le temps écoulé depuis la dernière mise à jour
  const getTimeAgo = () => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000)

    if (diff < 5) return "à l'instant"
    if (diff < 60) return `il y a ${diff}s`
    const minutes = Math.floor(diff / 60)
    return `il y a ${minutes}min`
  }

  // Obtenir la position pour la carte
  const getMapPosition = (mission: TrackingMission): [number, number] | null => {
    if (mission.position) {
      return [mission.position.latitude, mission.position.longitude]
    }
    return null
  }

  // Ligne de trajet pour la mission sélectionnée
  const getTrajetLine = (): [number, number][] | null => {
    if (!selectedMission) return null

    if (selectedMission.trajet_points) {
      try {
        const points = JSON.parse(selectedMission.trajet_points)
        if (Array.isArray(points) && points.length > 0) {
          return points as [number, number][]
        }
      } catch (e) {
        console.error('Erreur parsing trajet JSON', e)
      }
    }

    // Fallback à la ligne droite
    if (selectedMission.depart_lat && selectedMission.depart_lng &&
        selectedMission.arrivee_lat && selectedMission.arrivee_lng) {
      return [
        [selectedMission.depart_lat, selectedMission.depart_lng],
        [selectedMission.arrivee_lat, selectedMission.arrivee_lng]
      ]
    }
    
    return null
  }

  // Calculer la progression (0 à 100%)
  const getProgression = (mission: TrackingMission): number => {
    if (!mission.position) return 0
    if (!mission.depart_lat || !mission.depart_lng || !mission.arrivee_lat || !mission.arrivee_lng) return 50
    
    const startLatLng = L.latLng(mission.depart_lat, mission.depart_lng)
    const endLatLng = L.latLng(mission.arrivee_lat, mission.arrivee_lng)
    const currentLatLng = L.latLng(mission.position.latitude, mission.position.longitude)
    
    const totalDist = startLatLng.distanceTo(endLatLng)
    if (totalDist === 0) return 100
    
    const currentDist = startLatLng.distanceTo(currentLatLng)
    let prog = Math.round((currentDist / totalDist) * 100)
    
    if (prog > 100) prog = 100
    if (prog < 0) prog = 0
    
    return prog
  }

  if (isLoading) {
    return <SuiviSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">Suivi en temps réel</h1>
            {missions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-sm text-emerald-600 font-medium">Live</span>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {missions.length} véhicule{missions.length > 1 ? 's' : ''} en mission
            <span className="mx-2">•</span>
            <span className="text-slate-400">{getTimeAgo()}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Layout deux colonnes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── Colonne gauche : Liste des missions (40%) ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Liste des missions actives */}
          <div className={`rounded-xl border overflow-hidden transition-colors duration-200 ${
            theme === 'sombre' ? 'bg-[#0F172A] border-[#334155]' : 'bg-white border-slate-200'
          }`}>
            <div className={`px-4 py-3 border-b ${theme === 'sombre' ? 'border-[#334155]' : 'border-slate-100'}`}>
              <h2 className={`text-sm font-semibold ${theme === 'sombre' ? 'text-[#F1F5F9]' : 'text-slate-700'}`}>
                Missions en cours
              </h2>
            </div>

            {missions.length === 0 ? (
              <div className="p-8 text-center">
                <svg
                  className="w-12 h-12 text-slate-300 mx-auto mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H3m16.5 0h-.375M3.75 18.75V7.5A2.25 2.25 0 016 5.25h10.5A2.25 2.25 0 0118.75 7.5v6.75m-15 4.5h.375m14.625 0h.375m-14.625 0H3.75M18.75 14.25h-3.375a.75.75 0 01-.75-.75v-3a.75.75 0 01.75-.75h2.625c.621 0 1.125.504 1.125 1.125v3.375z"
                  />
                </svg>
                <p className="text-slate-500 text-sm">Aucune mission en cours</p>
              </div>
            ) : (
              <div className={`divide-y max-h-[450px] overflow-y-auto ${theme === 'sombre' ? 'divide-[#334155]' : 'divide-slate-100'}`}>
                {missions.map((mission) => {
                  const isSelected = selectedMission?.mission_id === mission.mission_id
                  const bgClass = theme === 'sombre'
                    ? (isSelected ? 'bg-[#1E3A5F] border-l-4 border-[#3B82F6]' : 'bg-[#1E293B] hover:bg-[#1E3A5F] border-l-4 border-transparent')
                    : (isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white hover:bg-slate-50 border-l-4 border-transparent')

                  return (
                    <button
                      key={mission.mission_id}
                      onClick={() => handleSelectMission(mission)}
                      className={`w-full text-left p-4 transition-colors ${bgClass}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-semibold ${theme === 'sombre' ? 'text-[#F1F5F9]' : 'text-slate-800'}`}>
                              {mission.vehicle.immatriculation}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                              En cours
                            </span>
                          </div>
                          <p className={`text-sm ${theme === 'sombre' ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                            {mission.driver.prenom} {mission.driver.nom.toUpperCase()}
                          </p>
                          <div className={`flex items-center gap-1 text-xs mt-1 ${theme === 'sombre' ? 'text-[#94A3B8]' : 'text-slate-400'}`}>
                            <span>{mission.lieu_depart}</span>
                            <span className="text-blue-400">→</span>
                            <span>{mission.lieu_arrivee}</span>
                          </div>
                        </div>
                        {mission.position && (
                          <div className="text-xs text-slate-400 text-right shrink-0">
                            <p>{mission.position.vitesse} km/h</p>
                            {mission.position.est_simulee ? (
                              <span className="text-slate-300">~</span>
                            ) : (
                              <span className="text-emerald-500">●</span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Panneau détail (visible si mission sélectionnée) ── */}
          {selectedMission && (
            <div className={`rounded-xl border p-4 animate-in slide-in-from-bottom-4 duration-300 ${
              theme === 'sombre' ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className={`font-semibold ${theme === 'sombre' ? 'text-[#F1F5F9]' : 'text-slate-800'}`}>
                    Mission #{String(selectedMission.mission_id).padStart(4, '0')}
                  </h3>
                  <p className={`text-sm ${theme === 'sombre' ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                    {new Date(selectedMission.date_mission).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    {selectedMission.heure_depart && ` à ${selectedMission.heure_depart.substring(0, 5)}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMission(null)}
                  className={`${theme === 'sombre' ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={theme === 'sombre' ? 'text-[#94A3B8]' : 'text-slate-500'}>Véhicule</span>
                  <span className={`font-medium ${theme === 'sombre' ? 'text-[#F1F5F9]' : 'text-slate-800'}`}>{selectedMission.vehicle.immatriculation}</span>
                </div>
                <div className="flex justify-between">
                  <span className={theme === 'sombre' ? 'text-[#94A3B8]' : 'text-slate-500'}>Type</span>
                  <span className={`font-medium ${theme === 'sombre' ? 'text-[#F1F5F9]' : 'text-slate-800'}`}>{selectedMission.vehicle.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className={theme === 'sombre' ? 'text-[#94A3B8]' : 'text-slate-500'}>Chauffeur</span>
                  <span className={`font-medium ${theme === 'sombre' ? 'text-[#F1F5F9]' : 'text-slate-800'}`}>
                    {selectedMission.driver.prenom} {selectedMission.driver.nom.toUpperCase()}
                  </span>
                </div>
                {selectedMission.driver.telephone && (
                  <div className="flex justify-between">
                    <span className={theme === 'sombre' ? 'text-[#94A3B8]' : 'text-slate-500'}>Téléphone</span>
                    <span className={`font-medium ${theme === 'sombre' ? 'text-[#F1F5F9]' : 'text-slate-800'}`}>{selectedMission.driver.telephone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className={theme === 'sombre' ? 'text-[#94A3B8]' : 'text-slate-500'}>Trajet</span>
                  <span className={`font-medium text-right max-w-[200px] ${theme === 'sombre' ? 'text-[#F1F5F9]' : 'text-slate-800'}`}>
                    {selectedMission.lieu_depart} → {selectedMission.lieu_arrivee}
                  </span>
                </div>
              </div>

              <div className={`flex gap-2 mt-4 pt-4 border-t ${theme === 'sombre' ? 'border-[#334155]' : 'border-slate-100'}`}>
                <button
                  onClick={() => navigate(`/missions/${selectedMission.mission_id}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-1.5 7.5V21m0 0l3-3m-3 3l-3-3" />
                  </svg>
                  Voir la mission
                </button>
                <button
                  onClick={handleDownloadBL}
                  disabled={downloadLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${downloadLoading ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {downloadLoading ? '...' : 'Bon de livraison'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne droite : Carte (60%) ── */}
        <div className="lg:col-span-3">
          <div className="relative bg-white rounded-xl border border-slate-200 overflow-hidden h-[500px]">
            <ThemeControl theme={theme} setTheme={setTheme} />
            <MapContainer
              center={MAP_CENTRE}
              zoom={MAP_ZOOM}
              style={{ width: '100%', height: '100%', zIndex: 0 }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution={TILE_LAYERS[theme as keyof typeof TILE_LAYERS].attribution}
                url={TILE_LAYERS[theme as keyof typeof TILE_LAYERS].url}
              />

              {/* Centrer sur la mission sélectionnée */}
              {selectedMission && (
                <CenterMap position={getMapPosition(selectedMission)} zoom={9} />
              )}

              {/* Lignes et points de trajet pour la mission sélectionnée */}
              {selectedMission && getTrajetLine() && (
                <>
                  {/* Trajet complet (pointillé) */}
                  <Polyline
                    positions={getTrajetLine()!}
                    color={theme === 'sombre' ? '#475569' : '#94A3B8'}
                    weight={2}
                    dashArray="6 6"
                    opacity={theme === 'sombre' ? 0.6 : 0.7}
                  />

                  {/* Portion parcourue (pleine) */}
                  {selectedMission.position && (
                    <Polyline
                      positions={[
                        getTrajetLine()![0],
                        [selectedMission.position.latitude, selectedMission.position.longitude]
                      ]}
                      color={theme === 'sombre' ? '#60A5FA' : '#1E40AF'}
                      weight={3}
                      opacity={0.9}
                    />
                  )}

                  {/* Marqueurs Départ et Arrivée */}
                  <CircleMarker
                    center={getTrajetLine()![0]}
                    radius={8}
                    fillColor={theme === 'sombre' ? '#34D399' : '#059669'}
                    fillOpacity={1}
                    color="white"
                    weight={2}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      <span style={{ fontSize: '11px' }}>🟢 Départ</span>
                    </Tooltip>
                  </CircleMarker>
                  <CircleMarker
                    center={getTrajetLine()![getTrajetLine()!.length - 1]}
                    radius={8}
                    fillColor={theme === 'sombre' ? '#F87171' : '#DC2626'}
                    fillOpacity={1}
                    color="white"
                    weight={2}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      <span style={{ fontSize: '11px' }}>🔴 Arrivée</span>
                    </Tooltip>
                  </CircleMarker>
                </>
              )}



              {/* Marqueurs des véhicules */}
              {missions.map((mission) => {
                const position = getMapPosition(mission)
                if (!position) return null

                const progression = getProgression(mission)

                return (
                  <Marker
                    key={mission.mission_id}
                    position={position}
                    icon={createTruckIcon(progression, theme)}
                    eventHandlers={{
                      click: () => handleSelectMission(mission),
                    }}
                  >
                    <Popup className={theme === 'sombre' ? 'leaflet-popup-dark' : ''}>
                      {theme === 'sombre' ? (
                        <div style={{ padding: '14px' }}>
                          {/* Header */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '10px',
                            paddingBottom: '10px',
                            borderBottom: '1px solid #334155',
                          }}>
                            <div style={{ fontSize: '20px' }}>🚛</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                {mission.vehicle.immatriculation}
                              </div>
                              <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                                {mission.driver.prenom} {mission.driver.nom.toUpperCase()}
                              </div>
                            </div>
                          </div>

                          {/* Trajet */}
                          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#CBD5E1' }}>
                            📍 {mission.lieu_depart} → {mission.lieu_arrivee}
                          </div>

                          {/* Vitesse/Position actuelle */}
                          <div style={{
                            fontSize: '12px',
                            color: '#60A5FA',
                            marginBottom: '10px',
                          }}>
                            Vitesse actuelle : {mission.position?.vitesse ?? 0} km/h
                          </div>

                          {/* Barre de progression */}
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '11px',
                              color: '#94A3B8',
                              marginBottom: '4px',
                            }}>
                              <span>Progression</span>
                              <span>{progression}%</span>
                            </div>
                            <div style={{
                              height: '6px',
                              background: '#334155',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${progression}%`,
                                background: 'linear-gradient(90deg, #3B82F6, #34D399)',
                                borderRadius: '3px',
                                transition: 'width 0.5s',
                              }}></div>
                            </div>
                          </div>

                          {/* Heure départ */}
                          {mission.heure_depart && (
                            <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
                              ⏱ Départ : {mission.heure_depart.substring(0, 5)}
                            </div>
                          )}

                          {/* Bouton */}
                          <Link to={`/missions/${mission.mission_id}`} style={{
                            display: 'block',
                            textAlign: 'center',
                            background: '#1E40AF',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}>
                            Voir la mission →
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-2 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {mission.vehicle.immatriculation}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              En cours
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            {mission.driver.prenom} {mission.driver.nom.toUpperCase()}
                          </p>
                          <div className="text-sm">
                            <span className="text-slate-500">Trajet : </span>
                            <span className="text-slate-800">
                              {mission.lieu_depart} → {mission.lieu_arrivee}
                            </span>
                          </div>
                          {mission.heure_depart && (
                            <div className="text-sm">
                              <span className="text-slate-500">Départ : </span>
                              <span className="text-slate-800">{mission.heure_depart.substring(0, 5)}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-slate-100">
                            <Link
                              to={`/missions/${mission.mission_id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Voir la mission →
                            </Link>
                          </div>
                        </div>
                      )}
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  )
}