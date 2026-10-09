import { useState, useEffect } from 'react';
import { Play, X, Check, Eye, Trash2, AlertTriangle, Plus, FileDown } from 'lucide-react';
import api, { telechargerFichier } from '../services/api';
import { messageErreur } from '../requetes/client';
import { useChauffeurs, useClients, useEcriture, useMissions, useParametres, useVehicules } from '../requetes';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { formaterDate, formaterKm, formaterMontant } from '../utils/format';

const BADGES = {
  planifiee: 'etat-neutre',
  en_cours:  'etat-actif',
  terminee:  'etat-succes',
  annulee:   'etat-inactif'
};

const LABELS = {
  planifiee: 'Planifiée',
  en_cours:  'En cours',
  terminee:  'Terminée',
  annulee:   'Annulée'
};


const FormulaireMission = ({ onSauvegarder, onAnnuler }) => {
  const [form, setForm] = useState({
    titre: '', vehicule_id: '', chauffeur_id: '', client_id: '',
    lieu_depart: 'Antananarivo', lieu_destination: '',
    distance_km: '', date_depart: '', date_retour_prevue: '',
    poids_charge: '', notes: ''
  });
  const [erreur,        setErreur]        = useState('');

  // La disponibilité se vérifie par période (le serveur refuse un chevauchement) : un camion en
  // mission aujourd'hui peut être planifié plus tard. Seuls les camions en panne ou en maintenance
  // et les chauffeurs en congé sont écartés.
  const vehicules  = (useVehicules().data ?? []).filter(v => !['en_panne', 'maintenance'].includes(v.statut));
  const chauffeurs = (useChauffeurs().data ?? []).filter(c => c.statut !== 'conge');
  const { data: clients = [] } = useClients();
  const { data: parametres }   = useParametres();

  const creer = useEcriture('missions', (valeurs) => api.post('/missions', valeurs));
  const loading = creer.isPending;


  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      await creer.mutateAsync(form);
      onSauvegarder();
    } catch (err) {
      setErreur(messageErreur(err, 'Erreur lors de la création'));
    }
  };

  // Même calcul que le serveur à la clôture : distance × consommation du camion × prix en vigueur
  const parametre = (cle) => parametres?.find(p => p.cle === cle)?.valeur;
  const camionChoisi = vehicules.find(v => String(v.id) === String(form.vehicule_id));
  const consommation = camionChoisi?.consommation_litre_km || parametre('consommation_par_defaut');
  const prixLitre = parametre('prix_litre_gasoil');
  const coutEstime = form.distance_km && consommation && prixLitre
    ? Math.round(form.distance_km * consommation * prixLitre) : null;

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-column gap-3 small">
      <div>
        <label className="form-label">Titre de la mission *</label>
        <input name="titre" value={form.titre} onChange={handleChange} required
               placeholder="Transport ciment — Toamasina"
               className="form-control form-control-sm" />
      </div>

      <div className="row g-3">
        <div className="col-6">
          <label className="form-label">Camion *</label>
          <select name="vehicule_id" value={form.vehicule_id} onChange={handleChange} required
                  className="form-select form-select-sm">
            <option value="">— Choisir —</option>
            {vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} ({v.marque} {v.modele})</option>)}
          </select>
        </div>
        <div className="col-6">
          <label className="form-label">Chauffeur *</label>
          <select name="chauffeur_id" value={form.chauffeur_id} onChange={handleChange} required
                  className="form-select form-select-sm">
            <option value="">— Choisir —</option>
            {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </select>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-6">
          <label className="form-label">Départ *</label>
          <input type="text" name="lieu_depart" value={form.lieu_depart} onChange={handleChange} required
                 maxLength={150} placeholder="Antananarivo" className="form-control form-control-sm" />
        </div>
        <div className="col-6">
          <label className="form-label">Destination *</label>
          <input type="text" name="lieu_destination" value={form.lieu_destination} onChange={handleChange} required
                 maxLength={150} placeholder="Toamasina" className="form-control form-control-sm" />
        </div>
      </div>

      {/* Distance saisie : base du coût carburant à la clôture et des primes kilométriques */}
      <div className="row g-3 align-items-end">
        <div className="col-6">
          <label className="form-label">Distance (km) *</label>
          <input type="number" name="distance_km" value={form.distance_km} onChange={handleChange} required
                 min="1" step="0.1" placeholder="350" className="form-control form-control-sm" />
        </div>
        <div className="col-6">
          {coutEstime !== null && (
            <div className="bg-light rounded-2 px-3 py-2 border">
              <p className="text-xs text-muted mb-0">Coût carburant estimé</p>
              <p className="fw-bold text-dark mb-0">{formaterMontant(coutEstime)}</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="form-label">Client (optionnel)</label>
        <select name="client_id" value={form.client_id} onChange={handleChange} className="form-select form-select-sm">
          <option value="">— Aucun client —</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.type})</option>)}
        </select>
      </div>

      <div>
        <label className="form-label">Poids chargé (tonnes)</label>
        <input type="number" name="poids_charge" value={form.poids_charge} onChange={handleChange}
               min="0" max="100" step="0.5" placeholder="ex: 32.5" className="form-control form-control-sm" />
      </div>

      <div className="row g-3">
        <div className="col-6">
          <label className="form-label">Date de départ *</label>
          <input type="datetime-local" name="date_depart" value={form.date_depart} onChange={handleChange} required
                 className="form-control form-control-sm" />
        </div>
        <div className="col-6">
          <label className="form-label">Retour prévu *</label>
          <input type="datetime-local" name="date_retour_prevue" value={form.date_retour_prevue} onChange={handleChange} required
                 className="form-control form-control-sm" />
        </div>
      </div>

      <div>
        <label className="form-label">Marchandises transportées</label>
        <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                  placeholder="Ex : Ciment Portland — 35 tonnes"
                  className="form-control form-control-sm" style={{ resize: 'none' }} />
      </div>

      {erreur && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
          <AlertTriangle size={16} className="flex-shrink-0" /> {erreur}
        </div>
      )}

      <div className="d-flex gap-3 pt-1">
        <button type="button" onClick={onAnnuler} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm flex-grow-1">
          {loading ? '…' : 'Créer la mission'}
        </button>
      </div>
    </form>
  );
};

