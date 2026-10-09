import { useEffect, useState } from 'react';
import { FileCheck, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, X, Download, Paperclip } from 'lucide-react';
import api, { telechargerFichier } from '../services/api';
import { messageErreur } from '../requetes/client';
import { useAlertesDocuments, useDocuments, useEcriture, useVehicules } from '../requetes';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { formaterDate } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import Modal from '../components/Modal';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';
import PanneauAlertes from '../components/ui/PanneauAlertes';

const TYPES = {
  carte_grise: 'Carte grise', assurance: 'Assurance', vignette: 'Vignette',
  visite_technique: 'Visite technique', autorisation_transport: 'Autorisation transport'
};

const STATUT_CONFIG = {
  valide:         { label: 'Valide',         cls: 'etat-succes',    Icon: CheckCircle2 },
  expire_bientot: { label: 'Expire bientôt', cls: 'etat-attention', Icon: Clock },
  expire:         { label: 'Expiré',         cls: 'etat-danger',    Icon: AlertTriangle }
};

const FORM_VIDE = { vehicule_id: '', type: 'carte_grise', numero: '', date_emission: '', date_expiration: '', notes: '' };

const StatutBadge = ({ statut }) => {
  const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG.valide;
  return (
    <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
  );
};

export default function Documents() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [erreurFichier, setErreurFichier] = useState('');
  const [filtreVehicule, setFiltreVehicule] = useState('');
  const [filtreType,     setFiltreType]     = useState('');
  const [modal,     setModal]     = useState(false);
  const [docEdite,  setDocEdite]  = useState(null);
  const [form,      setForm]      = useState(FORM_VIDE);
  const [errModal,  setErrModal]  = useState('');

  const [page,         setPage]         = useState(1);
  const [fichierUpload, setFichierUpload] = useState(null);
  const [uploadDocId,   setUploadDocId]   = useState(null);
  const LIMIT = 20;

  const liste = useDocuments({ page, limit: LIMIT, vehicule_id: filtreVehicule, type: filtreType }, { pagine: true });
  const { data: alertes = [] }   = useAlertesDocuments();
  const { data: vehicules = [] } = useVehicules();
  const docs       = liste.data?.data ?? [];
  const paginInfo  = { total: liste.data?.total ?? 0, pages: liste.data?.pages ?? 1 };
  const chargement = liste.isPending;
  const erreur     = liste.isError ? 'Impossible de charger les documents' : erreurFichier;

  useEffect(() => { setPage(1); }, [filtreVehicule, filtreType]);

  const envoi = useEcriture('documents', ({ docId, fichier }) => {
    const formData = new FormData();
    formData.append('fichier', fichier);
    return api.post(`/documents/${docId}/fichier`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  });
  const enregistrement = useEcriture('documents', ({ id, valeurs }) =>
    id ? api.put(`/documents/${id}`, valeurs) : api.post('/documents', valeurs));
  const suppression = useEcriture('documents', (id) => api.delete(`/documents/${id}`));
  const sauvegarde = enregistrement.isPending;

  const uploadFichier = async (docId) => {
    if (!fichierUpload) return;
    try {
      await envoi.mutateAsync({ docId, fichier: fichierUpload });
      setFichierUpload(null); setUploadDocId(null);
    } catch (err) {
      alert(messageErreur(err, "Erreur lors de l'upload"));
    }
  };

  const ouvrirAjout = () => { setForm(FORM_VIDE); setDocEdite(null); setErrModal(''); setModal('ajout'); };
  const ouvrirEdition = (doc) => {
    setForm({ vehicule_id: doc.vehicule_id, type: doc.type, numero: doc.numero || '',
              date_emission: doc.date_emission?.slice(0, 10) || '',
              date_expiration: doc.date_expiration?.slice(0, 10) || '', notes: doc.notes || '' });
    setDocEdite(doc); setErrModal(''); setModal('edition');
  };
  const fermerModal = () => { setModal(false); setDocEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setErrModal('');
    try {
      await enregistrement.mutateAsync({ id: modal === 'ajout' ? null : docEdite.id, valeurs: form });
      fermerModal();
    } catch (err) {
      setErrModal(messageErreur(err, 'Erreur lors de la sauvegarde'));
    }
  };

  const telechargerDocument = async (doc) => {
    try {
      // fichier_url = "/uploads/documents/…", servi par l'API sous /api/uploads/…
      await telechargerFichier(doc.fichier_url, doc.fichier_nom || doc.fichier_url.split('/').pop());
    } catch {
      setErreurFichier('Impossible de télécharger le fichier');
    }
  };

  const supprimer = async (doc) => {
    const ok = await confirmer({ type: 'supprimer', element: `${TYPES[doc.type]} — ${doc.immatriculation}`,
      consequences: ['Le document sera définitivement supprimé', 'Cette action est irréversible'] });
    if (!ok) return;
    try { await suppression.mutateAsync(doc.id); }
    catch (err) { alert(messageErreur(err, 'Erreur lors de la suppression')); }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Documents"
        description={`${paginInfo.total} document(s) : cartes grises, assurances, vignettes, visites techniques`}
        actions={peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-primary"><Plus size={16} /> Ajouter un document</button>
        )}
      />

      <PanneauAlertes
        titre="Documents à renouveler"
        elements={alertes.map((a) => ({
          id: a.id,
          ton: a.statut === 'expire' ? 'danger' : 'attention',
          titre: TYPES[a.type],
          sousTitre: `${a.immatriculation} · ${a.marque}`,
          precision: a.jours_restants < 0 ? `Expiré depuis ${Math.abs(a.jours_restants)} jour(s)` : `Expire dans ${a.jours_restants} jour(s)`,
        }))}
      />

      <div className="barre-filtres">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} className="form-select" aria-label="Camion">
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
        </select>
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className="form-select" aria-label="Type">
          <option value="">Tous les types</option>
          {Object.entries(TYPES).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        {(filtreVehicule || filtreType) && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreType(''); }} className="btn btn-link btn-sm text-muted">
            <X size={14} /> Effacer les filtres
          </button>
        )}
      </div>

      {erreur && <div className="alert alert-danger d-flex align-items-center gap-2"><AlertTriangle size={20} className="flex-shrink-0" /> {erreur}</div>}

      {/* Tableau */}
      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette />
        ) : docs.length === 0 ? (
          <EtatVide Icone={FileCheck} titre="Aucun document trouvé"
                    description={filtreVehicule || filtreType ? 'Modifiez ou effacez les filtres.' : 'Enregistrez les pièces administratives des camions pour suivre leur expiration.'} />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr><th>Type</th><th>Numéro</th><th>Camion</th><th>Émission</th><th>Expiration</th><th>Statut</th><th className="col-actions"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="fw-medium text-nowrap">{TYPES[doc.type]}</td>
                    <td className="text-gray-700">{doc.numero || '—'}</td>
                    <td className="text-nowrap"><span className="immatriculation">{doc.immatriculation}</span> <span className="text-muted small">{doc.marque}</span></td>
                    <td className="text-gray-700 text-nowrap">{formaterDate(doc.date_emission)}</td>
                    <td className="text-gray-700 text-nowrap">{formaterDate(doc.date_expiration)}</td>
                    <td><StatutBadge statut={doc.statut} /></td>
                    <td className="col-actions">
                      <div className="d-flex align-items-center gap-1">
                        {doc.fichier_url && (
                          <button onClick={() => telechargerDocument(doc)}
                                  className="btn btn-icone" title="Télécharger le fichier" aria-label="Télécharger le fichier"><Download size={16} /></button>
                        )}
                        {peutModifier && (
                          <>
                            <button onClick={() => { setUploadDocId(doc.id); setFichierUpload(null); }}
                                    className="btn btn-icone" title="Joindre un fichier" aria-label="Joindre un fichier"><Paperclip size={16} /></button>
                            <button onClick={() => ouvrirEdition(doc)} className="btn btn-icone" title="Modifier" aria-label="Modifier"><Pencil size={16} /></button>
                          </>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(doc)} className="btn btn-icone btn-icone-danger" title="Supprimer" aria-label="Supprimer"><Trash2 size={16} /></button>
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

      {/* Fichier joint */}
      <Modal isOpen={!!uploadDocId} onClose={() => { setUploadDocId(null); setFichierUpload(null); }}
             titre="Joindre un fichier" description="PDF, image ou document Word, 10 Mo au plus." taille="sm"
             pied={<>
               <button onClick={() => { setUploadDocId(null); setFichierUpload(null); }} className="btn btn-outline-secondary">Annuler</button>
               <button onClick={() => uploadFichier(uploadDocId)} disabled={!fichierUpload} className="btn btn-primary">Envoyer</button>
             </>}>
        <input type="file" onChange={e => setFichierUpload(e.target.files[0])}
               accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="form-control" />
      </Modal>

      {/* Formulaire */}
      <Modal isOpen={!!modal} onClose={fermerModal} titre={modal === 'ajout' ? 'Ajouter un document' : 'Modifier le document'}>
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
              <div>
                <label className="form-label">Type de document *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required className="form-select form-select-sm">
                  {Object.entries(TYPES).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Numéro du document</label>
                <input type="text" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })}
                       placeholder="Ex : ASS-2025-001" className="form-control form-control-sm" />
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Date d'émission *</label>
                  <input type="date" value={form.date_emission} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} required className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Date d'expiration *</label>
                  <input type="date" value={form.date_expiration} onChange={(e) => setForm({ ...form, date_expiration: e.target.value })} required className="form-control form-control-sm" />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          rows={2} placeholder="Informations complémentaires..."
                          className="form-control form-control-sm" style={{ resize: 'none' }} />
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
