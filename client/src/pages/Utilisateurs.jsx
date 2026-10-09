import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Pencil, KeyRound, UserX, UserCheck } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { messageErreur } from '../requetes/client';
import { useEcriture, useUtilisateurs } from '../requetes';
import { useConfirm } from '../components/ConfirmModal';
import { formaterDate } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import Modal from '../components/Modal';
import EnTetePage from '../components/ui/EnTetePage';

const ROLES = { admin: 'Administrateur', gestionnaire: 'Gestionnaire', chauffeur: 'Chauffeur' };
const ROLE_COULEURS = {
  admin:        'etat-actif',
  gestionnaire: 'etat-neutre',
  chauffeur:    'etat-inactif'
};

const FORM_VIDE = { nom: '', email: '', password: '', role: 'gestionnaire' };

export default function Utilisateurs() {
  const { user: moi, majToken } = useAuth();
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const { data: utilisateurs = [], isPending: chargement, isError } = useUtilisateurs();
  const erreur = isError ? 'Impossible de charger les utilisateurs' : '';

  // Modal CRUD
  const [modal,      setModal]      = useState(false);
  const [userEdite,  setUserEdite]  = useState(null);
  const [form,       setForm]       = useState(FORM_VIDE);
  const [errModal,   setErrModal]   = useState('');

  // Modal changement de mot de passe
  const [modalMdp,   setModalMdp]   = useState(null); // userId
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [errMdp,     setErrMdp]     = useState('');

  const enregistrement = useEcriture('utilisateurs', ({ id, valeurs }) =>
    id ? api.put(`/users/${id}`, valeurs) : api.post('/users', valeurs));
  const sauvegarde = enregistrement.isPending;
  // Sans rafraîchissement : l'API révoque les sessions du compte, une relecture avec l'ancien
  // token avant majToken() déconnecterait l'utilisateur qui change son propre mot de passe.
  const motDePasse = useMutation({
    mutationFn: ({ id, password }) => api.patch(`/users/${id}/password`, { password }).then(({ data }) => data),
  });

  const ouvrirAjout = () => { setForm(FORM_VIDE); setUserEdite(null); setErrModal(''); setModal(true); };
  const ouvrirEdition = (u) => {
    setForm({ nom: u.nom, email: u.email, password: '', role: u.role });
    setUserEdite(u); setErrModal(''); setModal(true);
  };
  const fermerModal = () => { setModal(false); setUserEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setErrModal('');
    try {
      const valeurs = { nom: form.nom, email: form.email, role: form.role };
      if (!userEdite) valeurs.password = form.password;
      await enregistrement.mutateAsync({ id: userEdite?.id, valeurs });
      fermerModal();
    } catch (err) {
      setErrModal(messageErreur(err, 'Erreur lors de la sauvegarde'));
    }
  };

  const toggleActif = async (u) => {
    const ok = await confirmer({
      type:        u.is_active ? 'supprimer' : 'regler',
      titre:       u.is_active ? 'Désactiver le compte' : 'Réactiver le compte',
      element:     `${u.nom} (${u.email})`,
      consequences: u.is_active
        ? ['L\'utilisateur ne pourra plus se connecter', 'Ses données sont conservées']
        : ['L\'utilisateur pourra se reconnecter']
    });
    if (!ok) return;
    try {
      await enregistrement.mutateAsync({ id: u.id, valeurs: { is_active: u.is_active ? 0 : 1 } });
    } catch (err) {
      alert(messageErreur(err, 'Erreur'));
    }
  };

  const changerMotDePasse = async (e) => {
    e.preventDefault();
    setErrMdp('');
    try {
      const data = await motDePasse.mutateAsync({ id: modalMdp, password: nouveauMdp });
      // Les sessions du compte sont révoquées : pour son propre compte, l'API renvoie un nouveau token
      if (data.token) majToken(data.token);
      setModalMdp(null); setNouveauMdp('');
    } catch (err) {
      setErrMdp(messageErreur(err, 'Erreur'));
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Utilisateurs"
        description={`${utilisateurs.length} compte(s) ayant accès à l'application`}
        actions={<button onClick={ouvrirAjout} className="btn btn-primary"><Plus size={16} /> Nouveau compte</button>}
      />

      {erreur && <div className="alert alert-danger">{erreur}</div>}

      {/* Tableau */}
      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th className="col-actions"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {utilisateurs.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className={`d-flex align-items-center gap-3 ${u.is_active ? '' : 'opacity-50'}`}>
                        <span className="avatar avatar-clair">{u.nom.split(' ').map((m) => m[0]).join('').slice(0, 2).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="fw-medium mb-0">{u.nom}{u.id === moi?.id && <span className="text-muted fw-normal"> (vous)</span>}</p>
                          <p className="small text-muted mb-0">
                            {u.email}{u.chauffeur_id && ` · fiche ${u.chauffeur_prenom} ${u.chauffeur_nom}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${ROLE_COULEURS[u.role]}`}>{ROLES[u.role]}</span></td>
                    <td>{u.is_active ? <span className="badge etat-succes">Actif</span> : <span className="badge etat-inactif">Désactivé</span>}</td>
                    <td className="text-gray-700 text-nowrap">{formaterDate(u.created_at)}</td>
                    <td className="col-actions">
                      <div className="d-flex align-items-center gap-1">
                        <button onClick={() => ouvrirEdition(u)} className="btn btn-icone" title="Modifier" aria-label="Modifier"><Pencil size={16} /></button>
                        <button onClick={() => { setModalMdp(u.id); setNouveauMdp(''); setErrMdp(''); }}
                                className="btn btn-icone" title="Changer le mot de passe" aria-label="Changer le mot de passe"><KeyRound size={16} /></button>
                        {u.id !== moi?.id && (
                          <button onClick={() => toggleActif(u)}
                                  className={`btn btn-icone ${u.is_active ? 'btn-icone-danger' : ''}`}
                                  title={u.is_active ? 'Désactiver le compte' : 'Réactiver le compte'}
                                  aria-label={u.is_active ? 'Désactiver le compte' : 'Réactiver le compte'}>
                            {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
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

      {/* Modal CRUD */}
      <Modal isOpen={!!modal} onClose={fermerModal} titre={userEdite ? 'Modifier le compte' : 'Nouveau compte utilisateur'}>
            <form onSubmit={sauvegarder} className="d-flex flex-column gap-3">
              {errModal && <div className="alert alert-danger small py-2">{errModal}</div>}

              <div>
                <label className="form-label">Nom complet *</label>
                <input type="text" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})}
                       required placeholder="Ex : Rakoto Jean" className="form-control form-control-sm" />
              </div>
              <div>
                <label className="form-label">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                       required placeholder="admin@flotte.mg" className="form-control form-control-sm" />
              </div>
              {!userEdite && (
                <div>
                  <label className="form-label">Mot de passe * (min. 8 caractères)</label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                         required minLength={8} className="form-control form-control-sm" />
                </div>
              )}
              <div>
                <label className="form-label">Rôle *</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                        className="form-select form-select-sm">
                  {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="modale-actions">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-primary">
                  {sauvegarde && <span className="spinner-border spinner-border-sm" role="status" />}
                  {userEdite ? 'Mettre à jour' : 'Créer le compte'}
                </button>
              </div>
            </form>
      </Modal>

      {/* Mot de passe */}
      <Modal isOpen={!!modalMdp} onClose={() => setModalMdp(null)} titre="Réinitialiser le mot de passe" taille="sm"
             description="Les sessions ouvertes avec ce compte seront fermées.">
        <form onSubmit={changerMotDePasse} className="d-flex flex-column gap-3">
          {errMdp && <div className="alert alert-danger small py-2 mb-0">{errMdp}</div>}
          <div>
            <label className="form-label">Nouveau mot de passe</label>
            <input type="password" value={nouveauMdp} onChange={e => setNouveauMdp(e.target.value)}
                   required minLength={8} className="form-control form-control-sm" autoComplete="new-password" />
            <p className="form-text mb-0">8 caractères au minimum.</p>
          </div>
          <div className="modale-actions">
            <button type="button" onClick={() => setModalMdp(null)} className="btn btn-outline-secondary">Annuler</button>
            <button type="submit" className="btn btn-primary">Réinitialiser</button>
          </div>
        </form>
      </Modal>

      <ConfirmModalComponent />
    </div>
  );
}