const DetailMission = ({ mission }) => (
  <div className="d-flex flex-column gap-3 small text-gray-700">
    <div className="row g-2">
      <div className="col-6"><strong>Camion :</strong> {mission.immatriculation}</div>
      <div className="col-6"><strong>Chauffeur :</strong> {mission.chauffeur_prenom} {mission.chauffeur_nom}</div>
      <div className="col-6"><strong>Départ :</strong> {mission.lieu_depart}</div>
      <div className="col-6"><strong>Destination :</strong> {mission.lieu_destination}</div>
      <div className="col-6"><strong>Distance :</strong> {formaterKm(mission.distance_km, 1)}</div>
      <div className="col-6"><strong>Poids :</strong> {mission.poids_charge ? `${mission.poids_charge} T` : '—'}</div>
      <div className="col-6"><strong>Coût carburant :</strong> {formaterMontant(mission.cout_carburant)}</div>
      <div className="col-6"><strong>Date départ :</strong> {formaterDate(mission.date_depart)}</div>
      <div className="col-6"><strong>Retour réel :</strong> {formaterDate(mission.date_retour_reelle)}</div>
    </div>
    {mission.notes && (
      <div className="bg-light rounded-2 p-2">
        <strong>Marchandises :</strong> {mission.notes}
      </div>
    )}
  </div>
);

