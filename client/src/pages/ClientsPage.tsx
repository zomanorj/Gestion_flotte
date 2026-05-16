// client/src/pages/ClientsPage.tsx

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getClients } from '../services/clientService'
import type { Client } from '../types/client'
import ClientFormModal from '../components/clients/ClientFormModal'
import { formatMGA } from '../utils/format'
import { usePageTitle } from '../hooks/usePageTitle'

export default function ClientsPage() {
  usePageTitle('Clients')
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('actif')
  const [typeFilter, setTypeFilter] = useState('tous')
  const [page, setPage] = useState(1)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined)

  useEffect(() => {
    fetchClients()
  }, [search, statutFilter, typeFilter, page])

  const fetchClients = async () => {
    setIsLoading(true)
    try {
      const response = await getClients({
        search,
        statut: statutFilter,
        type_client: typeFilter,
        page,
        limit: 12
      })
      if (response.succes) {
        setClients(response.donnees)
        setTotal(response.pagination.total)
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des clients', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'entreprise': return '🏢'
      case 'administration': return '🏛️'
      case 'particulier': return '👤'
      default: return '🏢'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'entreprise': return 'text-blue-500 bg-blue-50'
      case 'administration': return 'text-purple-500 bg-purple-50'
      case 'particulier': return 'text-emerald-500 bg-emerald-50'
      default: return 'text-slate-500 bg-slate-50'
    }
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingClient(undefined)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clients</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gérez votre base de clients et vos facturations. ({total} client{total > 1 ? 's' : ''})
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau client
        </button>
      </div>

      {/* Barre de filtres */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, ville..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="tous">Tous les types</option>
            <option value="entreprise">Entreprises</option>
            <option value="particulier">Particuliers</option>
            <option value="administration">Administrations</option>
          </select>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={statutFilter}
            onChange={(e) => {
              setStatutFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="tous">Tous les statuts</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Inactifs</option>
            <option value="suspendu">Suspendus</option>
          </select>
        </div>
      </div>

      {/* Liste des clients */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-200 rounded w-full"></div>
                <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                <div className="h-4 bg-slate-200 rounded w-4/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="text-slate-400 mb-4 flex justify-center">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">Aucun client trouvé</h3>
          <p className="text-slate-500">Essayez de modifier vos filtres ou ajoutez un nouveau client.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div key={client.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${getTypeColor(client.type_client)}`}>
                      {getTypeIcon(client.type_client)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-lg group-hover:text-blue-600 transition-colors line-clamp-1" title={client.nom}>
                        {client.nom}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${client.statut === 'actif' ? 'bg-emerald-100 text-emerald-700' : client.statut === 'suspendu' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                          {client.statut}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600 mb-6">
                  {client.nom_contact && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <span className="truncate">{client.nom_contact}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <span>{client.telephone}</span>
                  </div>
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.ville && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="truncate">{client.ville}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-0.5">Missions</div>
                    <div className="font-semibold text-slate-700">{client.total_missions || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-0.5">Chiffre d'affaires</div>
                    <div className="font-semibold text-blue-600">{formatMGA(client.ca_total || 0)}</div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 rounded-b-xl flex items-center justify-between">
                <button
                  onClick={() => handleEdit(client)}
                  className="text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors"
                >
                  Modifier
                </button>
                <div className="flex gap-4">
                  <Link
                    to={`/clients/${client.id}?tab=factures`}
                    className="text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors"
                  >
                    Factures
                  </Link>
                  <Link
                    to={`/clients/${client.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                  >
                    Détails →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination basique */}
      {total > 12 && (
        <div className="flex justify-center mt-8">
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / 12)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <ClientFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false)
            fetchClients()
          }}
          client={editingClient}
        />
      )}
    </div>
  )
}
