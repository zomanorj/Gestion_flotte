// client/src/pages/FacturesPage.tsx

import { useState, useEffect } from 'react'
import { getFactures, getFactureStats, downloadFacturePDF } from '../services/factureService'
import type { Facture, FactureStats } from '../types/client'
import { formatMGA } from '../utils/format'
import FactureFormModal  from '../components/factures/FactureFormModal'
import PaiementModal     from '../components/factures/PaiementModal'
import { Link } from 'react-router-dom'

export default function FacturesPage() {
  const [factures, setFactures] = useState<Facture[]>([])
  const [stats, setStats] = useState<FactureStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const [statutFilter, setStatutFilter] = useState('tous')
  const [page, setPage] = useState(1)

  const [isModalOpen,    setIsModalOpen]    = useState(false)
  const [editingFacture, setEditingFacture] = useState<Facture | undefined>(undefined)
  // Modal paiement progressif
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false)
  const [selectedFacture,     setSelectedFacture]     = useState<Facture | null>(null)

  useEffect(() => {
    loadData()
  }, [statutFilter, page])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [facturesRes, statsRes] = await Promise.all([
        getFactures({
          statut: statutFilter,
          page,
          limit: 15
        }),
        getFactureStats()
      ])

      if (facturesRes.succes) {
        setFactures(facturesRes.donnees)
        setTotal(facturesRes.pagination.total)
      }
      
      setStats(statsRes)
    } catch (error) {
      console.error('Erreur de chargement des factures', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadPDF = async (facture: Facture) => {
    try {
      await downloadFacturePDF(facture.id, facture.numero)
    } catch (error) {
      alert('Erreur lors du téléchargement du PDF')
    }
  }

  const estEnRetard = (facture: Facture) => {
    if (facture.statut === 'payee' || facture.statut === 'annulee') return false
    if (!facture.date_echeance) return false
    return new Date(facture.date_echeance) < new Date()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Factures</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gérez votre facturation et suivez vos encaissements.
          </p>
        </div>
        <button
          onClick={() => { setEditingFacture(undefined); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle facture
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500 font-medium mb-1">Total émises</div>
            <div className="text-2xl font-bold text-slate-800">{stats.total_emises}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
            <div className="text-sm text-emerald-600 font-medium mb-1">Montant encaissé</div>
            <div className="text-2xl font-bold text-emerald-700">{formatMGA(stats.montant_encaisse)}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-sm">
            <div className="text-sm text-blue-600 font-medium mb-1">Montant en attente</div>
            <div className="text-2xl font-bold text-blue-700">{formatMGA(stats.montant_en_attente)}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-red-200 bg-red-50/50 shadow-sm">
            <div className="text-sm text-red-600 font-medium mb-1">Factures impayées</div>
            <div className="text-2xl font-bold text-red-700">{stats.total_impayees}</div>
          </div>
        </div>
      )}

      {/* Liste des factures */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50">
          <h2 className="font-semibold text-slate-800">Toutes les factures</h2>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={statutFilter}
            onChange={(e) => { setStatutFilter(e.target.value); setPage(1); }}
          >
            <option value="tous">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="envoyee">Envoyée</option>
            <option value="payee">Payée</option>
            <option value="annulee">Annulée</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-sm text-slate-500">
                <th className="p-4 font-medium">N° Facture</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Mission</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Échéance</th>
                <th className="p-4 font-medium">Montant TTC</th>
                <th className="p-4 font-medium">Statut</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <svg className="animate-spin h-6 w-6 text-blue-600 mx-auto" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </td>
                </tr>
              ) : factures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">Aucune facture trouvée.</td>
                </tr>
              ) : (
                factures.map(facture => {
                  const enRetard = estEnRetard(facture)
                  return (
                    <tr key={facture.id} className={`hover:bg-slate-50 transition-colors ${enRetard ? 'bg-orange-50/30' : ''}`}>
                      <td className="p-4 font-semibold text-slate-800">{facture.numero}</td>
                      <td className="p-4">
                        <Link to={`/clients/${facture.client_id}`} className="font-medium text-blue-600 hover:underline">
                          {facture.client_nom}
                        </Link>
                      </td>
                      <td className="p-4 text-slate-500">
                        {facture.mission_id ? (
                          <Link to={`/missions/${facture.mission_id}`} className="hover:text-blue-600 hover:underline">
                            #{String(facture.mission_id).padStart(4, '0')}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="p-4">{new Date(facture.date_emission).toLocaleDateString('fr-FR')}</td>
                      <td className="p-4">
                        {facture.date_echeance ? (
                          <span className={enRetard ? 'text-red-600 font-medium' : ''}>
                            {new Date(facture.date_echeance).toLocaleDateString('fr-FR')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-4 font-bold text-slate-800">{formatMGA(facture.montant_ttc)}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-1 rounded-md text-[11px] font-medium uppercase
                            ${facture.statut === 'payee'    ? 'bg-emerald-100 text-emerald-700' :
                              facture.statut === 'annulee'  ? 'bg-red-100 text-red-700 line-through' :
                              facture.statut === 'partiel'  ? 'bg-orange-100 text-orange-700' :
                              facture.statut === 'envoyee'  ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'}`}>
                            {facture.statut === 'partiel' ? '● Partiel' : facture.statut}
                          </span>
                          {enRetard && (
                            <span className="text-[10px] font-bold text-red-600 uppercase">En retard</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownloadPDF(facture)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Télécharger PDF"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          {/* Modifier si brouillon */}
                          {facture.statut === 'brouillon' && (
                            <button
                              onClick={() => { setEditingFacture(facture); setIsModalOpen(true) }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Modifier"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {/* Bouton paiement si envoyée ou partielle */}
                          {(facture.statut === 'envoyee' || facture.statut === 'partiel') && (
                            <button
                              onClick={() => { setSelectedFacture(facture); setIsPaiementModalOpen(true) }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Enregistrer un paiement"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 15 && (
          <div className="p-4 border-t border-slate-200 flex justify-center bg-slate-50">
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 15)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal création / modification facture */}
      {isModalOpen && (
        <FactureFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); loadData() }}
          facture={editingFacture}
        />
      )}

      {/* Modal paiements progressifs */}
      {isPaiementModalOpen && selectedFacture && (
        <PaiementModal
          isOpen={isPaiementModalOpen}
          onClose={() => { setIsPaiementModalOpen(false); setSelectedFacture(null) }}
          onSuccess={() => { setIsPaiementModalOpen(false); setSelectedFacture(null); loadData() }}
          factureId={selectedFacture.id}
          factureNumero={selectedFacture.numero}
        />
      )}
    </div>
  )
}
