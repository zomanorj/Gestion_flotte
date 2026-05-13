// Page gestion des dépenses opérationnelles par catégorie
import React, { useEffect, useState, useCallback } from 'react';
import {
  Receipt, Plus, Pencil, Trash2, AlertTriangle, X,
  CalendarDays, TrendingUp, ListChecks, Wallet
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

const CATEGORIES = {
  peage:            'Péage',
  amende:           'Amende',
  lavage:           'Lavage',
  pneu:             'Pneu',
  pieces_detachees: 'Pièces détachées',
  main_oeuvre:      'Main d\'œuvre',
  parking:          'Parking',
  divers:           'Divers'
};

const CATEGORIE_COULEURS = {
  peage:            'bg-blue-100 text-blue-700',
  amende:           'bg-red-100 text-red-700',
  lavage:           'bg-cyan-100 text-cyan-700',
  pneu:             'bg-orange-100 text-orange-700',
  pieces_detachees: 'bg-purple-100 text-purple-700',
  main_oeuvre:      'bg-indigo-100 text-indigo-700',
  parking:          'bg-yellow-100 text-yellow-700',
  divers:           'bg-gray-100 text-gray-700'
};

const FORM_VIDE = {
  vehicule_id: '', categorie: 'peage', montant: '',
  date_depense: '', description: ''
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
};

const fmtMontant = (n) =>
  n != null ? `${Number(n).toLocaleString('fr-FR')} Ar` : '—';

const KpiCard = ({ Icon, label, valeur, couleur }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
    <div className={`rounded-xl p-3 ${couleur}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{valeur}</p>
    </div>
  </div>
);

export default function Depenses() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [depenses,  setDepenses]  = useState([]);
  const [stats,     setStats]     = useState(null);
  const [vehicules, setVehicules] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur,    setErreur]    = useState('');

  const [filtreVehicule,  setFiltreVehicule]  = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('');
  const [filtreDebut,     setFiltreDebut]     = useState('');
  const [filtreFin,       setFiltreFin]       = useState('');

  const [modal,       setModal]       = useState(false);
  const [depenseEditee, setDepenseEditee] = useState(null);
  const [form,        setForm]        = useState(FORM_VIDE);
  const [sauvegarde,  setSauvegarde]  = useState(false);
  const [errModal,    setErrModal]    = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = {};
      if (filtreVehicule)  params.vehicule_id = filtreVehicule;
      if (filtreCategorie) params.categorie   = filtreCategorie;
      if (filtreDebut)     params.debut       = filtreDebut;
      if (filtreFin)       params.fin         = filtreFin;

      const [resDepenses, resStats, resVehicules] = await Promise.all([
        api.get('/depenses', { params }),
        api.get('/depenses/stats'),
        api.get('/vehicules')
      ]);

      setDepenses(resDepenses.data);
      setStats(resStats.data);
      setVehicules(resVehicules.data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les dépenses');
    } finally {
      setChargement(false);
    }
  }, [filtreVehicule, filtreCategorie, filtreDebut, filtreFin]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => {
    setForm(FORM_VIDE);
    setDepenseEditee(null);
    setErrModal('');
    setModal('ajout');
  };

  const ouvrirEdition = (dep) => {
    setForm({
      vehicule_id:  dep.vehicule_id,
      categorie:    dep.categorie,
      montant:      dep.montant ?? '',
      date_depense: dep.date_depense?.slice(0, 10) || '',
      description:  dep.description || ''
    });
    setDepenseEditee(dep);
    setErrModal('');
    setModal('edition');
  };

  const fermerModal = () => { setModal(false); setDepenseEditee(null); };

  const sauvegarder = async (e) => {
    e.preventDefault();
    setSauvegarde(true);
    setErrModal('');
    try {
      if (modal === 'ajout') {
        await api.post('/depenses', form);
      } else {
        await api.put(`/depenses/${depenseEditee.id}`, form);
      }
      fermerModal();
      charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSauvegarde(false);
    }
  };

  const supprimer = async (dep) => {
    const ok = await confirmer({
      type: 'supprimer',
      element: `${CATEGORIES[dep.categorie]} — ${fmtMontant(dep.montant)}`,
      consequences: ['La dépense sera définitivement supprimée', 'Cette action est irréversible']
    });
    if (!ok) return;
    try {
      await api.delete(`/depenses/${dep.id}`);
      charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const effacerFiltres = () => {
    setFiltreVehicule('');
    setFiltreCategorie('');
    setFiltreDebut('');
    setFiltreFin('');
  };

  const filtresActifs = filtreVehicule || filtreCategorie || filtreDebut || filtreFin;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 rounded-xl p-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dépenses</h1>
            <p className="text-sm text-gray-500">{depenses.length} dépense(s) enregistrée(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700
                       text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
            <Plus className="w-4 h-4" /> Ajouter une dépense
          </button>
        )}
      </div>

      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard Icon={CalendarDays} label="Dépenses ce mois"  valeur={fmtMontant(stats.totalMois)}  couleur="bg-emerald-500" />
          <KpiCard Icon={TrendingUp}   label="Total cette année" valeur={fmtMontant(stats.totalAnnee)} couleur="bg-blue-500" />
          <KpiCard Icon={ListChecks}   label="Nombre de dépenses" valeur={stats.nbDepenses}            couleur="bg-violet-500" />
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-2xl p-4">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
          <option value="">Tous les camions</option>
          {vehicules.map((v) => (
            <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>
          ))}
        </select>
        <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
          <option value="">Toutes catégories</option>
          {Object.entries(CATEGORIES).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <input type="date" value={filtreDebut} onChange={(e) => setFiltreDebut(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        <input type="date" value={filtreFin} onChange={(e) => setFiltreFin(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        {filtresActifs && (
          <button onClick={effacerFiltres}
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          </div>
        ) : depenses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucune dépense trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Camion', 'Catégorie', 'Montant', 'Description', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {depenses.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(d.date_depense)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-800">{d.immatriculation}</span>
                      <span className="text-gray-400 ml-1 text-xs">{d.marque}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORIE_COULEURS[d.categorie] || 'bg-gray-100 text-gray-700'}`}>
                        {CATEGORIES[d.categorie] || d.categorie}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{fmtMontant(d.montant)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{d.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(d)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(d)}
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
                {modal === 'ajout' ? 'Ajouter une dépense' : 'Modifier la dépense'}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                  <option value="">Sélectionner un camion</option>
                  {vehicules.map((v) => (
                    <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                  <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                    {Object.entries(CATEGORIES).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" value={form.date_depense} onChange={(e) => setForm({ ...form, date_depense: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (Ar) *</label>
                <input type="number" step="1" min="0" value={form.montant}
                  onChange={(e) => setForm({ ...form, montant: e.target.value })} required
                  placeholder="Ex : 45000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} placeholder="Détails de la dépense..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={fermerModal}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={sauvegarde}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                  {sauvegarde ? 'Enregistrement...' : modal === 'ajout' ? 'Ajouter' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModalComponent />
    </div>
  );
}
