import { useState, useEffect } from 'react';
import { ClipboardList, Pencil, Trash2, AlertTriangle, Plus, Users } from 'lucide-react';
import api from '../services/api';
import { messageErreur } from '../requetes/client';
import { useChauffeurs, useEcriture, useMissionsChauffeur } from '../requetes';
import { useDiffere } from '../hooks/useDiffere';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { formaterDate, formaterKm, formaterMontant } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import Trajet from '../components/ui/Trajet';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';
import ChampRecherche from '../components/ui/ChampRecherche';

const BADGES_STATUT = {
  disponible: 'etat-succes',
  en_mission: 'etat-actif',
  conge:      'etat-inactif'
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
  const enregistrer = useEcriture('chauffeurs', (valeurs) =>
    chauffeur?.id ? api.put(`/chauffeurs/${chauffeur.id}`, valeurs) : api.post('/chauffeurs', valeurs));
  const loading = enregistrer.isPending;

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      await enregistrer.mutateAsync(form);
      onSauvegarder();
    } catch (err) {
      setErreur(messageErreur(err, 'Erreur lors de la sauvegarde'));
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

      <div className="modale-actions">
        <button type="button" onClick={onAnnuler} className="btn btn-outline-secondary">Annuler</button>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading && <span className="spinner-border spinner-border-sm" role="status" />}
          {chauffeur?.id ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
};

