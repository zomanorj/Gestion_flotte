// client/src/pages/ClientDetailPage.tsx

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getClient, getClientMissions } from '../services/clientService'
import { getFactures } from '../services/factureService'
import type { Client, Facture, Transaction } from '../types/client'
import type { Mission } from '../types/mission'
import { formatMGA } from '../utils/format'
import ClientFormModal from '../components/clients/ClientFormModal'
import { usePageTitle } from '../hooks/usePageTitle'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const clientId = parseInt(id || '0', 10)

  const [client, setClient] = useState<Client | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [factures, setFactures] = useState<Facture[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'infos' | 'missions' | 'factures' | 'credit'>('infos')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [isRecharging, setIsRecharging] = useState(false)

  /* Titre du navigateur : nom du client une fois chargé */
  usePageTitle(client?.nom ?? 'Clients')

  // Lecture du paramètre tab dans l'URL si existant (ex: ?tab=factures)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'missions' || tab === 'factures' || tab === 'infos' || tab === 'credit') {
      setActiveTab(tab)
    }
  }, [])

  useEffect(() => {
    if (clientId) {
      loadData()
    }
  }, [clientId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [clientRes, missionsRes, facturesRes, txRes] = await Promise.all([
        getClient(clientId),
        getClientMissions(clientId, { limit: 50 }),
        getFactures({ client_id: clientId, limit: 50 }),
        import('../services/clientService').then(m => m.getClientTransactions(clientId))
      ])
      
      setClient(clientRes)
      if (missionsRes.succes) setMissions(missionsRes.donnees)
      if (facturesRes.succes) setFactures(facturesRes.donnees)
      if (txRes.succes) setTransactions(txRes.donnees)
    } catch (error) {
      console.error('Erreur lors du chargement des détails du client', error)
      toast.error('Impossible de charger les détails du client')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rechargeAmount || isNaN(Number(rechargeAmount)) || Number(rechargeAmount) <= 0) return
    
    setIsRecharging(true)
    try {
      const { addCreditTransaction } = await import('../services/clientService')
      await addCreditTransaction(clientId, {
        type_transaction: 'credit',
        montant: Number(rechargeAmount),
        description: 'Recharge manuelle'
      })
      setRechargeAmount('')
      loadData()
    } catch (error) {
      console.error('Erreur lors de la recharge', error)
      toast.error('Erreur lors de la recharge du crédit')
    } finally {
      setIsRecharging(false)
    }
  }

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'entreprise': return '🏢'
      case 'administration': return '🏛️'
      case 'particulier': return '👤'
      default: return '🏢'
    }
  }

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'entreprise': return 'text-blue-500 bg-blue-50'
      case 'administration': return 'text-purple-500 bg-purple-50'
      case 'particulier': return 'text-emerald-500 bg-emerald-50'
      default: return 'text-slate-500 bg-slate-50'
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center p-12 bg-white rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold text-slate-800">Client introuvable</h2>
        <Link to="/clients" className="text-blue-600 hover:underline mt-4 inline-block">Retour à la liste</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-bold ${getTypeColor(client.type_client)}`}>
              {getTypeIcon(client.type_client)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{client.nom}</h1>
                <span className={`text-xs uppercase font-bold px-2 py-1 rounded-full ${client.statut === 'actif' ? 'bg-emerald-100 text-emerald-700' : client.statut === 'suspendu' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                  {client.statut}
                </span>
                <span className="text-xs uppercase font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  {client.type_client}
                </span>
              </div>
              <div className="flex items-center gap-4 text-slate-500 text-sm mt-2">
                {client.ville && <span>📍 {client.ville}</span>}
                {client.telephone && <span>📞 {client.telephone}</span>}
                {client.email && <span>📧 {client.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Modifier
            </button>
            <Link
              to="/factures" // Pourrait ouvrir le modal directement si on le passe par param
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              + Nouvelle facture
            </Link>
          </div>
        </div>
      </div>

      {/* Grille KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center text-xl">
            🚚
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">Total missions</div>
            <div className="text-2xl font-bold text-slate-800">{client.total_missions || 0}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center text-xl">
            💰
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">Chiffre d'affaires</div>
            <div className="text-xl font-bold text-slate-800">{formatMGA(client.ca_total || 0)}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${client.factures_impayees ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
            🧾
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">Factures impayées</div>
            <div className={`text-2xl font-bold ${client.factures_impayees ? 'text-red-600' : 'text-slate-800'}`}>
              {client.factures_impayees || 0}
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center text-xl">
            💳
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">Solde de crédit</div>
            <div className="text-xl font-bold text-slate-800">{formatMGA(client.solde_credit || 0)}</div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('infos')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'infos' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Informations
          </button>
          <button
            onClick={() => setActiveTab('missions')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'missions' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Missions ({missions.length})
          </button>
          <button
            onClick={() => setActiveTab('factures')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'factures' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Factures ({factures.length})
          </button>
          <button
            onClick={() => setActiveTab('credit')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'credit' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Compte de Crédit
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'infos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Coordonnées</h3>
                  <div className="space-y-3 text-sm">
                    {client.nom_contact && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Contact :</span>
                        <span className="col-span-2 font-medium text-slate-800">{client.nom_contact}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-slate-500">Téléphone 1 :</span>
                      <span className="col-span-2 font-medium text-slate-800">{client.telephone}</span>
                    </div>
                    {client.telephone2 && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Téléphone 2 :</span>
                        <span className="col-span-2 font-medium text-slate-800">{client.telephone2}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Email :</span>
                        <span className="col-span-2 font-medium text-blue-600">{client.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Localisation</h3>
                  <div className="space-y-3 text-sm">
                    {client.ville && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Ville :</span>
                        <span className="col-span-2 font-medium text-slate-800">{client.ville}</span>
                      </div>
                    )}
                    {client.adresse && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Adresse :</span>
                        <span className="col-span-2 font-medium text-slate-800 whitespace-pre-wrap">{client.adresse}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {client.type_client === 'entreprise' && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Informations Fiscales</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">NIF :</span>
                        <span className="col-span-2 font-medium text-slate-800">{client.nif || '—'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">STAT :</span>
                        <span className="col-span-2 font-medium text-slate-800">{client.stat || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Notes Internes</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
                    {client.notes || 'Aucune note interne pour ce client.'}
                  </div>
                </div>
                
                <div className="text-xs text-slate-400 pt-4">
                  Créé le : {new Date(client.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'missions' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Trajet</th>
                    <th className="pb-3 font-medium">Distance</th>
                    <th className="pb-3 font-medium">Statut</th>
                    <th className="pb-3 font-medium">Facture</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700">
                  {missions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Aucune mission pour ce client.</td>
                    </tr>
                  ) : (
                    missions.map(mission => (
                      <tr key={mission.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3">{new Date(mission.date_mission).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 font-medium">
                          {mission.lieu_depart} <span className="text-slate-400 mx-1">→</span> {mission.lieu_arrivee}
                        </td>
                        <td className="py-3">{mission.distance_km ? `${mission.distance_km} km` : '—'}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-md text-[11px] font-medium uppercase
                            ${mission.statut === 'terminee' ? 'bg-emerald-100 text-emerald-700' :
                              mission.statut === 'en_cours' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'}`}>
                            {mission.statut.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3">
                          {mission.facture_numero ? (
                            <Link to={`/factures`} className="text-blue-600 hover:underline">{mission.facture_numero}</Link>
                          ) : (
                            <span className="text-slate-400">Non facturée</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'factures' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 font-medium">N° Facture</th>
                    <th className="pb-3 font-medium">Date d'émission</th>
                    <th className="pb-3 font-medium">Montant TTC</th>
                    <th className="pb-3 font-medium">Statut</th>
                    <th className="pb-3 font-medium">Mode</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700">
                  {factures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Aucune facture pour ce client.</td>
                    </tr>
                  ) : (
                    factures.map(facture => (
                      <tr key={facture.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-medium text-slate-800">{facture.numero}</td>
                        <td className="py-3">{new Date(facture.date_emission).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 font-medium text-slate-800">{formatMGA(facture.montant_ttc)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-md text-[11px] font-medium uppercase
                            ${facture.statut === 'payee' ? 'bg-emerald-100 text-emerald-700' :
                              facture.statut === 'annulee' ? 'bg-red-100 text-red-700 line-through' :
                              facture.statut === 'envoyee' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'}`}>
                            {facture.statut}
                          </span>
                        </td>
                        <td className="py-3 capitalize text-slate-500">{facture.mode_paiement || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'credit' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Historique des transactions</h3>
                <form onSubmit={handleRecharge} className="flex gap-2">
                  <input
                    type="number"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    placeholder="Montant à recharger"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    min="1"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isRecharging}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isRecharging ? '...' : '+ Recharger'}
                  </button>
                </form>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Description</th>
                      <th className="p-4 font-medium text-right">Débit</th>
                      <th className="p-4 font-medium text-right">Crédit</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">Aucune transaction pour le moment.</td>
                      </tr>
                    ) : (
                      transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 whitespace-nowrap">{new Date(tx.created_at).toLocaleString('fr-FR')}</td>
                          <td className="p-4">{tx.description || (tx.type_transaction === 'credit' ? 'Recharge compte' : 'Paiement facture')} {tx.facture_id && <span className="text-xs text-slate-400 ml-2">(Facture #{tx.facture_id})</span>}</td>
                          <td className="p-4 text-right text-red-600 font-medium">{tx.type_transaction === 'debit' ? `-${formatMGA(tx.montant)}` : '—'}</td>
                          <td className="p-4 text-right text-emerald-600 font-medium">{tx.type_transaction === 'credit' ? `+${formatMGA(tx.montant)}` : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <ClientFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false)
            loadData()
          }}
          client={client}
        />
      )}
    </div>
  )
}
