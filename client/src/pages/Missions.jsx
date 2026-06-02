import React, { useState, useEffect, useCallback } from 'react';
import { Play, X, Check, Eye, Trash2, AlertTriangle, Plus, Loader2, FileDown } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

const BADGES = {
  planifiee: 'bg-gray-100 text-gray-700',
  en_cours:  'bg-blue-100 text-blue-800',
  terminee:  'bg-green-100 text-green-800',
  annulee:   'bg-red-100 text-red-700'
};

const LABELS = {
  planifiee: 'Planifiée',
  en_cours:  'En cours',
  terminee:  'Terminée',
  annulee:   'Annulée'
};

const formatDate   = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const formatAriary = (n) => n ? new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' Ar' : '—';

const FormulaireMission = ({ onSauvegarder, onAnnuler }) => {
  const [form, setForm] = useState({
    titre: '', vehicule_id: '', chauffeur_id: '', client_id: '',
    lieu_depart: 'Antananarivo', lieu_destination: '',
    distance_km: '', date_depart: '', date_retour_prevue: '',
    poids_charge: '', notes: ''
  });
  const [vehicules,     setVehicules]     = useState([]);
  const [chauffeurs,    setChauffeurs]    = useState([]);
  const [villes,        setVilles]        = useState([]);
  const [clients,       setClients]       = useState([]);
  const [erreur,        setErreur]        = useState('');
  const [loading,       setLoading]       = useState(false);
  const [calculEnCours, setCalculEnCours] = useState(false);
  const [dureeEstimee,  setDureeEstimee]  = useState(null);

  useEffect(() => {
    api.get('/vehicules',  { params: { statut: 'disponible' } }).then(({ data }) => setVehicules(data));
    api.get('/chauffeurs', { params: { statut: 'disponible' } }).then(({ data }) => setChauffeurs(data));
    api.get('/simulation/villes').then(({ data }) => setVilles(data.villes || []));
    api.get('/clients').then(({ data }) => setClients(data));
  }, []);

  useEffect(() => {
    if (form.lieu_depart && form.lieu_destination && form.lieu_depart !== form.lieu_destination) {
      calculerDistance();
    } else {
      setForm(p => ({ ...p, distance_km: '' }));
      setDureeEstimee(null);
    }
  }, [form.lieu_depart, form.lieu_destination]);

  const calculerDistance = async () => {
    setCalculEnCours(true);
    try {
      const { data } = await api.post('/simulation/route', {
        villeDepart: form.lieu_depart, villeArrivee: form.lieu_destination
      });
      setForm(p => ({ ...p, distance_km: data.distanceKm }));
      setDureeEstimee(data.dureeMin);
    } catch (e) {
      console.error('Erreur calcul route:', e);
    } finally {
      setCalculEnCours(false);
    }
  };

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.distance_km) {
      setErreur("La distance n'a pas pu être calculée.");
      return;
    }
    setLoading(true);
    setErreur('');
    try {
      await api.post('/missions', form);
      onSauvegarder();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const coutEstime = form.distance_km ? Math.round(form.distance_km * 0.30 * 5200) : null;

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
          <label className="form-label">Camion disponible *</label>
          <select name="vehicule_id" value={form.vehicule_id} onChange={handleChange} required
                  className="form-select form-select-sm">
            <option value="">— Choisir —</option>
            {vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} ({v.marque} {v.modele})</option>)}
          </select>
        </div>
        <div className="col-6">
          <label className="form-label">Chauffeur disponible *</label>
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
          <select name="lieu_depart" value={form.lieu_depart} onChange={handleChange} required
                  className="form-select form-select-sm">
            <option value="">— Choisir —</option>
            {villes.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="col-6">
          <label className="form-label">Destination *</label>
          <select name="lieu_destination" value={form.lieu_destination} onChange={handleChange} required
                  className="form-select form-select-sm">
            <option value="">— Choisir —</option>
            {villes.filter(v => v !== form.lieu_depart).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Distance calculée */}
      <div>
        <label className="form-label">Distance et durée</label>
        <div className="bg-light rounded-2 p-3 border">
          {calculEnCours ? (
            <div className="d-flex align-items-center gap-2 text-muted small">
              <span className="spinner-border spinner-border-sm" role="status" />
              Calcul de la route en cours…
            </div>
          ) : form.distance_km ? (
            <div className="row g-3">
              <div className="col-4">
                <p className="text-xs text-muted mb-1">Distance réelle</p>
                <p className="fw-bold fs-5 text-dark mb-0">{Math.round(form.distance_km)} km</p>
              </div>
              {dureeEstimee !== null && (
                <div className="col-4">
                  <p className="text-xs text-muted mb-1">Durée estimée</p>
                  <p className="fw-bold fs-5 text-dark mb-0">
                    {Math.floor(dureeEstimee / 60)}h{Math.round(dureeEstimee % 60)}min
                  </p>
                </div>
              )}
              {coutEstime !== null && (
                <div className="col-4">
                  <p className="text-xs text-muted mb-1">Coût carburant</p>
                  <p className="fw-bold fs-5 text-orange-500 mb-0">{coutEstime.toLocaleString()} Ar</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted small mb-0">Sélectionne le départ et la destination pour calculer automatiquement</p>
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
        <button type="submit" disabled={loading || calculEnCours} className="btn btn-primary btn-sm flex-grow-1">
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
      <div className="col-6"><strong>Distance :</strong> {mission.distance_km} km</div>
      <div className="col-6"><strong>Poids :</strong> {mission.poids_charge ? `${mission.poids_charge} T` : '—'}</div>
      <div className="col-6"><strong>Coût carburant :</strong> {formatAriary(mission.cout_carburant)}</div>
      <div className="col-6"><strong>Date départ :</strong> {formatDate(mission.date_depart)}</div>
      <div className="col-6"><strong>Retour réel :</strong> {formatDate(mission.date_retour_reelle)}</div>
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

  const [missions,     setMissions]     = useState([]);
  const [chargement,   setChargement]   = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [dateDebut,    setDateDebut]    = useState('');
  const [dateFin,      setDateFin]      = useState('');
  const [modal,        setModal]        = useState({ ouvert: false, mission: null, mode: 'new' });
  const [page,         setPage]         = useState(1);
  const [paginInfo,    setPaginInfo]    = useState({ total: 0, pages: 1 });
  const LIMIT = 20;

  const chargerMissions = useCallback(async () => {
    setChargement(true);
    try {
      const params = { paginate: 'true', page, limit: LIMIT };
      if (filtreStatut) params.statut = filtreStatut;
      if (dateDebut)    params.debut  = dateDebut;
      if (dateFin)      params.fin    = dateFin;
      const { data } = await api.get('/missions', { params });
      setMissions(data.data);
      setPaginInfo({ total: data.total, pages: data.pages });
    } catch {
      setMissions([]);
    } finally {
      setChargement(false);
    }
  }, [filtreStatut, dateDebut, dateFin, page]);

  useEffect(() => { setPage(1); }, [filtreStatut, dateDebut, dateFin]);
  useEffect(() => { chargerMissions(); }, [chargerMissions]);

  const demarrerMission = async (mission) => {
    try {
      await api.post(`/simulation/demarrer/${mission.id}`);
      ajouterToast('Mission démarrée !', `${mission.lieu_depart} → ${mission.lieu_destination} · Visible sur la Carte globale`);
      chargerMissions();
    } catch (e) {
      ajouterToast('Erreur de démarrage', e.response?.data?.message || e.message, true);
    }
  };

  const supprimerMission = async (mission) => {
    const consequences = ['Cette action est irréversible'];
    if (mission.statut === 'en_cours') {
      consequences.push('Le camion sera remis disponible');
      consequences.push('La simulation en cours sera arrêtée');
    }
    const ok = await confirmer({ type: 'supprimer', element: mission.titre, consequences });
    if (!ok) return;
    try {
      await api.delete(`/missions/${mission.id}`);
      ajouterToast('Mission supprimée', mission.titre);
      chargerMissions();
    } catch (e) {
      ajouterToast('Erreur', e.response?.data?.message || e.message, true);
    }
  };

  const changerStatut = async (id, nouveauStatut) => {
    try {
      await api.put(`/missions/${id}/statut`, { statut: nouveauStatut });
      chargerMissions();
    } catch (err) {
      ajouterToast('Erreur', err.response?.data?.message || 'Mise à jour impossible', true);
    }
  };

  const fermerModal   = () => setModal({ ouvert: false, mission: null, mode: 'new' });
  const apresCreation = () => { fermerModal(); chargerMissions(); };

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
                      <br /><span className="text-muted">{m.distance_km} km</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 small text-nowrap">{formatDate(m.date_depart)}</td>
                    <td className="px-3 py-2">
                      <span className={`badge rounded-pill fw-medium ${BADGES[m.statut]}`}>{LABELS[m.statut]}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="d-flex gap-1 flex-wrap align-items-center">
                        {isGestionnaire && m.statut === 'planifiee' && (
                          <button onClick={() => demarrerMission(m)}
                                  className="btn btn-warning btn-sm d-flex align-items-center gap-1 text-white">
                            <Play size={12} /> Démarrer
                          </button>
                        )}
                        {isGestionnaire && m.statut === 'planifiee' && (
                          <button onClick={() => changerStatut(m.id, 'annulee')}
                                  className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1">
                            <X size={12} /> Annuler
                          </button>
                        )}
                        {isGestionnaire && m.statut === 'en_cours' && (
                          <button onClick={() => changerStatut(m.id, 'terminee')}
                                  className="btn btn-outline-success btn-sm d-flex align-items-center gap-1">
                            <Check size={12} /> Terminer
                          </button>
                        )}
                        {m.statut === 'terminee' && (
                          <button onClick={() => setModal({ ouvert: true, mission: m, mode: 'detail' })}
                                  className="btn btn-light btn-sm d-flex align-items-center gap-1">
                            <Eye size={12} /> Détail
                          </button>
                        )}
                        <a href={`http://localhost:5000/api/missions/${m.id}/bon-livraison`}
                           target="_blank" rel="noopener noreferrer"
                           className="btn btn-sm btn-outline-primary" title="Bon de livraison PDF">
                          <FileDown size={14} />
                        </a>
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
