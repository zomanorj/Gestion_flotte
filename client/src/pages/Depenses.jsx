import React, { useEffect, useState, useCallback } from 'react';
import { Receipt, Plus, Pencil, Trash2, AlertTriangle, X, CalendarDays, TrendingUp, ListChecks } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

const CATEGORIES = {
  peage: 'Péage', amende: 'Amende', lavage: 'Lavage', pneu: 'Pneu',
  pieces_detachees: 'Pièces détachées', main_oeuvre: "Main d'œuvre",
  parking: 'Parking', divers: 'Divers'
};

const CATEGORIE_COULEURS = {
  peage: 'bg-blue-100 text-blue-700', amende: 'bg-red-100 text-red-700',
  lavage: 'bg-cyan-100 text-cyan-700', pneu: 'bg-orange-100 text-orange-700',
  pieces_detachees: 'bg-purple-100 text-purple-700', main_oeuvre: 'bg-indigo-100 text-indigo-700',
  parking: 'bg-yellow-100 text-yellow-700', divers: 'bg-gray-100 text-gray-700'
};

const FORM_VIDE = { vehicule_id: '', categorie: 'peage', montant: '', date_depense: '', description: '' };
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

  const [page,         setPage]         = useState(1);
  const [paginInfo,    setPaginInfo]    = useState({ total: 0, pages: 1 });
  const LIMIT = 20;

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = { paginate: 'true', page, limit: LIMIT };
      if (filtreVehicule)  params.vehicule_id = filtreVehicule;
      if (filtreCategorie) params.categorie   = filtreCategorie;
      if (filtreDebut)     params.debut       = filtreDebut;
      if (filtreFin)       params.fin         = filtreFin;
      const [resDepenses, resStats, resVehicules] = await Promise.all([
        api.get('/depenses', { params }), api.get('/depenses/stats'), api.get('/vehicules')
      ]);
      setDepenses(resDepenses.data.data); setPaginInfo({ total: resDepenses.data.total, pages: resDepenses.data.pages });
      setStats(resStats.data); setVehicules(resVehicules.data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les dépenses');
    } finally {
      setChargement(false);
    }
  }, [filtreVehicule, filtreCategorie, filtreDebut, filtreFin, page]);

  useEffect(() => { setPage(1); }, [filtreVehicule, filtreCategorie, filtreDebut, filtreFin]);
  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => { setForm(FORM_VIDE); setDepenseEditee(null); setErrModal(''); setModal('ajout'); };
  const ouvrirEdition = (dep) => {
    setForm({ vehicule_id: dep.vehicule_id, categorie: dep.categorie, montant: dep.montant ?? '',
              date_depense: dep.date_depense?.slice(0, 10) || '', description: dep.description || '' });
    setDepenseEditee(dep); setErrModal(''); setModal('edition');
  };
  const fermerModal = () => { setModal(false); setDepenseEditee(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setSauvegarde(true); setErrModal('');
    try {
      if (modal === 'ajout') await api.post('/depenses', form);
      else await api.put(`/depenses/${depenseEditee.id}`, form);
      fermerModal(); charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally { setSauvegarde(false); }
  };

  const supprimer = async (dep) => {
    const ok = await confirmer({
      type: 'supprimer',
      element: `${CATEGORIES[dep.categorie]} — ${fmtMontant(dep.montant)}`,
      consequences: ['La dépense sera définitivement supprimée', 'Cette action est irréversible']
    });
    if (!ok) return;
    try { await api.delete(`/depenses/${dep.id}`); charger(); }
    catch (err) { alert(err.response?.data?.message || 'Erreur lors de la suppression'); }
  };

  const filtresActifs = filtreVehicule || filtreCategorie || filtreDebut || filtreFin;

  return (
    <div className="d-flex flex-column gap-4">
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-emerald-100 rounded-3 p-2"><Receipt size={24} className="text-emerald-600" /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Dépenses</h1>
            <p className="text-muted small mb-0">{depenses.length} dépense(s) enregistrée(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-success d-flex align-items-center gap-2">
            <Plus size={16} /> Ajouter une dépense
          </button>
        )}
      </div>

      {/* KPI */}
      {stats && (
        <div className="row g-3">
          <div className="col-12 col-sm-4">
            <KpiCard Icon={CalendarDays} label="Dépenses ce mois"   valeur={fmtMontant(stats.totalMois)}  couleur="bg-success" />
          </div>
          <div className="col-12 col-sm-4">
            <KpiCard Icon={TrendingUp}   label="Total cette année"  valeur={fmtMontant(stats.totalAnnee)} couleur="bg-primary" />
          </div>
          <div className="col-12 col-sm-4">
            <KpiCard Icon={ListChecks}   label="Nombre de dépenses" valeur={stats.nbDepenses}             couleur="bg-secondary" />
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="d-flex flex-wrap gap-3 align-items-center bg-white border rounded-3 p-3">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>)}
        </select>
        <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Toutes catégories</option>
          {Object.entries(CATEGORIES).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        <input type="date" value={filtreDebut} onChange={(e) => setFiltreDebut(e.target.value)} className="form-control" style={{ width: 'auto' }} />
        <input type="date" value={filtreFin}   onChange={(e) => setFiltreFin(e.target.value)}   className="form-control" style={{ width: 'auto' }} />
        {filtresActifs && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreCategorie(''); setFiltreDebut(''); setFiltreFin(''); }}
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
            <div className="spinner-border text-success" role="status" />
          </div>
        ) : depenses.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <Receipt size={48} className="mb-3 opacity-25" />
            <p className="fw-medium">Aucune dépense trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Date', 'Camion', 'Catégorie', 'Montant', 'Description', 'Actions'].map((h) => (
                    <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {depenses.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 text-gray-600 text-nowrap">{fmtDate(d.date_depense)}</td>
                    <td className="px-3 py-2 text-nowrap">
                      <span className="fw-medium text-dark">{d.immatriculation}</span>
                      <span className="text-muted small ms-1">{d.marque}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge rounded-pill fw-medium ${CATEGORIE_COULEURS[d.categorie] || 'bg-gray-100 text-gray-700'}`}>
                        {CATEGORIES[d.categorie] || d.categorie}
                      </span>
                    </td>
                    <td className="px-3 py-2 fw-semibold text-dark text-nowrap">{fmtMontant(d.montant)}</td>
                    <td className="px-3 py-2 text-muted text-truncate" style={{ maxWidth: '200px' }}>{d.description || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="d-flex align-items-center gap-2">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(d)} className="btn btn-sm btn-outline-primary"><Pencil size={14} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(d)} className="btn btn-sm btn-outline-danger"><Trash2 size={14} /></button>
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
          <div className="bg-white rounded-3 shadow-lg w-100" style={{ maxWidth: '32rem' }}>
            <div className="d-flex align-items-center justify-content-between p-4 border-bottom">
              <h2 className="fs-6 fw-bold text-dark mb-0">
                {modal === 'ajout' ? 'Ajouter une dépense' : 'Modifier la dépense'}
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
                  <label className="form-label">Catégorie *</label>
                  <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} required className="form-select form-select-sm">
                    {Object.entries(CATEGORIES).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label">Date *</label>
                  <input type="date" value={form.date_depense} onChange={(e) => setForm({ ...form, date_depense: e.target.value })} required className="form-control form-control-sm" />
                </div>
              </div>
              <div>
                <label className="form-label">Montant (Ar) *</label>
                <input type="number" step="1" min="0" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required placeholder="Ex : 45000" className="form-control form-control-sm" />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Détails de la dépense..." className="form-control form-control-sm" style={{ resize: 'none' }} />
              </div>
              <div className="d-flex gap-3 pt-1">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-success btn-sm flex-grow-1">
                  {sauvegarde ? 'Enregistrement...' : modal === 'ajout' ? 'Ajouter' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="border-top">
        <Pagination page={page} pages={paginInfo.pages} total={paginInfo.total}
                    limit={LIMIT} onChange={setPage} />
      </div>
      <ConfirmModalComponent />
    </div>
  );
}
