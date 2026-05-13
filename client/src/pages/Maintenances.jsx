// Page maintenances planifiées — alertes urgentes, tableau, modals planification et clôture
import React, { useEffect, useState, useCallback } from 'react';
import {
  Wrench, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2,
  X, Clock
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Constantes ──────────────────────────────────────────────────────────────

const TYPES = {
  vidange:           'Vidange',
  freins:            'Freins',
  pneus:             'Pneus',
  courroie:          'Courroie',
  filtres:           'Filtres',
  revision_generale: 'Révision générale',
  autre:             'Autre'
};

const PRIORITE_CFG = {
  faible:  { label: 'Faible',  cls: 'bg-gray-100 text-gray-600' },
  normale: { label: 'Normale', cls: 'bg-blue-100 text-blue-600' },
  haute:   { label: 'Haute',   cls: 'bg-orange-100 text-orange-600' },
  urgente: { label: 'Urgente', cls: 'bg-red-100 text-red-600 animate-pulse' }
};

const STATUT_CFG = {
  planifiee: { label: 'Planifiée',  cls: 'bg-yellow-100 text-yellow-700' },
  en_cours:  { label: 'En cours',   cls: 'bg-blue-100 text-blue-700' },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100 text-green-700' },
  annulee:   { label: 'Annulée',    cls: 'bg-gray-100 text-gray-500' }
};

const FORM_VIDE = {
  vehicule_id: '', type: 'vidange', description: '',
  kilometrage_declencheur: '', date_prevue: '',
  cout_estime: '', garage: '', priorite: 'normale'
};

const FORM_CLOTURE = { date_realisee: '', cout_reel: '', notes: '' };

const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtMontant = (n) => n != null ? `${Number(n).toLocaleString('fr-FR')} Ar` : '—';

// ─── Sous-composants ─────────────────────────────────────────────────────────

const PrioriteBadge = ({ priorite }) => {
  const cfg = PRIORITE_CFG[priorite] || PRIORITE_CFG.normale;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

const StatutBadge = ({ statut }) => {
  const cfg = STATUT_CFG[statut] || STATUT_CFG.planifiee;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Maintenances() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';

  const [maintenances, setMaintenances] = useState([]);
  const [alertes,      setAlertes]      = useState([]);
  const [vehicules,    setVehicules]    = useState([]);
  const [chargement,   setChargement]   = useState(true);
  const [erreur,       setErreur]       = useState('');

  // Filtres
  const [filtreVehicule, setFiltreVehicule] = useState('');
  const [filtreStatut,   setFiltreStatut]   = useState('');
  const [filtrePriorite, setFiltrePriorite] = useState('');

  // Modal planifier / modifier
  const [modal,        setModal]        = useState(false); // false | 'ajout' | 'edition'
  const [entiteEditee, setEntiteEditee] = useState(null);
  const [form,         setForm]         = useState(FORM_VIDE);
  const [sauvegarde,   setSauvegarde]   = useState(false);
  const [errModal,     setErrModal]     = useState('');

  // Modal clôturer
  const [modalCloture,   setModalCloture]   = useState(false);
  const [maintenanceClt, setMaintenanceClt] = useState(null);
  const [formCloture,    setFormCloture]    = useState(FORM_CLOTURE);
  const [sauvegardeClt,  setSauvegardeClt]  = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = {};
      if (filtreVehicule) params.vehicule_id = filtreVehicule;
      if (filtreStatut)   params.statut      = filtreStatut;
      if (filtrePriorite) params.priorite    = filtrePriorite;

      const [resM, resA, resV] = await Promise.all([
        api.get('/maintenances', { params }),
        api.get('/maintenances/alertes'),
        api.get('/vehicules')
      ]);

      setMaintenances(resM.data);
      setAlertes(resA.data);
      setVehicules(resV.data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les maintenances');
    } finally {
      setChargement(false);
    }
  }, [filtreVehicule, filtreStatut, filtrePriorite]);

  useEffect(() => { charger(); }, [charger]);

  // ── Modal planifier ──

  const ouvrirAjout = () => {
    setForm(FORM_VIDE);
    setEntiteEditee(null);
    setErrModal('');
    setModal('ajout');
  };

  const ouvrirEdition = (m) => {
    setForm({
      vehicule_id:             m.vehicule_id,
      type:                    m.type,
      description:             m.description || '',
      kilometrage_declencheur: m.kilometrage_declencheur ?? '',
      date_prevue:             m.date_prevue?.slice(0, 10) || '',
      cout_estime:             m.cout_estime ?? '',
      garage:                  m.garage || '',
      priorite:                m.priorite || 'normale'
    });
    setEntiteEditee(m);
    setErrModal('');
    setModal('edition');
  };

  const fermerModal = () => { setModal(false); setEntiteEditee(null); };

  const sauvegarder = async (e) => {
    e.preventDefault();
    setSauvegarde(true);
    setErrModal('');
    try {
      if (modal === 'ajout') {
        await api.post('/maintenances', form);
      } else {
        await api.put(`/maintenances/${entiteEditee.id}`, form);
      }
      fermerModal();
      charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSauvegarde(false);
    }
  };

  // ── Modal clôturer ──

  const ouvrirCloture = (m) => {
    setMaintenanceClt(m);
    setFormCloture({ date_realisee: new Date().toISOString().slice(0, 10), cout_reel: '', notes: '' });
    setModalCloture(true);
  };

  const fermerCloture = () => { setModalCloture(false); setMaintenanceClt(null); };

  const sauvegarderCloture = async (e) => {
    e.preventDefault();
    setSauvegardeClt(true);
    try {
      await api.put(`/maintenances/${maintenanceClt.id}/terminer`, formCloture);
      fermerCloture();
      charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la clôture');
    } finally {
      setSauvegardeClt(false);
    }
  };

  // ── Suppression ──

  const supprimer = async (m) => {
    if (!window.confirm(`Supprimer la maintenance "${TYPES[m.type]}" du camion ${m.immatriculation} ?`)) return;
    try {
      await api.delete(`/maintenances/${m.id}`);
      charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 rounded-xl p-2">
            <Wrench className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maintenances</h1>
            <p className="text-sm text-gray-500">{maintenances.length} maintenance(s) enregistrée(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600
                       text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
            <Plus className="w-4 h-4" /> Planifier une maintenance
          </button>
        )}
      </div>

      {/* Alertes urgentes */}
      {alertes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold text-red-800 mb-3">
            <AlertTriangle className="w-5 h-5" />
            {alertes.length} maintenance(s) nécessitant une attention immédiate
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {alertes.map((a) => (
              <div key={a.id}
                className={`rounded-xl p-3 border ${
                  a.priorite === 'urgente'
                    ? 'bg-red-100 border-red-300'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{TYPES[a.type]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.immatriculation} — {a.marque}</p>
                  </div>
                  <PrioriteBadge priorite={a.priorite} />
                </div>
                {a.date_prevue && (
                  <p className="text-xs mt-1.5 text-gray-600">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {a.depassee ? 'Dépassée — prévue le ' : 'Prévue le '}
                    {fmtDate(a.date_prevue)}
                  </p>
                )}
                {a.garage && (
                  <p className="text-xs text-gray-500 mt-0.5">{a.garage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-2xl p-4">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>)}
        </select>
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filtrePriorite} onChange={(e) => setFiltrePriorite(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
          <option value="">Toutes priorités</option>
          {Object.entries(PRIORITE_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        {(filtreVehicule || filtreStatut || filtrePriorite) && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreStatut(''); setFiltrePriorite(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-4 h-4" /> Effacer
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          </div>
        ) : maintenances.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucune maintenance trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Camion', 'Type', 'Description', 'Date prévue', 'Kilométrage', 'Priorité', 'Statut', 'Coût estimé', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {maintenances.map((m) => (
                  <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${m.depassee ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-800">{m.immatriculation}</span>
                      <span className="text-gray-400 ml-1 text-xs">{m.marque}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{TYPES[m.type]}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{m.description || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={m.depassee ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {fmtDate(m.date_prevue)}
                        {m.depassee && <span className="ml-1 text-xs">(dépassée)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {m.kilometrage_declencheur ? `${m.kilometrage_declencheur.toLocaleString()} km` : '—'}
                    </td>
                    <td className="px-4 py-3"><PrioriteBadge priorite={m.priorite} /></td>
                    <td className="px-4 py-3"><StatutBadge statut={m.statut} /></td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{fmtMontant(m.cout_estime)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Marquer terminée — maintenances actives */}
                        {peutModifier && !['terminee', 'annulee'].includes(m.statut) && (
                          <button onClick={() => ouvrirCloture(m)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Marquer terminée">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(m)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(m)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer">
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

      {/* ── Modal planifier / modifier ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">
                {modal === 'ajout' ? 'Planifier une maintenance' : 'Modifier la maintenance'}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Camion *</label>
                <select value={form.vehicule_id} onChange={(e) => setForm({ ...form, vehicule_id: e.target.value })} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                  <option value="">Sélectionner un camion</option>
                  {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                    {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                  <select value={form.priorite} onChange={(e) => setForm({ ...form, priorite: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                    {Object.entries(PRIORITE_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date prévue</label>
                  <input type="date" value={form.date_prevue} onChange={(e) => setForm({ ...form, date_prevue: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Km déclencheur</label>
                  <input type="number" min="0" value={form.kilometrage_declencheur}
                    onChange={(e) => setForm({ ...form, kilometrage_declencheur: e.target.value })}
                    placeholder="Ex : 50000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coût estimé (Ar)</label>
                  <input type="number" min="0" value={form.cout_estime}
                    onChange={(e) => setForm({ ...form, cout_estime: e.target.value })}
                    placeholder="Ex : 85000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Garage</label>
                  <input type="text" value={form.garage} onChange={(e) => setForm({ ...form, garage: e.target.value })}
                    placeholder="Ex : Garage Rakoto"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={fermerModal}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={sauvegarde}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                  {sauvegarde ? 'Enregistrement...' : modal === 'ajout' ? 'Planifier' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal clôturer ── */}
      {modalCloture && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Marquer comme terminée</h2>
              <button onClick={fermerCloture} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={sauvegarderCloture} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                <strong>{TYPES[maintenanceClt?.type]}</strong> — {maintenanceClt?.immatriculation}
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date réalisée</label>
                <input type="date" value={formCloture.date_realisee}
                  onChange={(e) => setFormCloture({ ...formCloture, date_realisee: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coût réel (Ar)</label>
                <input type="number" min="0" value={formCloture.cout_reel}
                  onChange={(e) => setFormCloture({ ...formCloture, cout_reel: e.target.value })}
                  placeholder="Montant payé"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={formCloture.notes}
                  onChange={(e) => setFormCloture({ ...formCloture, notes: e.target.value })}
                  rows={2} placeholder="Observations, travaux supplémentaires..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={fermerCloture}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={sauvegardeClt}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                  {sauvegardeClt ? 'Enregistrement...' : 'Confirmer clôture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