const HistoriqueMissions = ({ chauffeurId }) => {
  const { data: missions = [], isPending: chargement } = useMissionsChauffeur(chauffeurId);

  if (chargement) return <LignesSquelette colonnes={2} lignes={3} />;
  if (missions.length === 0) return <EtatVide Icone={ClipboardList} titre="Aucune mission" description="Ce chauffeur n'a encore effectué aucune mission." />;

  const STATUTS_M = {
    planifiee: ['etat-neutre', 'Planifiée'],
    en_cours:  ['etat-actif', 'En cours'],
    terminee:  ['etat-succes', 'Terminée'],
    annulee:   ['etat-inactif', 'Annulée'],
  };

  return (
    <div>
      {missions.map((m) => (
        <div key={m.id} className="element-liste">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <p className="fw-medium mb-0">{m.titre}</p>
            <span className={`badge ${STATUTS_M[m.statut]?.[0] || 'etat-neutre'}`}>{STATUTS_M[m.statut]?.[1] || m.statut}</span>
          </div>
          <p className="text-muted small mt-1 mb-0">
            <span className="immatriculation">{m.immatriculation}</span> · <Trajet depart={m.lieu_depart} destination={m.lieu_destination} />
          </p>
          <p className="text-muted text-xs mt-1 mb-0">
            {formaterDate(m.date_depart)}
            {' · '}{formaterKm(m.distance_km, 1)}
            {m.cout_carburant ? ` · ${formaterMontant(m.cout_carburant)}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
};

export default function Chauffeurs() {
  const { user } = useAuth();
  const isAdmin  = ['admin', 'gestionnaire'].includes(user?.role);

  const [search,      setSearch]      = useState('');
  const [modal,       setModal]       = useState({ ouvert: false, chauffeur: null, mode: 'form' });
  const [confirmSupp, setConfirmSupp] = useState(null);

  const [page,      setPage]      = useState(1);
  const LIMIT = 15;

  const recherche = useDiffere(search);
  const { data, isPending: chargement } = useChauffeurs({ page, limit: LIMIT, search: recherche }, { pagine: true });
  const chauffeurs = data?.data ?? [];
  const paginInfo  = { total: data?.total ?? 0, pages: data?.pages ?? 1 };

  useEffect(() => { setPage(1); }, [recherche]);

  const suppression = useEcriture('chauffeurs', (id) => api.delete(`/chauffeurs/${id}`));
  const supprimer = async (id) => {
    try {
      await suppression.mutateAsync(id);
      setConfirmSupp(null);
    } catch (err) {
      alert(messageErreur(err, 'Erreur lors de la suppression'));
    }
  };

  const fermerModal      = ()  => setModal({ ouvert: false, chauffeur: null, mode: 'form' });
  const apresModification = () => fermerModal();

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Chauffeurs"
        description={chargement ? 'Chargement…' : `${paginInfo.total} chauffeur(s)${recherche ? ' correspondant à la recherche' : ''}`}
        actions={isAdmin && (
          <button onClick={() => setModal({ ouvert: true, chauffeur: null, mode: 'form' })} className="btn btn-primary">
            <Plus size={16} /> Ajouter un chauffeur
          </button>
        )}
      />

      <div className="barre-filtres">
        <ChampRecherche valeur={search} onChange={setSearch} placeholder="Rechercher par nom ou numéro de permis…" />
      </div>

      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette colonnes={5} />
        ) : chauffeurs.length === 0 ? (
          <EtatVide Icone={Users} titre={recherche ? 'Aucun chauffeur trouvé' : 'Aucun chauffeur enregistré'}
                    description={recherche ? 'Modifiez la recherche.' : 'Ajoutez les chauffeurs pour leur affecter des missions.'} />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr><th>Chauffeur</th><th>Téléphone</th><th>Permis</th><th>Statut</th><th className="col-actions"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {chauffeurs.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <span className="avatar avatar-clair">{initiales(c.prenom, c.nom).toUpperCase()}</span>
                        <span className="fw-medium">{c.prenom} {c.nom}</span>
                      </div>
                    </td>
                    <td className="text-gray-700 text-nowrap">{c.telephone}</td>
                    <td className="text-nowrap">
                      <span className="immatriculation">{c.numero_permis}</span> <span className="text-muted small">cat. {c.categorie_permis}</span>
                    </td>
                    <td><span className={`badge ${BADGES_STATUT[c.statut]}`}>{LABELS_STATUT[c.statut]}</span></td>
                    <td className="col-actions">
                      <div className="d-flex gap-1">
                        <button onClick={() => setModal({ ouvert: true, chauffeur: c, mode: 'historique' })}
                                className="btn btn-icone" title="Missions" aria-label="Missions"><ClipboardList size={16} /></button>
                        {isAdmin && (
                          <button onClick={() => setModal({ ouvert: true, chauffeur: c, mode: 'form' })}
                                  className="btn btn-icone" title="Modifier" aria-label="Modifier"><Pencil size={16} /></button>
                        )}
                        {user?.role === 'admin' && (
                          <button onClick={() => setConfirmSupp(c)} className="btn btn-icone btn-icone-danger" title="Supprimer" aria-label="Supprimer"><Trash2 size={16} /></button>
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

      <Modal isOpen={modal.ouvert} onClose={fermerModal}
             titre={modal.mode === 'historique'
               ? `${modal.chauffeur?.prenom} ${modal.chauffeur?.nom}`
               : modal.chauffeur?.id ? 'Modifier le chauffeur' : 'Ajouter un chauffeur'}
             description={modal.mode === 'historique' ? 'Historique des missions' : undefined}>
        {modal.mode === 'historique'
          ? <HistoriqueMissions chauffeurId={modal.chauffeur?.id} />
          : <FormulaireChauffeur chauffeur={modal.chauffeur} onSauvegarder={apresModification} onAnnuler={fermerModal} />
        }
      </Modal>

      <Modal isOpen={!!confirmSupp} onClose={() => setConfirmSupp(null)} titre="Supprimer ce chauffeur ?" taille="sm"
             pied={<>
               <button onClick={() => setConfirmSupp(null)} className="btn btn-outline-secondary">Annuler</button>
               <button onClick={() => supprimer(confirmSupp.id)} className="btn btn-danger"><Trash2 size={16} /> Supprimer</button>
             </>}>
        <p className="text-gray-700 mb-0">
          <strong>{confirmSupp?.prenom} {confirmSupp?.nom}</strong> sera retiré de la liste des chauffeurs. Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
}