export default function Missions() {
  const { user }       = useAuth();
  const isGestionnaire = ['admin', 'gestionnaire'].includes(user?.role);
  const { ajouterToast, ToastContainer }     = useToast();
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [filtreStatut, setFiltreStatut] = useState('');
  const [dateDebut,    setDateDebut]    = useState('');
  const [dateFin,      setDateFin]      = useState('');
  const [modal,        setModal]        = useState({ ouvert: false, mission: null, mode: 'new' });
  const [page,         setPage]         = useState(1);
  const LIMIT = 20;

  const { data, isPending: chargement } = useMissions(
    { page, limit: LIMIT, statut: filtreStatut, debut: dateDebut, fin: dateFin }, { pagine: true });
  const missions  = data?.data ?? [];
  const paginInfo = { total: data?.total ?? 0, pages: data?.pages ?? 1 };

  useEffect(() => { setPage(1); }, [filtreStatut, dateDebut, dateFin]);

  const suppression = useEcriture('missions', (id) => api.delete(`/missions/${id}`));
  const statut      = useEcriture('missions', ({ id, nouveauStatut }) =>
    api.put(`/missions/${id}/statut`, { statut: nouveauStatut }));

  const demarrerMission = async (mission) => {
    try {
      await statut.mutateAsync({ id: mission.id, nouveauStatut: 'en_cours' });
      ajouterToast('Mission démarrée', `${mission.lieu_depart} → ${mission.lieu_destination}`);
    } catch (e) {
      ajouterToast('Erreur de démarrage', messageErreur(e, e.message), true);
    }
  };

  const telechargerBonLivraison = async (mission) => {
    try {
      await telechargerFichier(`/missions/${mission.id}/bon-livraison`, `bon-livraison-${mission.id}.pdf`);
    } catch {
      ajouterToast('Erreur', 'Impossible de télécharger le bon de livraison', true);
    }
  };

  const supprimerMission = async (mission) => {
    const consequences = ['Cette action est irréversible'];
    if (mission.statut === 'en_cours') {
      consequences.push('Le camion et le chauffeur seront remis disponibles');
    }
    const ok = await confirmer({ type: 'supprimer', element: mission.titre, consequences });
    if (!ok) return;
    try {
      await suppression.mutateAsync(mission.id);
      ajouterToast('Mission supprimée', mission.titre);
    } catch (e) {
      ajouterToast('Erreur', messageErreur(e, e.message), true);
    }
  };

  const changerStatut = async (id, nouveauStatut) => {
    try {
      await statut.mutateAsync({ id, nouveauStatut });
    } catch (err) {
      ajouterToast('Erreur', messageErreur(err, 'Mise à jour impossible'), true);
    }
  };

  const fermerModal   = () => setModal({ ouvert: false, mission: null, mode: 'new' });
  const apresCreation = () => fermerModal();

  return (
    <div className="d-flex flex-column gap-3">

      {/* Filtres */}
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
               className="form-control" style={{ width: 'auto' }} title="Date de début" />
        <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
               className="form-control" style={{ width: 'auto' }} title="Date de fin" />
        <div className="flex-grow-1" />
        {isGestionnaire && (
          <button onClick={() => setModal({ ouvert: true, mission: null, mode: 'new' })}
                  className="btn btn-primary d-flex align-items-center gap-2">
            <Plus size={16} /> Nouvelle mission
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="card border rounded-3 overflow-hidden">
        {chargement ? (
          <div className="d-flex align-items-center justify-content-center" style={{ height: '8rem' }}>
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : missions.length === 0 ? (
          <p className="text-center text-muted py-5">Aucune mission trouvée</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Titre', 'Camion', 'Chauffeur', 'Trajet', 'Départ', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="text-uppercase small fw-semibold text-muted px-3 py-2 text-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {missions.map(m => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 fw-medium text-dark text-truncate" style={{ maxWidth: '160px' }}>{m.titre}</td>
                    <td className="px-3 py-2 text-gray-600 font-monospace small">{m.immatriculation}</td>
                    <td className="px-3 py-2 text-gray-600">{m.chauffeur_prenom} {m.chauffeur_nom}</td>
                    <td className="px-3 py-2 text-gray-600 small">
                      {m.lieu_depart} → {m.lieu_destination}
                      <br /><span className="text-muted">{formaterKm(m.distance_km, 1)}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 small text-nowrap">{formaterDate(m.date_depart)}</td>
                    <td className="px-3 py-2">
                      <span className={`badge rounded-pill fw-medium ${BADGES[m.statut]}`}>{LABELS[m.statut]}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="d-flex gap-1 flex-wrap align-items-center">
                        {isGestionnaire && m.statut === 'planifiee' && (
                          <button onClick={() => demarrerMission(m)}
                                  className="btn btn-primary btn-sm d-flex align-items-center gap-1">
                            <Play size={12} /> Démarrer
                          </button>
                        )}
                        {isGestionnaire && m.statut === 'planifiee' && (
                          <button onClick={() => changerStatut(m.id, 'annulee')}
                                  className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
                            <X size={12} /> Annuler
                          </button>
                        )}
                        {isGestionnaire && m.statut === 'en_cours' && (
                          <button onClick={() => changerStatut(m.id, 'terminee')}
                                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1">
                            <Check size={12} /> Terminer
                          </button>
                        )}
                        {m.statut === 'terminee' && (
                          <button onClick={() => setModal({ ouvert: true, mission: m, mode: 'detail' })}
                                  className="btn btn-light btn-sm d-flex align-items-center gap-1">
                            <Eye size={12} /> Détail
                          </button>
                        )}
                        <button onClick={() => telechargerBonLivraison(m)}
                                className="btn btn-sm btn-outline-primary" title="Bon de livraison PDF">
                          <FileDown size={14} />
                        </button>
                        {user?.role === 'admin' && (
                          <button onClick={() => supprimerMission(m)}
                                  className="btn btn-sm btn-outline-danger" title="Supprimer">
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

      <Modal isOpen={modal.ouvert} onClose={fermerModal}
             titre={modal.mode === 'detail' ? `Détail — ${modal.mission?.titre}` : 'Nouvelle mission de transport'}
             taille="max-w-2xl">
        {modal.mode === 'detail'
          ? <DetailMission mission={modal.mission} />
          : <FormulaireMission onSauvegarder={apresCreation} onAnnuler={fermerModal} />
        }
      </Modal>

      <ToastContainer />
      <ConfirmModalComponent />
    </div>
  );
}
