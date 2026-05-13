// Page gestion du carburant — suivi des pleins et statistiques de consommation
import React, { useEffect, useState, useCallback } from 'react';
import {
  Fuel, Plus, Pencil, Trash2, AlertTriangle, X,
  Droplets, DollarSign, Gauge, TrendingDown
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const TYPES_CARBURANT = { diesel: 'Diesel', essence: 'Essence', gasoil: 'Gasoil' };

const FORM_VIDE = {
  vehicule_id: '', date_plein: '', litres: '', prix_litre: '5200',
  kilometrage_au_plein: '', consommation_reelle: '',
  station: '', ville: '', type_carburant: 'diesel', notes: ''
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

export default function Carburant() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';

  const [pleins,    setPleins]    = useState([]);
  const [stats,     setStats]     = useState(null);
  const [vehicules, setVehicules] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur,    setErreur]    = useState('');

  const [filtreVehicule, setFiltreVehicule] = useState('');
  const [filtreDebut,    setFiltreDebut]    = useState('');
  const [filtreFin,      setFiltreFin]      = useState('');

  const [modal,      setModal]      = useState(false);
  const [pleinEdite, setPleinEdite] = useState(null);
  const [form,       setForm]       = useState(FORM_VIDE);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [errModal,   setErrModal]   = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = {};
      if (filtreVehicule) params.vehicule_id = filtreVehicule;
      if (filtreDebut)    params.debut = filtreDebut;
      if (filtreFin)      params.fin   = filtreFin;

      const [resPleins, resStats, resVehicules] = await Promise.all([
        api.get('/carburant', { params }),
        api.get('/carburant/stats'),
        api.get('/vehicules')
      ]);

      setPleins(resPleins.data);
      setStats(resStats.data);
      setVehicules(resVehicules.data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les données carburant');
    } finally {
      setChargement(false);
    }
  }, [filtreVehicule, filtreDebut, filtreFin]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => {
    setForm(FORM_VIDE);
    setPleinEdite(null);
    setErrModal('');
    setModal('ajout');
  };

  const ouvrirEdition = (plein) => {
    setForm({
      vehicule_id:         plein.vehicule_id,
      date_plein:          plein.date_plein?.slice(0, 10) || '',
      litres:              plein.litres ?? '',
      prix_litre:          plein.prix_litre ?? '5200',
      kilometrage_au_plein: plein.kilometrage_au_plein ?? '',
      consommation_reelle: plein.consommation_reelle ?? '',
      station:             plein.station || '',
      ville:               plein.ville || '',
      type_carburant:      plein.type_carburant || 'diesel',
      notes:               plein.notes || ''
    });
    setPleinEdite(plein);
    setErrModal('');
    setModal('edition');
  };

  const fermerModal = () => { setModal(false); setPleinEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault();
    setSauvegarde(true);
    setErrModal('');
    try {
      if (modal === 'ajout') {
        await api.post('/carburant', form);
      } else {
        await api.put(`/carburant/${pleinEdite.id}`, form);
      }
      fermerModal();
      charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSauvegarde(false);
    }
  };

  const supprimer = async (plein) => {
    if (!window.confirm(`Supprimer ce plein (${plein.immatriculation} — ${fmtDate(plein.date_plein)}) ?`)) return;
    try {
      await api.delete(`/carburant/${plein.id}`);
      charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const effacerFiltres = () => {
    setFiltreVehicule('');
    setFiltreDebut('');
    setFiltreFin('');
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 rounded-xl p-2">
            <Fuel className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carburant</h1>
            <p className="text-sm text-gray-500">{pleins.length} plein(s) enregistré(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600
                       text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
            <Plus className="w-4 h-4" /> Ajouter un plein
          </button>
        )}
      </div>

      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard Icon={Droplets}    label="Total litres"        valeur={`${Number(stats.totalLitres).toLocaleString('fr-FR')} L`}  couleur="bg-blue-500" />
          <KpiCard Icon={DollarSign}  label="Coût total"          valeur={fmtMontant(stats.coutTotal)}                               couleur="bg-amber-500" />
          <KpiCard Icon={Gauge}       label="Conso. moyenne"      valeur={stats.consommationMoyenne ? `${Number(stats.consommationMoyenne).toFixed(2)} L/km` : '—'} couleur="bg-green-500" />
          <KpiCard Icon={TrendingDown} label="Dépense ce mois"   valeur={fmtMontant(stats.coutMois)}                                couleur="bg-purple-500" />
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-2xl p-4">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent">
          <option value="">Tous les camions</option>
          {vehicules.map((v) => (
            <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>
          ))}
        </select>
        <input type="date" value={filtreDebut} onChange={(e) => setFiltreDebut(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
        <input type="date" value={filtreFin} onChange={(e) => setFiltreFin(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
        {(filtreVehicule || filtreDebut || filtreFin) && (
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
          </div>
        ) : pleins.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Fuel className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun plein enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Camion', 'Station / Ville', 'Litres', 'Prix/L', 'Coût total', 'Type', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pleins.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(p.date_plein)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-800">{p.immatriculation}</span>
                      <span className="text-gray-400 ml-1 text-xs">{p.marque}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.station || '—'}{p.ville ? ` · ${p.ville}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{p.litres} L</td>
                    <td className="px-4 py-3 text-gray-600">{Number(p.prix_litre).toLocaleString('fr-FR')} Ar</td>
                    <td className="px-4 py-3 text-gray-800 font-semibold whitespace-nowrap">{fmtMontant(p.cout_total)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {TYPES_CARBURANT[p.type_carburant] || p.type_carburant}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(p)}
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
                {modal === 'ajout' ? 'Enregistrer un plein' : 'Modifier le plein'}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                  <option value="">Sélectionner un camion</option>
                  {vehicules.map((v) => (
                    <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date du plein *</label>
                  <input type="date" value={form.date_plein} onChange={(e) => setForm({ ...form, date_plein: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de carburant</label>
                  <select value={form.type_carburant} onChange={(e) => setForm({ ...form, type_carburant: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                    {Object.entries(TYPES_CARBURANT).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Litres *</label>
                  <input type="number" step="0.01" min="0" value={form.litres}
                    onChange={(e) => setForm({ ...form, litres: e.target.value })} required
                    placeholder="Ex : 120.50"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix/litre (Ar) *</label>
                  <input type="number" step="1" min="0" value={form.prix_litre}
                    onChange={(e) => setForm({ ...form, prix_litre: e.target.value })} required
                    placeholder="Ex : 5200"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
                  <input type="text" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}
                    placeholder="Ex : Total, Galana..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })}
                    placeholder="Ex : Antananarivo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kilométrage au plein</label>
                  <input type="number" min="0" value={form.kilometrage_au_plein}
                    onChange={(e) => setForm({ ...form, kilometrage_au_plein: e.target.value })}
                    placeholder="Ex : 45320"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conso. réelle (L/km)</label>
                  <input type="number" step="0.01" min="0" value={form.consommation_reelle}
                    onChange={(e) => setForm({ ...form, consommation_reelle: e.target.value })}
                    placeholder="Ex : 0.32"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Informations complémentaires..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={fermerModal}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={sauvegarde}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
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
