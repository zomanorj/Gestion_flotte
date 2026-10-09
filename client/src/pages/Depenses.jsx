import { useEffect, useState } from 'react';
import { Receipt, Plus, Pencil, Trash2, AlertTriangle, X, CalendarDays, TrendingUp, ListChecks } from 'lucide-react';
import api from '../services/api';
import { messageErreur } from '../requetes/client';
import { useDepenses, useEcriture, useStatsDepenses, useVehicules } from '../requetes';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { formaterDate, formaterMontant } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';

const CATEGORIES = {
  peage: 'Péage', amende: 'Amende', lavage: 'Lavage', pneu: 'Pneu',
  pieces_detachees: 'Pièces détachées', main_oeuvre: "Main d'œuvre",
  parking: 'Parking', divers: 'Divers'
};

const FORM_VIDE = { vehicule_id: '', categorie: 'peage', montant: '', date_depense: '', description: '' };


export default function Depenses() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [filtreVehicule,  setFiltreVehicule]  = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('');
  const [filtreDebut,     setFiltreDebut]     = useState('');
  const [filtreFin,       setFiltreFin]       = useState('');
  const [modal,       setModal]       = useState(false);
  const [depenseEditee, setDepenseEditee] = useState(null);
  const [form,        setForm]        = useState(FORM_VIDE);
  const [errModal,    setErrModal]    = useState('');

  const [page,         setPage]         = useState(1);
  const LIMIT = 20;

  const liste = useDepenses({ page, limit: LIMIT, vehicule_id: filtreVehicule, categorie: filtreCategorie,
                              debut: filtreDebut, fin: filtreFin }, { pagine: true });
  const { data: stats = null }   = useStatsDepenses();
  const { data: vehicules = [] } = useVehicules();
  const depenses   = liste.data?.data ?? [];
  const paginInfo  = { total: liste.data?.total ?? 0, pages: liste.data?.pages ?? 1 };
  const chargement = liste.isPending;
  const erreur     = liste.isError ? 'Impossible de charger les dépenses' : '';

  useEffect(() => { setPage(1); }, [filtreVehicule, filtreCategorie, filtreDebut, filtreFin]);

  const enregistrement = useEcriture('depenses', ({ id, valeurs }) =>
    id ? api.put(`/depenses/${id}`, valeurs) : api.post('/depenses', valeurs));
  const suppression = useEcriture('depenses', (id) => api.delete(`/depenses/${id}`));
  const sauvegarde = enregistrement.isPending;

  const ouvrirAjout = () => { setForm(FORM_VIDE); setDepenseEditee(null); setErrModal(''); setModal('ajout'); };
  const ouvrirEdition = (dep) => {
    setForm({ vehicule_id: dep.vehicule_id, categorie: dep.categorie, montant: dep.montant ?? '',
              date_depense: dep.date_depense?.slice(0, 10) || '', description: dep.description || '' });
    setDepenseEditee(dep); setErrModal(''); setModal('edition');
  };
  const fermerModal = () => { setModal(false); setDepenseEditee(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setErrModal('');
    try {
      await enregistrement.mutateAsync({ id: modal === 'ajout' ? null : depenseEditee.id, valeurs: form });
      fermerModal();
    } catch (err) {
      setErrModal(messageErreur(err, 'Erreur lors de la sauvegarde'));
    }
  };

  const supprimer = async (dep) => {
    const ok = await confirmer({
      type: 'supprimer',
      element: `${CATEGORIES[dep.categorie]} — ${formaterMontant(dep.montant)}`,
      consequences: ['La dépense sera définitivement supprimée', 'Cette action est irréversible']
    });
    if (!ok) return;
    try { await suppression.mutateAsync(dep.id); }
    catch (err) { alert(messageErreur(err, 'Erreur lors de la suppression')); }
  };

  const filtresActifs = filtreVehicule || filtreCategorie || filtreDebut || filtreFin;

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Dépenses"
        description="Péages, amendes, pièces et autres frais liés aux camions"
        actions={peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-primary"><Plus size={16} /> Ajouter une dépense</button>
        )}
      />

      {stats && (
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <StatCard titre="Dépenses ce mois" valeur={formaterMontant(stats.totalMois)} icone={<CalendarDays size={16} />} />
          </div>
          <div className="col-12 col-md-4">
            <StatCard titre="Total de l'année" valeur={formaterMontant(stats.totalAnnee)} icone={<TrendingUp size={16} />} />
          </div>
          <div className="col-12 col-md-4">
            <StatCard titre="Nombre de dépenses" valeur={stats.nbDepenses} icone={<ListChecks size={16} />} />
          </div>
        </div>
      )}

      <div className="barre-filtres">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} className="form-select" aria-label="Camion">
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>)}
        </select>
        <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} className="form-select" aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {Object.entries(CATEGORIES).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        <div className="plage-dates">
          <input type="date" value={filtreDebut} onChange={(e) => setFiltreDebut(e.target.value)} className="form-control" aria-label="Du" />
          <span className="text-muted small">au</span>
          <input type="date" value={filtreFin} onChange={(e) => setFiltreFin(e.target.value)} className="form-control" aria-label="Au" />
        </div>
        {filtresActifs && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreCategorie(''); setFiltreDebut(''); setFiltreFin(''); }} className="btn btn-link btn-sm text-muted">
            <X size={14} /> Effacer les filtres
          </button>
        )}
      </div>

      {erreur && <div className="alert alert-danger d-flex align-items-center gap-2"><AlertTriangle size={20} className="flex-shrink-0" /> {erreur}</div>}

      {/* Tableau */}
      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette />
        ) : depenses.length === 0 ? (
          <EtatVide Icone={Receipt} titre="Aucune dépense trouvée"
                    description={filtresActifs ? 'Modifiez ou effacez les filtres.' : 'Enregistrez les frais de route et d\'entretien de chaque camion.'} />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr><th>Date</th><th>Camion</th><th>Catégorie</th><th>Description</th><th className="text-end">Montant</th><th className="col-actions"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {depenses.map((d) => (
                  <tr key={d.id}>
                    <td className="text-gray-700 text-nowrap">{formaterDate(d.date_depense)}</td>
                    <td className="text-nowrap"><span className="immatriculation">{d.immatriculation}</span> <span className="text-muted small">{d.marque}</span></td>
                    <td><span className="badge etat-neutre">{CATEGORIES[d.categorie] || d.categorie}</span></td>
                    <td className="text-muted text-truncate" style={{ maxWidth: '18rem' }}>{d.description || '—'}</td>
                    <td className="text-end fw-semibold text-nowrap">{formaterMontant(d.montant)}</td>
                    <td className="col-actions">
                      <div className="d-flex align-items-center gap-1">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(d)} className="btn btn-icone" title="Modifier" aria-label="Modifier"><Pencil size={16} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(d)} className="btn btn-icone btn-icone-danger" title="Supprimer" aria-label="Supprimer"><Trash2 size={16} /></button>
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

      {/* Modal */}
      <Modal isOpen={!!modal} onClose={fermerModal} titre={modal === 'ajout' ? 'Ajouter une dépense' : 'Modifier la dépense'}>
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
              <div className="modale-actions">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-primary">
                  {sauvegarde && <span className="spinner-border spinner-border-sm" role="status" />}
                  {modal === 'ajout' ? 'Ajouter' : 'Enregistrer'}
                </button>
              </div>
            </form>
      </Modal>
      <ConfirmModalComponent />
    </div>
  );
}
