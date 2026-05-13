// Page gestion des clients — CRUD complet et historique des missions par client
import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2, Plus, Pencil, Trash2, AlertTriangle, X,
  Phone, Mail, MapPin, History, ArrowLeft
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Constantes ──────────────────────────────────────────────────────────────

const TYPES = { entreprise: 'Entreprise', particulier: 'Particulier' };

const STATUT_CFG = {
  planifiee: { label: 'Planifiée',  cls: 'bg-yellow-100 text-yellow-700' },
  en_cours:  { label: 'En cours',   cls: 'bg-blue-100   text-blue-700'   },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100  text-green-700'  },
  annulee:   { label: 'Annulée',    cls: 'bg-gray-100   text-gray-500'   }
};

const FORM_VIDE = {
  nom: '', type: 'entreprise', contact_nom: '',
  telephone: '', email: '', adresse: '', ville: '', notes: ''
};

const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtMontant = (n) => n != null ? `${Number(n).toLocaleString('fr-FR')} Ar` : '—';

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Clients() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';

  const [clients,    setClients]    = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur,     setErreur]     = useState('');

  // Modal CRUD
  const [modal,       setModal]       = useState(false);
  const [clientEdite, setClientEdite] = useState(null);
  const [form,        setForm]        = useState(FORM_VIDE);
  const [sauvegarde,  setSauvegarde]  = useState(false);
  const [errModal,    setErrModal]    = useState('');

  // Vue historique missions d'un client
  const [historique, setHistorique] = useState(null);
  const [chargemHist, setChargemHist] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await api.get('/clients');
      setClients(data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les clients');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // ── Modal CRUD ──

  const ouvrirAjout = () => {
    setForm(FORM_VIDE);
    setClientEdite(null);
    setErrModal('');
    setModal(true);
  };

  const ouvrirEdition = (c) => {
    setForm({
      nom:         c.nom,
      type:        c.type,
      contact_nom: c.contact_nom || '',
      telephone:   c.telephone   || '',
      email:       c.email       || '',
      adresse:     c.adresse     || '',
      ville:       c.ville       || '',
      notes:       c.notes       || ''
    });
    setClientEdite(c);
    setErrModal('');
    setModal(true);
  };

  const fermerModal = () => { setModal(false); setClientEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault();
    setSauvegarde(true);
    setErrModal('');
    try {
      if (clientEdite) {
        await api.put(`/clients/${clientEdite.id}`, form);
      } else {
        await api.post('/clients', form);
      }
      fermerModal();
      charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSauvegarde(false);
    }
  };

  const supprimer = async (c) => {
    if (!window.confirm(`Supprimer le client "${c.nom}" ? Ses missions seront détachées.`)) return;
    try {
      await api.delete(`/clients/${c.id}`);
      charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  // ── Historique missions ──

  const voirHistorique = async (c) => {
    setChargemHist(true);
    try {
      const { data } = await api.get(`/clients/${c.id}/missions`);
      setHistorique(data);
    } catch {
      alert('Impossible de charger les missions de ce client');
    } finally {
      setChargemHist(false);
    }
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  // Vue historique missions
  if (historique) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setHistorique(null)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-xl p-2">
              <History className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Missions — {historique.client.nom}</h1>
              <p className="text-sm text-gray-500">{historique.missions.length} mission(s)</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {historique.missions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucune mission pour ce client</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Titre', 'Camion', 'Chauffeur', 'Trajet', 'Date départ', 'Statut', 'Coût'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historique.missions.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">{m.titre}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{m.immatriculation}</td>
                      <td className="px-4 py-3 text-gray-600">{m.chauffeur_prenom} {m.chauffeur_nom}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {m.lieu_depart} → {m.lieu_destination}
                        <br /><span className="text-gray-400">{m.distance_km} km</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(m.date_depart)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_CFG[m.statut]?.cls || ''}`}>
                          {STATUT_CFG[m.statut]?.label || m.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{fmtMontant(m.cout_carburant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vue liste clients
  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 rounded-xl p-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500">{clients.length} client(s) enregistré(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700
                       text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
            <Plus className="w-4 h-4" /> Ajouter un client
          </button>
        )}
      </div>

      {/* Erreur */}
      {erreur && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {erreur}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {chargement ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun client enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nom', 'Type', 'Contact', 'Téléphone', 'Ville', 'Missions', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{c.nom}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.type === 'entreprise' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {TYPES[c.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.contact_nom || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.telephone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {c.telephone}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.ville ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {c.ville}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => voirHistorique(c)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                        <History className="w-4 h-4" />
                        {c.nb_missions} mission{c.nb_missions !== 1 ? 's' : ''}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(c)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(c)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ajout / édition */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">
                {clientEdite ? 'Modifier le client' : 'Ajouter un client'}
              </h2>
              <button onClick={fermerModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={sauvegarder} className="p-6 space-y-4">
              {errModal && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {errModal}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required
                    placeholder="Ex : COLAS Madagascar"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })}
                    placeholder="Ex : Antananarivo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contact</label>
                  <input type="text" value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })}
                    placeholder="Ex : Rakoto Fils"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input type="text" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    placeholder="Ex : 034 11 111 11"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="contact@entreprise.mg"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                  <textarea value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                    rows={2} placeholder="Adresse complète..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2} placeholder="Informations complémentaires..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={fermerModal}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={sauvegarde}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                  {sauvegarde ? 'Enregistrement...' : clientEdite ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
