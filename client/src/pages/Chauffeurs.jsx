import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Pencil, Trash2, AlertTriangle, Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const BADGES_STATUT = {
  disponible: 'bg-green-100 text-green-800',
  en_mission: 'bg-blue-100 text-blue-800',
  conge:      'bg-gray-100 text-gray-700'
};

const LABELS_STATUT = {
  disponible: 'Disponible',
  en_mission: 'En mission',
  conge:      'En congé'
};

const initiales = (prenom = '', nom = '') => (prenom[0] || '') + (nom[0] || '');

const FormulaireChauffeur = ({ chauffeur, onSauvegarder, onAnnuler }) => {
  const [form, setForm] = useState({
    nom:              chauffeur?.nom              || '',
    prenom:           chauffeur?.prenom           || '',
    telephone:        chauffeur?.telephone        || '',
    numero_permis:    chauffeur?.numero_permis    || '',
    categorie_permis: chauffeur?.categorie_permis || 'B',
    statut:           chauffeur?.statut           || 'disponible'
  });
  const [erreur,  setErreur]  = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErreur('');
    try {
      if (chauffeur?.id) {
        await api.put(`/chauffeurs/${chauffeur.id}`, form);
      } else {
        await api.post('/chauffeurs', form);
      }
      onSauvegarder();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
      <div className="row g-3">
        <div className="col-6">
          <label className="form-label">Prénom *</label>
          <input name="prenom" value={form.prenom} onChange={handleChange} required
                 className="form-control form-control-sm" placeholder="Hery" />
        </div>
        <div className="col-6">
          <label className="form-label">Nom *</label>
          <input name="nom" value={form.nom} onChange={handleChange} required
                 className="form-control form-control-sm" placeholder="Rakotondrabe" />
        </div>
      </div>

      <div>
        <label className="form-label">Téléphone *</label>
        <input name="telephone" value={form.telephone} onChange={handleChange} required
               className="form-control form-control-sm" placeholder="+261 34 12 345 67" />
      </div>

      <div className="row g-3">
        <div className="col-6">
          <label className="form-label">N° Permis *</label>
          <input name="numero_permis" value={form.numero_permis} onChange={handleChange} required
                 className="form-control form-control-sm" placeholder="MG-P-2020-00789" />
        </div>
        <div className="col-6">
          <label className="form-label">Catégorie</label>
          <select name="categorie_permis" value={form.categorie_permis} onChange={handleChange}
                  className="form-select form-select-sm">
            {['B', 'BC', 'BCE', 'C', 'D'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="form-label">Statut</label>
        <select name="statut" value={form.statut} onChange={handleChange} className="form-select form-select-sm">
          {Object.entries(LABELS_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {erreur && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
          <AlertTriangle size={16} className="flex-shrink-0" /> {erreur}
        </div>
      )}

      <div className="d-flex gap-3 pt-1">
        <button type="button" onClick={onAnnuler} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm flex-grow-1">
          {loading ? '…' : chauffeur?.id ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
};

const HistoriqueMissions = ({ chauffeurId }) => {
  const [missions,   setMissions]   = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api.get(`/chauffeurs/${chauffeurId}/missions`)
      .then(({ data }) => { setMissions(data); setChargement(false); })
      .catch(() => setChargement(false));
  }, [chauffeurId]);

  if (chargement) return <div className="text-center py-4 text-muted">Chargement…</div>;
  if (missions.length === 0) return <p className="text-center text-muted py-4">Aucune mission enregistrée</p>;

  const BADGES_M = {
    planifiee: 'bg-gray-100 text-gray-700',
    en_cours:  'bg-blue-100 text-blue-700',
    terminee:  'bg-green-100 text-green-700',
    annulee:   'bg-red-100 text-red-700'
  };

  return (
    <div className="d-flex flex-column gap-3 small">
      {missions.map((m) => (
        <div key={m.id} className="bg-light rounded-3 p-3 border">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <p className="fw-medium text-dark mb-0">{m.titre}</p>
            <span className={`badge rounded-pill fw-medium ${BADGES_M[m.statut]}`}>{m.statut}</span>
          </div>
          <p className="text-muted mt-1 mb-0">
            {m.immatriculation} • {m.lieu_depart} → {m.lieu_destination}
          </p>
          <p className="text-muted text-xs mt-1 mb-0">
            {new Date(m.date_depart).toLocaleDateString('fr-FR')}
            {' · '}{m.distance_km} km
            {m.cout_carburant ? ` · ${new Intl.NumberFormat('fr-FR').format(m.cout_carburant)} Ar` : ''}
          </p>
        </div>
      ))}
    </div>
  );
};

export default function Chauffeurs() {
  const { user } = useAuth();
  const isAdmin  = ['admin', 'gestionnaire'].includes(user?.role);

  const [chauffeurs,  setChauffeurs]  = useState([]);
  const [chargement,  setChargement]  = useState(true);
  const [search,      setSearch]      = useState('');
  const [modal,       setModal]       = useState({ ouvert: false, chauffeur: null, mode: 'form' });
  const [confirmSupp, setConfirmSupp] = useState(null);

  const [page,      setPage]      = useState(1);
  const [paginInfo, setPaginInfo] = useState({ total: 0, pages: 1 });
  const LIMIT = 15;

  const chargerChauffeurs = useCallback(async () => {
    setChargement(true);
    try {
      const params = { paginate: 'true', page, limit: LIMIT };
      if (search) params.search = search;
      const { data } = await api.get('/chauffeurs', { params });
      setChauffeurs(data.data);
      setPaginInfo({ total: data.total, pages: data.pages });
    } catch {
      setChauffeurs([]);
    } finally {
      setChargement(false);
    }
  }, [search, page]);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { chargerChauffeurs(); }, [chargerChauffeurs]);

  const supprimer = async (id) => {
    try {
      await api.delete(`/chauffeurs/${id}`);
      setConfirmSupp(null);
      chargerChauffeurs();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const fermerModal      = ()  => setModal({ ouvert: false, chauffeur: null, mode: 'form' });
  const apresModification = () => { fermerModal(); chargerChauffeurs(); };

  return (
    <div className="d-flex flex-column gap-3">
      {/* Barre d'outils */}
      <div className="d-flex flex-column flex-sm-row gap-2">
        <input type="text" placeholder="Rechercher par nom ou numéro de permis…"
               value={search} onChange={(e) => setSearch(e.target.value)}
               className="form-control flex-grow-1" />
        {isAdmin && (
          <button onClick={() => setModal({ ouvert: true, chauffeur: null, mode: 'form' })}
                  className="btn btn-primary d-flex align-items-center gap-2 text-nowrap">
            <Plus size={16} /> Ajouter un chauffeur
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="card border rounded-3 overflow-hidden">
        {chargement ? (
          <div className="d-flex align-items-center justify-content-center" style={{ height: '8rem' }}>
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : chauffeurs.length === 0 ? (
          <p className="text-center text-muted py-5">Aucun chauffeur trouvé</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['', 'Nom', 'Téléphone', 'Permis', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="text-uppercase small fw-semibold text-muted px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chauffeurs.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center
                                      text-white fw-bold small"
                           style={{ width: '36px', height: '36px' }}>
                        {initiales(c.prenom, c.nom).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-3 py-2 fw-medium text-dark">{c.prenom} {c.nom}</td>
                    <td className="px-3 py-2 text-gray-600">{c.telephone}</td>
                    <td className="px-3 py-2 text-gray-600 font-monospace small">
                      {c.numero_permis} <span className="text-muted">({c.categorie_permis})</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge rounded-pill fw-medium ${BADGES_STATUT[c.statut]}`}>
                        {LABELS_STATUT[c.statut]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="d-flex gap-1">
                        <button onClick={() => setModal({ ouvert: true, chauffeur: c, mode: 'historique' })}
                                className="btn btn-sm btn-light d-flex align-items-center gap-1 small">
                          <ClipboardList size={14} /> Missions
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => setModal({ ouvert: true, chauffeur: c, mode: 'form' })}
                                    className="btn btn-sm btn-outline-primary">
                              <Pencil size={14} />
                            </button>
                            {user?.role === 'admin' && (
                              <button onClick={() => setConfirmSupp(c)} className="btn btn-sm btn-outline-danger">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
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

      <Modal isOpen={modal.ouvert} onClose={fermerModal}
             titre={modal.mode === 'historique'
               ? `Missions — ${modal.chauffeur?.prenom} ${modal.chauffeur?.nom}`
               : modal.chauffeur?.id ? 'Modifier le chauffeur' : 'Ajouter un chauffeur'}>
        {modal.mode === 'historique'
          ? <HistoriqueMissions chauffeurId={modal.chauffeur?.id} />
          : <FormulaireChauffeur chauffeur={modal.chauffeur} onSauvegarder={apresModification} onAnnuler={fermerModal} />
        }
      </Modal>

      <Modal isOpen={!!confirmSupp} onClose={() => setConfirmSupp(null)} titre="Confirmer la suppression">
        <p className="text-gray-700 mb-4">
          Supprimer le chauffeur <strong>{confirmSupp?.prenom} {confirmSupp?.nom}</strong> ?
        </p>
        <div className="d-flex gap-3">
          <button onClick={() => setConfirmSupp(null)} className="btn btn-outline-secondary flex-grow-1">Annuler</button>
          <button onClick={() => supprimer(confirmSupp.id)}
                  className="btn btn-danger flex-grow-1 d-flex align-items-center justify-content-center gap-2">
            <Trash2 size={16} /> Supprimer
          </button>
        </div>
      </Modal>

      <div className="border-top mt-2">
        <Pagination page={page} pages={paginInfo.pages} total={paginInfo.total}
                    limit={LIMIT} onChange={setPage} />
      </div>
    </div>
  );
}
