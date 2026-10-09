import { useState } from 'react';
import { Building2, Plus, Pencil, Trash2, AlertTriangle, History, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { messageErreur } from '../requetes/client';
import { useClients, useEcriture, useMissionsClient } from '../requetes';
import { useConfirm } from '../components/ConfirmModal';
import { formaterDate, formaterMontant } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import Trajet from '../components/ui/Trajet';
import Modal from '../components/Modal';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';

const TYPES = { entreprise: 'Entreprise', particulier: 'Particulier' };

const STATUT_CFG = {
  planifiee: { label: 'Planifiée',  cls: 'etat-neutre'  },
  en_cours:  { label: 'En cours',   cls: 'etat-actif'   },
  terminee:  { label: 'Terminée',   cls: 'etat-succes'  },
  annulee:   { label: 'Annulée',    cls: 'etat-inactif' }
};

const FORM_VIDE = { nom: '', type: 'entreprise', contact_nom: '', telephone: '', email: '', adresse: '', ville: '', notes: '' };

export default function Clients() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [modal,       setModal]       = useState(false);
  const [clientEdite, setClientEdite] = useState(null);
  const [form,        setForm]        = useState(FORM_VIDE);
  const [errModal,    setErrModal]    = useState('');
  const [idHistorique, setIdHistorique] = useState(null);

  const { data: clients = [], isPending: chargement, isError } = useClients();
  const histo = useMissionsClient(idHistorique);
  const historique = idHistorique ? histo.data : null;
  const erreur = isError ? 'Impossible de charger les clients'
    : idHistorique && histo.isError ? 'Impossible de charger les missions de ce client' : '';

  const enregistrement = useEcriture('clients', ({ id, valeurs }) =>
    id ? api.put(`/clients/${id}`, valeurs) : api.post('/clients', valeurs));
  const suppression = useEcriture('clients', (id) => api.delete(`/clients/${id}`));
  const sauvegarde = enregistrement.isPending;

  const ouvrirAjout = () => { setForm(FORM_VIDE); setClientEdite(null); setErrModal(''); setModal(true); };
  const ouvrirEdition = (c) => {
    setForm({ nom: c.nom, type: c.type, contact_nom: c.contact_nom || '', telephone: c.telephone || '',
              email: c.email || '', adresse: c.adresse || '', ville: c.ville || '', notes: c.notes || '' });
    setClientEdite(c); setErrModal(''); setModal(true);
  };
  const fermerModal = () => { setModal(false); setClientEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setErrModal('');
    try {
      await enregistrement.mutateAsync({ id: clientEdite?.id, valeurs: form });
      fermerModal();
    } catch (err) {
      setErrModal(messageErreur(err, 'Erreur lors de la sauvegarde'));
    }
  };

  const supprimer = async (c) => {
    const ok = await confirmer({ type: 'supprimer', element: c.nom,
      consequences: ['Les missions liées seront détachées de ce client', 'Cette action est irréversible'] });
    if (!ok) return;
    try { await suppression.mutateAsync(c.id); }
    catch (err) { alert(messageErreur(err, 'Erreur lors de la suppression')); }
  };

  // Vue historique
  if (historique) {
    return (
      <div className="d-flex flex-column gap-3">
        <div>
          <button onClick={() => setIdHistorique(null)} className="btn btn-link btn-sm text-muted px-0 mb-2">
            <ArrowLeft size={14} /> Tous les clients
          </button>
          <EnTetePage titre={historique.client.nom} description={`${historique.missions.length} mission(s) réalisée(s) pour ce client`} />
        </div>

        <div className="card carte-tableau">
          {historique.missions.length === 0 ? (
            <EtatVide Icone={History} titre="Aucune mission" description="Aucune mission n'a encore été réalisée pour ce client." />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr><th>Mission</th><th>Camion et chauffeur</th><th>Départ</th><th>Statut</th><th className="text-end">Coût carburant</th></tr>
                </thead>
                <tbody>
                  {historique.missions.map(m => (
                    <tr key={m.id}>
                      <td style={{ maxWidth: '18rem' }}>
                        <p className="fw-medium mb-0 text-truncate">{m.titre}</p>
                        <p className="small text-muted mb-0"><Trajet depart={m.lieu_depart} destination={m.lieu_destination} /></p>
                      </td>
                      <td>
                        <p className="mb-0 immatriculation">{m.immatriculation}</p>
                        <p className="small text-muted mb-0">{m.chauffeur_prenom} {m.chauffeur_nom}</p>
                      </td>
                      <td className="text-gray-700 text-nowrap">{formaterDate(m.date_depart)}</td>
                      <td><span className={`badge ${STATUT_CFG[m.statut]?.cls || 'etat-neutre'}`}>{STATUT_CFG[m.statut]?.label || m.statut}</span></td>
                      <td className="text-end text-nowrap">{formaterMontant(m.cout_carburant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vue liste
  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Clients"
        description={`${clients.length} client(s) : entreprises et particuliers`}
        actions={peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-primary"><Plus size={16} /> Ajouter un client</button>
        )}
      />

      {erreur && <div className="alert alert-danger d-flex align-items-center gap-2"><AlertTriangle size={20} className="flex-shrink-0" /> {erreur}</div>}

      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette />
        ) : clients.length === 0 ? (
          <EtatVide Icone={Building2} titre="Aucun client enregistré" description="Ajoutez vos clients pour les associer aux missions et suivre leur historique." />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr><th>Client</th><th>Contact</th><th>Ville</th><th>Missions</th><th className="col-actions"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="fw-medium mb-0">{c.nom}</p>
                      <p className="small text-muted mb-0">{TYPES[c.type]}</p>
                    </td>
                    <td>
                      <p className="mb-0 text-gray-700">{c.contact_nom || '—'}</p>
                      {c.telephone && <p className="small text-muted mb-0">{c.telephone}</p>}
                    </td>
                    <td className="text-gray-700">{c.ville || '—'}</td>
                    <td>
                      <button onClick={() => setIdHistorique(c.id)} className="btn btn-link btn-sm p-0 lien-fleche">
                        <History size={14} /> {c.nb_missions} mission{c.nb_missions !== 1 ? 's' : ''}
                      </button>
                    </td>
                    <td className="col-actions">
                      <div className="d-flex align-items-center gap-1">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(c)} className="btn btn-icone" title="Modifier" aria-label="Modifier"><Pencil size={16} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(c)} className="btn btn-icone btn-icone-danger" title="Supprimer" aria-label="Supprimer"><Trash2 size={16} /></button>
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
      <Modal isOpen={!!modal} onClose={fermerModal} titre={clientEdite ? 'Modifier le client' : 'Ajouter un client'}>
            <form onSubmit={sauvegarder}>
              {errModal && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-3">
                  <AlertTriangle size={16} className="flex-shrink-0" /> {errModal}
                </div>
              )}
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Nom *</label>
                  <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Ex : COLAS Madagascar" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="form-select form-select-sm">
                    {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label">Ville</label>
                  <input type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Antananarivo" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Nom du contact</label>
                  <input type="text" value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} placeholder="Ex : Rakoto Fils" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Téléphone</label>
                  <input type="text" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="034 11 111 11" className="form-control form-control-sm" />
                </div>
                <div className="col-12">
                  <label className="form-label">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@entreprise.mg" className="form-control form-control-sm" />
                </div>
                <div className="col-12">
                  <label className="form-label">Adresse</label>
                  <textarea value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} rows={2} placeholder="Adresse complète..." className="form-control form-control-sm" style={{ resize: 'none' }} />
                </div>
                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Informations complémentaires..." className="form-control form-control-sm" style={{ resize: 'none' }} />
                </div>
              </div>
              <div className="modale-actions">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-primary">
                  {sauvegarde && <span className="spinner-border spinner-border-sm" role="status" />}
                  {clientEdite ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
      </Modal>
      <ConfirmModalComponent />
    </div>
  );
}
