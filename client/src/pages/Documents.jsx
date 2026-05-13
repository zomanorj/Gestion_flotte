// Page gestion des documents administratifs avec alertes d'expiration
import React, { useEffect, useState, useCallback } from 'react';
import {
  FileCheck, Plus, Pencil, Trash2, AlertTriangle,
  CheckCircle2, Clock, X, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Labels lisibles pour les types de documents
const TYPES = {
  carte_grise:            'Carte grise',
  assurance:              'Assurance',
  vignette:               'Vignette',
  visite_technique:       'Visite technique',
  autorisation_transport: 'Autorisation transport'
};

// Configuration visuelle des statuts
const STATUT_CONFIG = {
  valide:         { label: 'Valide',          bg: 'bg-green-100',  text: 'text-green-700',  Icon: CheckCircle2 },
  expire_bientot: { label: 'Expire bientôt',  bg: 'bg-orange-100', text: 'text-orange-700', Icon: Clock },
  expire:         { label: 'Expiré',          bg: 'bg-red-100',    text: 'text-red-700',    Icon: AlertTriangle }
};

const FORM_VIDE = {
  vehicule_id: '', type: 'carte_grise', numero: '',
  date_emission: '', date_expiration: '', notes: ''
};

/** Badge de statut coloré */
const StatutBadge = ({ statut }) => {
  const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG.valide;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

/** Formate une date ISO en dd/mm/yyyy */
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('fr-FR');
};

export default function Documents() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';

  const [docs,      setDocs]      = useState([]);
  const [alertes,   setAlertes]   = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur,    setErreur]    = useState('');

  // Filtres
  const [filtreVehicule, setFiltreVehicule] = useState('');
  const [filtreType,     setFiltreType]     = useState('');

  // Modal
  const [modal,     setModal]     = useState(false); // false | 'ajout' | 'edition'
  const [docEdite,  setDocEdite]  = useState(null);
  const [form,      setForm]      = useState(FORM_VIDE);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [errModal,  setErrModal]  = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = {};
      if (filtreVehicule) params.vehicule_id = filtreVehicule;
      if (filtreType)     params.type        = filtreType;

      const [resDocs, resAlertes, resVehicules] = await Promise.all([
        api.get('/documents', { params }),
        api.get('/documents/alertes'),
        api.get('/vehicules')
      ]);

      setDocs(resDocs.data);
      setAlertes(resAlertes.data);
      setVehicules(resVehicules.data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les documents');
    } finally {
      setChargement(false);
    }
  }, [filtreVehicule, filtreType]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => {
    setForm(FORM_VIDE);
    setDocEdite(null);
    setErrModal('');
    setModal('ajout');
  };

  const ouvrirEdition = (doc) => {
    setForm({
      vehicule_id:    doc.vehicule_id,
      type:           doc.type,
      numero:         doc.numero || '',
      date_emission:  doc.date_emission?.slice(0, 10) || '',
      date_expiration:doc.date_expiration?.slice(0, 10) || '',
      notes:          doc.notes || ''
    });
    setDocEdite(doc);
    setErrModal('');
    setModal('edition');
  };

  const fermerModal = () => { setModal(false); setDocEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault();
    setSauvegarde(true);
    setErrModal('');
    try {
      if (modal === 'ajout') {
        await api.post('/documents', form);
      } else {
        await api.put(`/documents/${docEdite.id}`, form);
      }
      fermerModal();
      charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSauvegarde(false);
    }
  };

  const supprimer = async (doc) => {
    if (!window.confirm(`Supprimer le document "${TYPES[doc.type]}" du camion ${doc.immatriculation} ?`)) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 rounded-xl p-2">
            <FileCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="text-sm text-gray-500">{docs.length} document(s) enregistré(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700
                       text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
            <Plus className="w-4 h-4" /> Ajouter un document
          </button>
        )}
      </div>

      {/* Panneau d'alertes */}
      {alertes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold text-red-800 mb-3">
            <AlertTriangle className="w-5 h-5" />
            {alertes.length} document(s) nécessitant une attention
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {alertes.map((a) => (
              <div key={a.id}
                className={`rounded-xl p-3 border ${
                  a.statut === 'expire'
                    ? 'bg-red-100 border-red-300'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-semibold text-sm ${a.statut === 'expire' ? 'text-red-800' : 'text-orange-800'}`}>
                      {TYPES[a.type]}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{a.immatriculation} — {a.marque}</p>
                  </div>
                  <StatutBadge statut={a.statut} />
                </div>
                <p className={`text-xs mt-1.5 font-medium ${a.statut === 'expire' ? 'text-red-700' : 'text-orange-700'}`}>
                  {a.jours_restants < 0
                    ? `Expiré depuis ${Math.abs(a.jours_restants)} jour(s)`
                    : `Expire dans ${a.jours_restants} jour(s)`
                  }
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-2xl p-4">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">Tous les camions</option>
          {vehicules.map((v) => (
            <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>
          ))}
        </select>
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">Tous les types</option>
          {Object.entries(TYPES).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        {(filtreVehicule || filtreType) && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreType(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-4 h-4" /> Effacer les filtres
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun document trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Type', 'Numéro', 'Camion', 'Émission', 'Expiration', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {TYPES[doc.type]}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{doc.numero || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-800">{doc.immatriculation}</span>
                      <span className="text-gray-400 ml-1 text-xs">{doc.marque}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(doc.date_emission)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(doc.date_expiration)}</td>
                    <td className="px-4 py-3">
                      <StatutBadge statut={doc.statut} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(doc)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(doc)}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {modal === 'ajout' ? 'Ajouter un document' : 'Modifier le document'}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Sélectionner un camion</option>
                  {vehicules.map((v) => (
                    <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de document *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {Object.entries(TYPES).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro du document</label>
                <input type="text" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  placeholder="Ex : ASS-2025-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d'émission *</label>
                  <input type="date" value={form.date_emission} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration *</label>
                  <input type="date" value={form.date_expiration} onChange={(e) => setForm({ ...form, date_expiration: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Informations complémentaires..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={fermerModal}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={sauvegarde}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                  {sauvegarde ? 'Enregistrement...' : modal === 'ajout' ? 'Ajouter' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
