import { useEffect, useState } from 'react';
import { Wrench, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { messageErreur } from '../requetes/client';
import { useAlertesMaintenances, useEcriture, useMaintenances, useVehicules } from '../requetes';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { dateDuJour, formaterDate, formaterKm, formaterMontant } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import Modal from '../components/Modal';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';
import PanneauAlertes from '../components/ui/PanneauAlertes';

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
        <form onSubmit={sauvegarder} className="d-flex flex-column gap-3">
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
          <div className="modale-actions">
            <button type="button" onClick={fermerModal} className="btn btn-outline-secondary">Annuler</button>
            <button type="submit" disabled={sauvegarde} className="btn btn-primary">
              {sauvegarde && <span className="spinner-border spinner-border-sm" role="status" />}
              {modal === 'ajout' ? 'Planifier' : 'Enregistrer'}
            </button>
          </div>
        </form>
  );

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Maintenances"
        description={`${paginInfo.total} intervention(s) planifiée(s) ou réalisée(s)`}
        actions={peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-primary"><Plus size={16} /> Planifier une maintenance</button>
        )}
      />

      <PanneauAlertes
        titre="Maintenances à traiter"
        elements={alertes.map((a) => ({
          id: a.id,
          ton: a.priorite === 'urgente' || a.depassee ? 'danger' : 'attention',
          titre: TYPES[a.type],
          sousTitre: `${a.immatriculation} · ${a.marque}`,
          precision: a.date_prevue ? `${a.depassee ? 'Dépassée, prévue le' : 'Prévue le'} ${formaterDate(a.date_prevue)}` : null,
          badge: <PrioriteBadge priorite={a.priorite} />,
        }))}
      />

      <div className="barre-filtres">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} className="form-select" aria-label="Camion">
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>)}
        </select>
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="form-select" aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filtrePriorite} onChange={(e) => setFiltrePriorite(e.target.value)} className="form-select" aria-label="Priorité">
          <option value="">Toutes les priorités</option>
          {Object.entries(PRIORITE_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        {(filtreVehicule || filtreStatut || filtrePriorite) && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreStatut(''); setFiltrePriorite(''); }} className="btn btn-link btn-sm text-muted">
            <X size={14} /> Effacer les filtres
          </button>
        )}
      </div>

      {erreur && <div className="alert alert-danger d-flex align-items-center gap-2"><AlertTriangle size={20} className="flex-shrink-0" /> {erreur}</div>}

      {/* Tableau */}
      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette />
        ) : maintenances.length === 0 ? (
          <EtatVide Icone={Wrench} titre="Aucune maintenance trouvée"
                    description={filtreVehicule || filtreStatut || filtrePriorite ? 'Modifiez ou effacez les filtres.' : 'Planifiez les vidanges, révisions et réparations de la flotte.'} />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr><th>Intervention</th><th>Camion</th><th>Échéance</th><th>Priorité</th><th>Statut</th><th className="text-end">Coût estimé</th><th className="col-actions"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {maintenances.map((m) => (
                  <tr key={m.id}>
                    <td style={{ maxWidth: '18rem' }}>
                      <p className="fw-medium mb-0">{TYPES[m.type]}</p>
                      <p className="small text-muted mb-0 text-truncate">{m.description || m.garage || '—'}</p>
                    </td>
                    <td className="text-nowrap"><span className="immatriculation">{m.immatriculation}</span> <span className="text-muted small">{m.marque}</span></td>
                    <td className="text-nowrap">
                      <p className={`mb-0 ${m.depassee ? 'text-danger fw-medium' : 'text-gray-700'}`}>
                        {formaterDate(m.date_prevue)}{m.depassee && ' · dépassée'}
                      </p>
                      {m.kilometrage_declencheur > 0 && <p className="small text-muted mb-0">ou à {formaterKm(m.kilometrage_declencheur)}</p>}
                    </td>
                    <td><PrioriteBadge priorite={m.priorite} /></td>
                    <td><StatutBadge statut={m.statut} /></td>
                    <td className="text-end text-nowrap">{formaterMontant(m.cout_estime)}</td>
                    <td className="col-actions">
                      <div className="d-flex align-items-center gap-1">
                        {peutModifier && !['terminee', 'annulee'].includes(m.statut) && (
                          <button onClick={() => ouvrirCloture(m)} className="btn btn-icone" title="Marquer terminée" aria-label="Marquer terminée"><CheckCircle2 size={16} /></button>
                        )}
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(m)} className="btn btn-icone" title="Modifier" aria-label="Modifier"><Pencil size={16} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(m)} className="btn btn-icone btn-icone-danger" title="Supprimer" aria-label="Supprimer"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paginInfo.pages > 1 && (
          <div className="pied-tableau">
            <Pagination page={page} pages={paginInfo.pages} total={paginInfo.total} limit={LIMIT} onChange={setPage} />
          </div>
        )}
      </div>

      <Modal isOpen={!!modal} onClose={fermerModal}
             titre={modal === 'ajout' ? 'Planifier une maintenance' : 'Modifier la maintenance'}>
        {renduFormulaire()}
      </Modal>

      {/* Clôture */}
      <Modal isOpen={modalCloture} onClose={fermerCloture} titre="Marquer comme terminée" taille="sm"
             description={maintenanceClt ? `${TYPES[maintenanceClt.type]} · ${maintenanceClt.immatriculation}` : undefined}>
        <form onSubmit={sauvegarderCloture} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label">Date de réalisation</label>
            <input type="date" value={formCloture.date_realisee} onChange={(e) => setFormCloture({ ...formCloture, date_realisee: e.target.value })} className="form-control form-control-sm" />
          </div>
          <div>
            <label className="form-label">Coût réel (Ar)</label>
            <input type="number" min="0" value={formCloture.cout_reel} onChange={(e) => setFormCloture({ ...formCloture, cout_reel: e.target.value })} placeholder="Montant payé" className="form-control form-control-sm" />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea value={formCloture.notes} onChange={(e) => setFormCloture({ ...formCloture, notes: e.target.value })} rows={2} placeholder="Observations" className="form-control form-control-sm" style={{ resize: 'none' }} />
          </div>
          <div className="modale-actions">
            <button type="button" onClick={fermerCloture} className="btn btn-outline-secondary">Annuler</button>
            <button type="submit" disabled={sauvegardeClt} className="btn btn-primary">
              {sauvegardeClt && <span className="spinner-border spinner-border-sm" role="status" />}
              Confirmer la clôture
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModalComponent />
    </div>
  );
}
