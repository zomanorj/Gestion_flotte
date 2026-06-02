import React, { useEffect, useState, useCallback } from 'react';
import { Fuel, Plus, Pencil, Trash2, AlertTriangle, X, Droplets, DollarSign, Gauge, TrendingDown } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

const TYPES_CARBURANT = { diesel: 'Diesel', essence: 'Essence', gasoil: 'Gasoil' };

const FORM_VIDE = {
  vehicule_id: '', date_plein: '', litres: '', prix_litre: '5200',
  kilometrage_au_plein: '', consommation_reelle: '',
  station: '', ville: '', type_carburant: 'diesel', notes: ''
};

const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtMontant = (n) => n != null ? `${Number(n).toLocaleString('fr-FR')} Ar` : '—';

const KpiCard = ({ Icon, label, valeur, couleur }) => (
  <div className="card border rounded-3">
    <div className="card-body p-3 d-flex align-items-center gap-3">
      <div className={`rounded-3 p-2 ${couleur}`}><Icon size={24} color="white" /></div>
      <div>
        <p className="text-xs text-muted fw-medium text-uppercase mb-1">{label}</p>
        <p className="fs-5 fw-bold text-dark mb-0">{valeur}</p>
      </div>
    </div>
  </div>
);

export default function Carburant() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

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
      setPleins(resPleins.data); setStats(resStats.data); setVehicules(resVehicules.data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les données carburant');
    } finally {
      setChargement(false);
    }
  }, [filtreVehicule, filtreDebut, filtreFin]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => { setForm(FORM_VIDE); setPleinEdite(null); setErrModal(''); setModal('ajout'); };
  const ouvrirEdition = (plein) => {
    setForm({
      vehicule_id: plein.vehicule_id, date_plein: plein.date_plein?.slice(0, 10) || '',
      litres: plein.litres ?? '', prix_litre: plein.prix_litre ?? '5200',
      kilometrage_au_plein: plein.kilometrage_au_plein ?? '',
      consommation_reelle: plein.consommation_reelle ?? '',
      station: plein.station || '', ville: plein.ville || '',
      type_carburant: plein.type_carburant || 'diesel', notes: plein.notes || ''
    });
    setPleinEdite(plein); setErrModal(''); setModal('edition');
  };
  const fermerModal = () => { setModal(false); setPleinEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setSauvegarde(true); setErrModal('');
    try {
      if (modal === 'ajout') await api.post('/carburant', form);
      else await api.put(`/carburant/${pleinEdite.id}`, form);
      fermerModal(); charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally { setSauvegarde(false); }
  };

  const supprimer = async (plein) => {
    const ok = await confirmer({
      type: 'supprimer',
      element: `Plein du ${fmtDate(plein.date_plein)} — ${plein.immatriculation}`,
      consequences: ['Cette action est irréversible', `${plein.litres} L — ${fmtMontant(plein.cout_total)}`]
    });
    if (!ok) return;
    try { await api.delete(`/carburant/${plein.id}`); charger(); }
    catch (err) { alert(err.response?.data?.message || 'Erreur lors de la suppression'); }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-amber-100 rounded-3 p-2"><Fuel size={24} className="text-amber-600" /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Carburant</h1>
            <p className="text-muted small mb-0">{pleins.length} plein(s) enregistré(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout} className="btn d-flex align-items-center gap-2 text-white bg-amber-500"
                  style={{ backgroundColor: '#f59e0b', border: 'none' }}>
            <Plus size={16} /> Ajouter un plein
          </button>
        )}
      </div>

      {/* KPI */}
      {stats && (
        <div className="row g-3">
          <div className="col-12 col-sm-6 col-xl-3">
            <KpiCard Icon={Droplets}    label="Total litres"    valeur={`${Number(stats.totalLitres).toLocaleString('fr-FR')} L`} couleur="bg-primary" />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <KpiCard Icon={DollarSign}  label="Coût total"      valeur={fmtMontant(stats.coutTotal)}   couleur="bg-amber-500" />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <KpiCard Icon={Gauge}       label="Conso. moyenne"  valeur={stats.consommationMoyenne ? `${Number(stats.consommationMoyenne).toFixed(2)} L/km` : '—'} couleur="bg-success" />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <KpiCard Icon={TrendingDown} label="Dépense ce mois" valeur={fmtMontant(stats.coutMois)}    couleur="bg-secondary" />
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="d-flex flex-wrap gap-3 align-items-center bg-white border rounded-3 p-3">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>)}
        </select>
        <input type="date" value={filtreDebut} onChange={(e) => setFiltreDebut(e.target.value)} className="form-control" style={{ width: 'auto' }} />
        <input type="date" value={filtreFin}   onChange={(e) => setFiltreFin(e.target.value)}   className="form-control" style={{ width: 'auto' }} />
        {(filtreVehicule || filtreDebut || filtreFin) && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreDebut(''); setFiltreFin(''); }}
                  className="btn btn-link text-muted p-0 d-flex align-items-center gap-1 small">
            <X size={16} /> Effacer
          </button>
        )}
      </div>

      {erreur && <div className="alert alert-danger d-flex align-items-center gap-2"><AlertTriangle size={20} className="flex-shrink-0" /> {erreur}</div>}

      {/* Tableau */}
      <div className="card border rounded-3 overflow-hidden">
        {chargement ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '10rem' }}>
            <div className="spinner-border text-warning" role="status" />
          </div>
        ) : pleins.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <Fuel size={48} className="mb-3 opacity-25" />
            <p className="fw-medium">Aucun plein enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Date', 'Camion', 'Station / Ville', 'Litres', 'Prix/L', 'Coût total', 'Type', 'Actions'].map((h) => (
                    <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pleins.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-gray-600 text-nowrap">{fmtDate(p.date_plein)}</td>
                    <td className="px-3 py-2 text-nowrap">
                      <span className="fw-medium text-dark">{p.immatriculation}</span>
                      <span className="text-muted small ms-1">{p.marque}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.station || '—'}{p.ville ? ` · ${p.ville}` : ''}</td>
                    <td className="px-3 py-2 text-dark fw-medium">{p.litres} L</td>
                    <td className="px-3 py-2 text-gray-600">{Number(p.prix_litre).toLocaleString('fr-FR')} Ar</td>
                    <td className="px-3 py-2 text-dark fw-semibold text-nowrap">{fmtMontant(p.cout_total)}</td>
                    <td className="px-3 py-2">
                      <span className="badge rounded-pill bg-amber-100 text-amber-700 fw-medium">
                        {TYPES_CARBURANT[p.type_carburant] || p.type_carburant}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="d-flex align-items-center gap-2">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(p)} className="btn btn-sm btn-outline-primary"><Pencil size={14} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(p)} className="btn btn-sm btn-outline-danger"><Trash2 size={14} /></button>
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

      {/* Modal */}
      {modal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
             style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3 shadow-lg w-100 overflow-y-auto" style={{ maxWidth: '32rem', maxHeight: '90vh' }}>
            <div className="d-flex align-items-center justify-content-between p-4 border-bottom position-sticky top-0 bg-white" style={{ zIndex: 10 }}>
              <h2 className="fs-6 fw-bold text-dark mb-0">
                {modal === 'ajout' ? 'Enregistrer un plein' : 'Modifier le plein'}
              </h2>
              <button onClick={fermerModal} className="btn-close" />
            </div>
            <form onSubmit={sauvegarder} className="p-4 d-flex flex-column gap-3">
              {errModal && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
                  <AlertTriangle size={16} className="flex-shrink-0" /> {errModal}
                </div>
              )}
              <div>
                <label className="form-label">Camion *</label>
                <select value={form.vehicule_id} onChange={(e) => setForm({ ...form, vehicule_id: e.target.value })} required className="form-select form-select-sm">
                  <option value="">Sélectionner un camion</option>
                  {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
                </select>
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Date du plein *</label>
                  <input type="date" value={form.date_plein} onChange={(e) => setForm({ ...form, date_plein: e.target.value })} required className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Type de carburant</label>
                  <select value={form.type_carburant} onChange={(e) => setForm({ ...form, type_carburant: e.target.value })} className="form-select form-select-sm">
                    {Object.entries(TYPES_CARBURANT).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                </div>
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Litres *</label>
                  <input type="number" step="0.01" min="0" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} required placeholder="Ex : 120.50" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Prix/litre (Ar) *</label>
                  <input type="number" step="1" min="0" value={form.prix_litre} onChange={(e) => setForm({ ...form, prix_litre: e.target.value })} required placeholder="Ex : 5200" className="form-control form-control-sm" />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Station</label>
                  <input type="text" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} placeholder="Total, Galana..." className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Ville</label>
                  <input type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Antananarivo" className="form-control form-control-sm" />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Kilométrage au plein</label>
                  <input type="number" min="0" value={form.kilometrage_au_plein} onChange={(e) => setForm({ ...form, kilometrage_au_plein: e.target.value })} placeholder="Ex : 45320" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Conso. réelle (L/km)</label>
                  <input type="number" step="0.01" min="0" value={form.consommation_reelle} onChange={(e) => setForm({ ...form, consommation_reelle: e.target.value })} placeholder="Ex : 0.32" className="form-control form-control-sm" />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Informations complémentaires..." className="form-control form-control-sm" style={{ resize: 'none' }} />
              </div>
              <div className="d-flex gap-3 pt-1">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-warning btn-sm flex-grow-1 text-white">
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
