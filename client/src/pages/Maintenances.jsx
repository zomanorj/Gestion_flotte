import { useEffect, useState } from 'react';
import { Wrench, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, X, Clock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { messageErreur } from '../requetes/client';
import { useAlertesMaintenances, useEcriture, useMaintenances, useVehicules } from '../requetes';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { dateDuJour, formaterDate, formaterKm, formaterMontant } from '../utils/format';

const TYPES = {
  vidange: 'Vidange', freins: 'Freins', pneus: 'Pneus', courroie: 'Courroie',
  filtres: 'Filtres', revision_generale: 'Révision générale', autre: 'Autre'
};

const PRIORITE_CFG = {
  faible:  { label: 'Faible',  cls: 'etat-inactif' },
  normale: { label: 'Normale', cls: 'etat-neutre' },
  haute:   { label: 'Haute',   cls: 'etat-attention' },
  urgente: { label: 'Urgente', cls: 'etat-danger animate-pulse' }
};

const STATUT_CFG = {
  planifiee: { label: 'Planifiée', cls: 'etat-neutre' },
  en_cours:  { label: 'En cours',  cls: 'etat-actif' },
  terminee:  { label: 'Terminée',  cls: 'etat-succes' },
  annulee:   { label: 'Annulée',   cls: 'etat-inactif' }
};

const FORM_VIDE = { vehicule_id: '', type: 'vidange', description: '', kilometrage_declencheur: '', date_prevue: '', cout_estime: '', garage: '', priorite: 'normale' };
const FORM_CLOTURE = { date_realisee: '', cout_reel: '', notes: '' };


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

  const [filtreVehicule, setFiltreVehicule] = useState('');
  const [filtreStatut,   setFiltreStatut]   = useState('');
  const [filtrePriorite, setFiltrePriorite] = useState('');
  const [modal,        setModal]        = useState(false);
  const [entiteEditee, setEntiteEditee] = useState(null);
  const [form,         setForm]         = useState(FORM_VIDE);
  const [errModal,     setErrModal]     = useState('');
  const [modalCloture,   setModalCloture]   = useState(false);
  const [maintenanceClt, setMaintenanceClt] = useState(null);
  const [formCloture,    setFormCloture]    = useState(FORM_CLOTURE);

  const [page,         setPage]         = useState(1);
  const LIMIT = 20;

  const { data: resultat, isPending: chargement, isError } = useMaintenances(
    { page, limit: LIMIT, vehicule_id: filtreVehicule, statut: filtreStatut, priorite: filtrePriorite },
    { pagine: true },
  );
  const maintenances = resultat?.data ?? [];
  const paginInfo = { total: resultat?.total ?? 0, pages: resultat?.pages ?? 1 };
  const alertes   = useAlertesMaintenances().data ?? [];
  const vehicules = useVehicules().data ?? [];
  const erreur = isError ? 'Impossible de charger les maintenances' : '';

  const enregistrement = useEcriture('maintenances', ({ id, valeurs }) =>
    id ? api.put(`/maintenances/${id}`, valeurs) : api.post('/maintenances', valeurs));
  const cloture = useEcriture('maintenances', ({ id, valeurs }) => api.put(`/maintenances/${id}/terminer`, valeurs));
  const suppression = useEcriture('maintenances', (id) => api.delete(`/maintenances/${id}`));
  const sauvegarde    = enregistrement.isPending;
  const sauvegardeClt = cloture.isPending;

  useEffect(() => { setPage(1); }, [filtreVehicule, filtreStatut, filtrePriorite]);

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
    e.preventDefault(); setErrModal('');
    try {
      await enregistrement.mutateAsync({ id: modal === 'ajout' ? null : entiteEditee.id, valeurs: form });
      fermerModal();
    } catch (err) {
      setErrModal(messageErreur(err, 'Erreur lors de la sauvegarde'));
    }
  };

  const ouvrirCloture = (m) => {
    setMaintenanceClt(m);
    setFormCloture({ date_realisee: dateDuJour(), cout_reel: '', notes: '' });
    setModalCloture(true);
  };
  const fermerCloture = () => { setModalCloture(false); setMaintenanceClt(null); };

  const sauvegarderCloture = async (e) => {
    e.preventDefault();
    try {
      await cloture.mutateAsync({ id: maintenanceClt.id, valeurs: formCloture });
      fermerCloture();
    } catch (err) {
      alert(messageErreur(err, 'Erreur lors de la clôture'));
    }
  };

  const supprimer = async (m) => {
    const ok = await confirmer({ type: 'supprimer', element: `${TYPES[m.type]} — ${m.immatriculation}`,
      consequences: ['La maintenance planifiée sera supprimée', 'Cette action est irréversible'] });
    if (!ok) return;
    try { await suppression.mutateAsync(m.id); }
    catch (err) { alert(messageErreur(err, 'Erreur lors de la suppression')); }
  };

  // Fonction de rendu, pas un composant : un composant déclaré ici serait recréé à chaque rendu
  // et les champs perdraient le focus à chaque frappe.
  const renduFormulaire = () => (
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
            <button type="submit" disabled={sauvegarde} className="btn btn-primary btn-sm flex-grow-1">
              {sauvegarde ? 'Enregistrement...' : modal === 'ajout' ? 'Planifier' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="d-flex flex-column gap-4">
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="icone-page rounded-3 p-2"><Wrench size={24} /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Maintenances</h1>
            <p className="text-muted small mb-0">{paginInfo.total} maintenance(s) enregistrée(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-primary d-flex align-items-center gap-2">
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
                      {a.depassee ? 'Dépassée — prévue le ' : 'Prévue le '}{formaterDate(a.date_prevue)}
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
            <div className="spinner-border text-primary" role="status" />
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
                        {formaterDate(m.date_prevue)}{m.depassee && <span className="ms-1 small">(dépassée)</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-nowrap">
                      {m.kilometrage_declencheur ? formaterKm(m.kilometrage_declencheur) : '—'}
                    </td>
                    <td className="px-3 py-2"><PrioriteBadge priorite={m.priorite} /></td>
                    <td className="px-3 py-2"><StatutBadge statut={m.statut} /></td>
                    <td className="px-3 py-2 text-dark text-nowrap">{formaterMontant(m.cout_estime)}</td>
                    <td className="px-3 py-2">
                      <div className="d-flex align-items-center gap-1">
                        {peutModifier && !['terminee', 'annulee'].includes(m.statut) && (
                          <button onClick={() => ouvrirCloture(m)} className="btn btn-sm btn-outline-primary" title="Marquer terminée">
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

      {modal && renduFormulaire()}

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
                <button type="submit" disabled={sauvegardeClt} className="btn btn-primary btn-sm flex-grow-1">
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
