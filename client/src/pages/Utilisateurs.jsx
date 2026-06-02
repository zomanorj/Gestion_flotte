import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, AlertTriangle, KeyRound, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

const ROLES = { admin: 'Admin', gestionnaire: 'Gestionnaire', chauffeur: 'Chauffeur' };
const ROLE_COULEURS = {
  admin:        'bg-red-100 text-red-700',
  gestionnaire: 'bg-blue-100 text-blue-700',
  chauffeur:    'bg-green-100 text-green-700'
};

const FORM_VIDE = { nom: '', email: '', password: '', role: 'gestionnaire' };

export default function Utilisateurs() {
  const { user: moi }    = useAuth();
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [utilisateurs, setUtilisateurs] = useState([]);
  const [chargement,   setChargement]   = useState(true);
  const [erreur,       setErreur]       = useState('');

  // Modal CRUD
  const [modal,      setModal]      = useState(false);
  const [userEdite,  setUserEdite]  = useState(null);
  const [form,       setForm]       = useState(FORM_VIDE);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [errModal,   setErrModal]   = useState('');

  // Modal changement de mot de passe
  const [modalMdp,   setModalMdp]   = useState(null); // userId
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [errMdp,     setErrMdp]     = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await api.get('/users');
      setUtilisateurs(data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les utilisateurs');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => { setForm(FORM_VIDE); setUserEdite(null); setErrModal(''); setModal(true); };
  const ouvrirEdition = (u) => {
    setForm({ nom: u.nom, email: u.email, password: '', role: u.role });
    setUserEdite(u); setErrModal(''); setModal(true);
  };
  const fermerModal = () => { setModal(false); setUserEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setSauvegarde(true); setErrModal('');
    try {
      const payload = { nom: form.nom, email: form.email, role: form.role };
      if (!userEdite) {
        payload.password = form.password;
        await api.post('/users', payload);
      } else {
        await api.put(`/users/${userEdite.id}`, payload);
      }
      fermerModal(); charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally { setSauvegarde(false); }
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
      await api.put(`/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur');
    }
  };

  const changerMotDePasse = async (e) => {
    e.preventDefault();
    setErrMdp('');
    try {
      await api.patch(`/users/${modalMdp}/password`, { password: nouveauMdp });
      setModalMdp(null); setNouveauMdp('');
    } catch (err) {
      setErrMdp(err.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-blue-100 rounded-3 p-2"><Users size={24} className="text-blue-600" /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Gestion des utilisateurs</h1>
            <p className="text-muted small mb-0">{utilisateurs.length} compte(s) enregistré(s)</p>
          </div>
        </div>
        <button onClick={ouvrirAjout} className="btn btn-primary d-flex align-items-center gap-2">
          <Plus size={16} /> Nouveau compte
        </button>
      </div>

      {erreur && <div className="alert alert-danger">{erreur}</div>}

      {/* Tableau */}
      <div className="card border rounded-3 overflow-hidden">
        {chargement ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '8rem' }}>
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Nom', 'Email', 'Rôle', 'Statut', 'Créé le', 'Actions'].map(h => (
                    <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {utilisateurs.map((u) => (
                  <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                    <td className="px-3 py-2">
                      <div className="fw-medium text-dark">{u.nom}</div>
                      {u.chauffeur_id && (
                        <div className="text-xs text-muted">
                          Chauffeur : {u.chauffeur_prenom} {u.chauffeur_nom}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 small">{u.email}</td>
                    <td className="px-3 py-2">
                      <span className={`badge rounded-pill fw-medium ${ROLE_COULEURS[u.role]}`}>
                        {ROLES[u.role]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {u.is_active
                        ? <span className="badge rounded-pill bg-green-100 text-green-700">Actif</span>
                        : <span className="badge rounded-pill bg-gray-100 text-gray-600">Inactif</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-muted small text-nowrap">
                      {new Date(u.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="d-flex align-items-center gap-1">
                        <button onClick={() => ouvrirEdition(u)} className="btn btn-sm btn-outline-primary" title="Modifier">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => { setModalMdp(u.id); setNouveauMdp(''); setErrMdp(''); }}
                                className="btn btn-sm btn-outline-secondary" title="Changer le mot de passe">
                          <KeyRound size={14} />
                        </button>
                        {u.id !== moi?.id && (
                          <button onClick={() => toggleActif(u)}
                                  className={`btn btn-sm ${u.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                  title={u.is_active ? 'Désactiver' : 'Réactiver'}>
                            {u.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
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
      {modal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
             style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3 shadow-lg w-100" style={{ maxWidth: '28rem' }}>
            <div className="d-flex align-items-center justify-content-between p-4 border-bottom">
              <h2 className="fs-6 fw-bold text-dark mb-0">
                {userEdite ? 'Modifier le compte' : 'Nouveau compte utilisateur'}
              </h2>
              <button onClick={fermerModal} className="btn-close" />
            </div>
            <form onSubmit={sauvegarder} className="p-4 d-flex flex-column gap-3">
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
                  <label className="form-label">Mot de passe * (min. 6 caractères)</label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                         required minLength={6} className="form-control form-control-sm" />
                </div>
              )}
              <div>
                <label className="form-label">Rôle *</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                        className="form-select form-select-sm">
                  {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="d-flex gap-2 pt-1">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-primary btn-sm flex-grow-1">
                  {sauvegarde ? 'Enregistrement...' : userEdite ? 'Mettre à jour' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal changement mot de passe */}
      {modalMdp && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
             style={{ zIndex: 1060, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3 shadow-lg p-4" style={{ maxWidth: '26rem', width: '100%' }}>
            <h3 className="fs-6 fw-bold mb-3">Réinitialiser le mot de passe</h3>
            {errMdp && <div className="alert alert-danger small py-2 mb-3">{errMdp}</div>}
            <form onSubmit={changerMotDePasse} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label">Nouveau mot de passe *</label>
                <input type="password" value={nouveauMdp} onChange={e => setNouveauMdp(e.target.value)}
                       required minLength={6} className="form-control form-control-sm" />
              </div>
              <div className="d-flex gap-2">
                <button type="button" onClick={() => setModalMdp(null)}
                        className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
                <button type="submit" className="btn btn-warning btn-sm flex-grow-1 text-white">
                  Réinitialiser
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
