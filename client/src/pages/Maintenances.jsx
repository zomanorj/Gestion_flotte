import React, { useEffect, useState, useCallback } from 'react';
import { Wrench, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, X, Clock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

const TYPES = {
  vidange: 'Vidange', freins: 'Freins', pneus: 'Pneus', courroie: 'Courroie',
  filtres: 'Filtres', revision_generale: 'Révision générale', autre: 'Autre'
};

const PRIORITE_CFG = {
  faible:  { label: 'Faible',  cls: 'bg-gray-100 text-gray-600' },
  normale: { label: 'Normale', cls: 'bg-blue-100 text-blue-600' },
  haute:   { label: 'Haute',   cls: 'bg-orange-100 text-orange-600' },
  urgente: { label: 'Urgente', cls: 'bg-red-100 text-red-600 animate-pulse' }
};

const STATUT_CFG = {
  planifiee: { label: 'Planifiée', cls: 'bg-yellow-100 text-yellow-700' },
  en_cours:  { label: 'En cours',  cls: 'bg-blue-100 text-blue-700' },
  terminee:  { label: 'Terminée',  cls: 'bg-green-100 text-green-700' },
  annulee:   { label: 'Annulée',   cls: 'bg-gray-100 text-gray-500' }
};

const FORM_VIDE = { vehicule_id: '', type: 'vidange', description: '', kilometrage_declencheur: '', date_prevue: '', cout_estime: '', garage: '', priorite: 'normale' };
const FORM_CLOTURE = { date_realisee: '', cout_reel: '', notes: '' };

const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtMontant = (n) => n != null ? `${Number(n).toLocaleString('fr-FR')} Ar` : '—';

const PrioriteBadge = ({ priorite }) => {
  const cfg = PRIORITE_CFG[priorite] || PRIORITE_CFG.normale;
  return <span className={`badge rounded-pill fw-semibold ${cfg.cls}`}>{cfg.label}</span>;
};

const StatutBadge = ({ statut }) => {
  const cfg = STATUT_CFG[statut] || STATUT_CFG.planifiee;
  return <span className={`badge rounded-pill fw-medium ${cfg.cls}`}>{cfg.label}</span>;
};

export default function Maintenances() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [maintenances, setMaintenances] = useState([]);
  const [alertes,      setAlertes]      = useState([]);
  const [vehicules,    setVehicules]    = useState([]);
  const [chargement,   setChargement]   = useState(true);
  const [erreur,       setErreur]       = useState('');
  const [filtreVehicule, setFiltreVehicule] = useState('');
  const [filtreStatut,   setFiltreStatut]   = useState('');
  const [filtrePriorite, setFiltrePriorite] = useState('');
  const [modal,        setModal]        = useState(false);
  const [entiteEditee, setEntiteEditee] = useState(null);
  const [form,         setForm]         = useState(FORM_VIDE);
  const [sauvegarde,   setSauvegarde]   = useState(false);
  const [errModal,     setErrModal]     = useState('');
  const [modalCloture,   setModalCloture]   = useState(false);
  const [maintenanceClt, setMaintenanceClt] = useState(null);
  const [formCloture,    setFormCloture]    = useState(FORM_CLOTURE);
  const [sauvegardeClt,  setSauvegardeClt]  = useState(false);

  const [page,         setPage]         = useState(1);
  const [paginInfo,    setPaginInfo]    = useState({ total: 0, pages: 1 });
  const LIMIT = 20;

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = { paginate: 'true', page, limit: LIMIT };
      if (filtreVehicule) params.vehicule_id = filtreVehicule;
      if (filtreStatut)   params.statut      = filtreStatut;
      if (filtrePriorite) params.priorite    = filtrePriorite;
      const [resM, resA, resV] = await Promise.all([
        api.get('/maintenances', { params }), api.get('/maintenances/alertes'), api.get('/vehicules')
      ]);
      setMaintenances(resM.data.data); setPaginInfo({ total: resM.data.total, pages: resM.data.pages });
      setAlertes(resA.data); setVehicules(resV.data); setErreur('');
    } catch {
      setErreur('Impossible de charger les maintenances');
    } finally {
      setChargement(false);
    }
  }, [filtreVehicule, filtreStatut, filtrePriorite, page]);

  useEffect(() => { setPage(1); }, [filtreVehicule, filtreStatut, filtrePriorite]);
  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => { setForm(FORM_VIDE); setEntiteEditee(null); setErrModal(''); setModal('ajout'); };
  const ouvrirEdition = (m) => {
    setForm({ vehicule_id: m.vehicule_id, type: m.type, description: m.description || '',
              kilometrage_declencheur: m.kilometrage_declencheur ?? '',
              date_prevue: m.date_prevue?.slice(0, 10) || '',
              cout_estime: m.cout_estime ?? '', garage: m.garage || '', priorite: m.priorite || 'normale' });
    setEntiteEditee(m); setErrModal(''); setModal('edition');
  };
  const fermerModal = () => { setModal(false); setEntiteEditee(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setSauvegarde(true); setErrModal('');
    try {
      if (modal === 'ajout') await api.post('/maintenances', form);
      else await api.put(`/maintenances/${entiteEditee.id}`, form);
      fermerModal(); charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally { setSauvegarde(false); }
  };

  const ouvrirCloture = (m) => {
    setMaintenanceClt(m);
    setFormCloture({ date_realisee: new Date().toISOString().slice(0, 10), cout_reel: '', notes: '' });
    setModalCloture(true);
  };
  const fermerCloture = () => { setModalCloture(false); setMaintenanceClt(null); };

  const sauvegarderCloture = async (e) => {
    e.preventDefault(); setSauvegardeClt(true);
    try {
      await api.put(`/maintenances/${maintenanceClt.id}/terminer`, formCloture);
      fermerCloture(); charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la clôture');
    } finally { setSauvegardeClt(false); }
  };

  const supprimer = async (m) => {
    const ok = await confirmer({ type: 'supprimer', element: `${TYPES[m.type]} — ${m.immatriculation}`,
      consequences: ['La maintenance planifiée sera supprimée', 'Cette action est irréversible'] });
    if (!ok) return;
    try { await api.delete(`/maintenances/${m.id}`); charger(); }
    catch (err) { alert(err.response?.data?.message || 'Erreur lors de la suppression'); }
  };

  const ModalForm = ({ show }) => show ? (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
         style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-3 shadow-lg w-100 overflow-y-auto" style={{ maxWidth: '32rem', maxHeight: '90vh' }}>
        <div className="d-flex align-items-center justify-content-between p-4 border-bottom position-sticky top-0 bg-white" style={{ zIndex: 10 }}>
          <h2 className="fs-6 fw-bold text-dark mb-0">
            {modal === 'ajout' ? 'Planifier une maintenance' : 'Modifier la maintenance'}
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
              <label className="form-label">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required className="form-select form-select-sm">
                {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label">Priorité</label>
              <select value={form.priorite} onChange={(e) => setForm({ ...form, priorite: e.target.value })} className="form-select form-select-sm">
                {Object.entries(PRIORITE_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="form-control form-control-sm" style={{ resize: 'none' }} />
          </div>
          <div className="row g-3">
            <div className="col-6">
              <label className="form-label">Date prévue</label>
              <input type="date" value={form.date_prevue} onChange={(e) => setForm({ ...form, date_prevue: e.target.value })} className="form-control form-control-sm" />
            </div>
            <div className="col-6">
              <label className="form-label">Km déclencheur</label>
              <input type="number" min="0" value={form.kilometrage_declencheur} onChange={(e) => setForm({ ...form, kilometrage_declencheur: e.target.value })} placeholder="Ex : 50000" className="form-control form-control-sm" />
            </div>
          </div>
          <div className="row g-3">
            <div className="col-6">
              <label className="form-label">Coût estimé (Ar)</label>
              <input type="number" min="0" value={form.cout_estime} onChange={(e) => setForm({ ...form, cout_estime: e.target.value })} placeholder="Ex : 85000" className="form-control form-control-sm" />
            </div>
            <div className="col-6">
              <label className="form-label">Garage</label>
              <input type="text" value={form.garage} onChange={(e) => setForm({ ...form, garage: e.target.value })} placeholder="Ex : Garage Rakoto" className="form-control form-control-sm" />
            </div>
          </div>
          <div className="d-flex gap-3 pt-1">
            <button type="button" onClick={fermerModal} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
            <button type="submit" disabled={sauvegarde} className="btn btn-warning btn-sm flex-grow-1 text-white">
              {sauvegarde ? 'Enregistrement...' : modal === 'ajout' ? 'Planifier' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <div className="d-flex flex-column gap-4">
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-orange-100 rounded-3 p-2"><Wrench size={24} className="text-orange-600" /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Maintenances</h1>
            <p className="text-muted small mb-0">{maintenances.length} maintenance(s) enregistrée(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-warning text-white d-flex align-items-center gap-2">
            <Plus size={16} /> Planifier une maintenance
          </button>
        )}
      </div>

      {/* Alertes urgentes */}
      {alertes.length > 0 && (
        <div className="alert alert-danger rounded-3">
          <h3 className="d-flex align-items-center gap-2 fw-semibold fs-6 mb-3">
            <AlertTriangle size={20} />
            {alertes.length} maintenance(s) nécessitant une attention immédiate
          </h3>
          <div className="row g-3">
            {alertes.map((a) => (
              <div key={a.id} className="col-12 col-sm-6 col-xl-4">
                <div className={`rounded-3 p-3 border ${a.priorite === 'urgente' ? 'bg-red-100 border-red-300' : 'bg-orange-50 border-orange-200'}`}>
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div>
                      <p className="fw-semibold small text-dark mb-0">{TYPES[a.type]}</p>
                      <p className="text-muted text-xs mt-1 mb-0">{a.immatriculation} — {a.marque}</p>
                    </div>
                    <PrioriteBadge priorite={a.priorite} />
                  </div>
                  {a.date_prevue && (
                    <p className="text-xs mt-2 text-gray-600 mb-0">
                      <Clock size={12} className="me-1" />
                      {a.depassee ? 'Dépassée — prévue le ' : 'Prévue le '}{fmtDate(a.date_prevue)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="d-flex flex-wrap gap-3 align-items-center bg-white border rounded-3 p-3">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>)}
        </select>
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filtrePriorite} onChange={(e) => setFiltrePriorite(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Toutes priorités</option>
          {Object.entries(PRIORITE_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        {(filtreVehicule || filtreStatut || filtrePriorite) && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreStatut(''); setFiltrePriorite(''); }}
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
        ) : maintenances.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <Wrench size={48} className="mb-3 opacity-25" />
            <p className="fw-medium">Aucune maintenance trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Camion', 'Type', 'Description', 'Date prévue', 'Kilométrage', 'Priorité', 'Statut', 'Coût estimé', 'Actions'].map(h => (
                    <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maintenances.map((m) => (
                  <tr key={m.id} className={m.depassee ? 'table-danger table-danger-subtle' : ''}>
                    <td className="px-3 py-2 text-nowrap">
                      <span className="fw-medium text-dark">{m.immatriculation}</span>
                      <span className="text-muted small ms-1">{m.marque}</span>
                    </td>
                    <td className="px-3 py-2 fw-medium text-dark text-nowrap">{TYPES[m.type]}</td>
                    <td className="px-3 py-2 text-muted text-truncate" style={{ maxWidth: '180px' }}>{m.description || '—'}</td>
                    <td className="px-3 py-2 text-nowrap">
                      <span className={m.depassee ? 'text-danger fw-medium' : 'text-gray-600'}>
                        {fmtDate(m.date_prevue)}{m.depassee && <span className="ms-1 small">(dépassée)</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-nowrap">
                      {m.kilometrage_declencheur ? `${m.kilometrage_declencheur.toLocaleString()} km` : '—'}
                    </td>
                    <td className="px-3 py-2"><PrioriteBadge priorite={m.priorite} /></td>
                    <td className="px-3 py-2"><StatutBadge statut={m.statut} /></td>
                    <td className="px-3 py-2 text-dark text-nowrap">{fmtMontant(m.cout_estime)}</td>
                    <td className="px-3 py-2">
                      <div className="d-flex align-items-center gap-1">
                        {peutModifier && !['terminee', 'annulee'].includes(m.statut) && (
                          <button onClick={() => ouvrirCloture(m)} className="btn btn-sm btn-outline-success" title="Marquer terminée">
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(m)} className="btn btn-sm btn-outline-primary" title="Modifier">
                            <Pencil size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(m)} className="btn btn-sm btn-outline-danger" title="Supprimer">
                            <Trash2 size={14} />
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

      <div className="border-top">
        <Pagination page={page} pages={paginInfo.pages} total={paginInfo.total}
                    limit={LIMIT} onChange={setPage} />
      </div>

      <ModalForm show={!!modal} />

      {/* Modal clôturer */}
      {modalCloture && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
             style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3 shadow-lg w-100" style={{ maxWidth: '26rem' }}>
            <div className="d-flex align-items-center justify-content-between p-4 border-bottom">
              <h2 className="fs-6 fw-bold text-dark mb-0">Marquer comme terminée</h2>
              <button onClick={fermerCloture} className="btn-close" />
            </div>
            <form onSubmit={sauvegarderCloture} className="p-4 d-flex flex-column gap-3">
              <p className="small text-gray-600 mb-0">
                <strong>{TYPES[maintenanceClt?.type]}</strong> — {maintenanceClt?.immatriculation}
              </p>
              <div>
                <label className="form-label">Date réalisée</label>
                <input type="date" value={formCloture.date_realisee} onChange={(e) => setFormCloture({ ...formCloture, date_realisee: e.target.value })} className="form-control form-control-sm" />
              </div>
              <div>
                <label className="form-label">Coût réel (Ar)</label>
                <input type="number" min="0" value={formCloture.cout_reel} onChange={(e) => setFormCloture({ ...formCloture, cout_reel: e.target.value })} placeholder="Montant payé" className="form-control form-control-sm" />
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea value={formCloture.notes} onChange={(e) => setFormCloture({ ...formCloture, notes: e.target.value })} rows={2} placeholder="Observations..." className="form-control form-control-sm" style={{ resize: 'none' }} />
              </div>
              <div className="d-flex gap-3 pt-1">
                <button type="button" onClick={fermerCloture} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
                <button type="submit" disabled={sauvegardeClt} className="btn btn-success btn-sm flex-grow-1">
                  {sauvegardeClt ? 'Enregistrement...' : 'Confirmer clôture'}
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
