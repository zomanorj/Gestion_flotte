// Page gestion des missions — distance auto, toast, suppression universelle
import React, { useState, useEffect, useCallback } from 'react';
import { Play, X, Check, Eye, Trash2, AlertTriangle, Plus, Loader2, FileDown } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';

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

const formatDate    = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const formatAriary  = (n) => n ? new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' Ar' : '—';

// ────────────────────────────────────────────────
// Formulaire de création de mission
// ────────────────────────────────────────────────
const FormulaireMission = ({ onSauvegarder, onAnnuler }) => {
  const [form, setForm] = useState({
    titre:             '',
    vehicule_id:       '',
    chauffeur_id:      '',
    client_id:         '',
    lieu_depart:       'Antananarivo',
    lieu_destination:  '',
    distance_km:       '',
    date_depart:       '',
    date_retour_prevue:'',
    poids_charge:      '',
    notes:             ''
  });

  const [vehicules,      setVehicules]      = useState([]);
  const [chauffeurs,     setChauffeurs]     = useState([]);
  const [villes,         setVilles]         = useState([]);
  const [clients,        setClients]        = useState([]);
  const [erreur,         setErreur]         = useState('');
  const [loading,        setLoading]        = useState(false);
  const [calculEnCours,  setCalculEnCours]  = useState(false);
  const [dureeEstimee,   setDureeEstimee]   = useState(null);

  // Chargement initial : camions dispo, chauffeurs dispo, liste des villes
  useEffect(() => {
    api.get('/vehicules',  { params: { statut: 'disponible' } }).then(({ data }) => setVehicules(data));
    api.get('/chauffeurs', { params: { statut: 'disponible' } }).then(({ data }) => setChauffeurs(data));
    api.get('/simulation/villes').then(({ data }) => setVilles(data.villes || []));
    api.get('/clients').then(({ data }) => setClients(data));
  }, []);

  // Calcul automatique dès que départ ET destination sont sélectionnés
  useEffect(() => {
    if (form.lieu_depart && form.lieu_destination && form.lieu_depart !== form.lieu_destination) {
      calculerDistance();
    } else {
      setForm(p => ({ ...p, distance_km: '' }));
      setDureeEstimee(null);
    }
  }, [form.lieu_depart, form.lieu_destination]);

  /** Appelle l'API ORS pour obtenir la vraie distance et durée */
  const calculerDistance = async () => {
    setCalculEnCours(true);
    try {
      const { data } = await api.post('/simulation/route', {
        villeDepart:  form.lieu_depart,
        villeArrivee: form.lieu_destination
      });
      setForm(p => ({ ...p, distance_km: data.distanceKm }));
      setDureeEstimee(data.dureeMin);
    } catch (e) {
      console.error('Erreur calcul route ORS :', e);
    } finally {
      setCalculEnCours(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.distance_km) {
      setErreur('La distance n\'a pas pu être calculée. Vérifie les villes sélectionnées.');
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

  const coutEstime = form.distance_km
    ? Math.round(form.distance_km * 0.30 * 5200)
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">

      {/* Titre */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">Titre de la mission *</label>
        <input name="titre" value={form.titre} onChange={handleChange} required
          placeholder="Transport ciment — Toamasina"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Camion + chauffeur */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-gray-700 mb-1">Camion disponible *</label>
          <select name="vehicule_id" value={form.vehicule_id} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Choisir —</option>
            {vehicules.map(v => (
              <option key={v.id} value={v.id}>{v.immatriculation} ({v.marque} {v.modele})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">Chauffeur disponible *</label>
          <select name="chauffeur_id" value={form.chauffeur_id} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Choisir —</option>
            {chauffeurs.map(c => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Départ + destination (selects depuis VILLES_MADAGASCAR) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-gray-700 mb-1">Départ *</label>
          <select name="lieu_depart" value={form.lieu_depart} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Choisir —</option>
            {villes.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">Destination *</label>
          <select name="lieu_destination" value={form.lieu_destination} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Choisir —</option>
            {villes.filter(v => v !== form.lieu_depart).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Carte distance / durée / coût — calculée automatiquement */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">Distance et durée</label>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          {calculEnCours ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Calcul de la route en cours…
            </div>
          ) : form.distance_km ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Distance réelle</p>
                <p className="font-bold text-lg text-gray-900">{Math.round(form.distance_km)} km</p>
              </div>
              {dureeEstimee !== null && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Durée estimée</p>
                  <p className="font-bold text-lg text-gray-900">
                    {Math.floor(dureeEstimee / 60)}h{Math.round(dureeEstimee % 60)}min
                  </p>
                </div>
              )}
              {coutEstime !== null && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Coût carburant</p>
                  <p className="font-bold text-lg text-orange-500">
                    {coutEstime.toLocaleString()} Ar
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">
              Sélectionne le départ et la destination pour calculer automatiquement
            </p>
          )}
        </div>
      </div>

      {/* Client (optionnel) */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">Client (optionnel)</label>
        <select name="client_id" value={form.client_id} onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— Aucun client —</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.nom} ({c.type})</option>
          ))}
        </select>
      </div>

      {/* Poids chargé */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">Poids chargé (tonnes)</label>
        <input type="number" name="poids_charge" value={form.poids_charge} onChange={handleChange}
          min="0" max="100" step="0.5" placeholder="ex: 32.5"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-gray-700 mb-1">Date de départ *</label>
          <input type="datetime-local" name="date_depart" value={form.date_depart} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">Retour prévu *</label>
          <input type="datetime-local" name="date_retour_prevue" value={form.date_retour_prevue} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Marchandises */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">Marchandises transportées</label>
        <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
          placeholder="Ex : Ciment Portland — 35 tonnes pour chantier CHU Toamasina"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      {erreur && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {erreur}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onAnnuler}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Annuler
        </button>
        <button type="submit" disabled={loading || calculEnCours}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {loading ? '…' : 'Créer la mission'}
        </button>
      </div>
    </form>
  );
};

// ────────────────────────────────────────────────
// Détail d'une mission terminée
// ────────────────────────────────────────────────
const DetailMission = ({ mission }) => (
  <div className="space-y-3 text-sm text-gray-700">
    <div className="grid grid-cols-2 gap-2">
      <span><strong>Camion :</strong> {mission.immatriculation}</span>
      <span><strong>Chauffeur :</strong> {mission.chauffeur_prenom} {mission.chauffeur_nom}</span>
      <span><strong>Départ :</strong> {mission.lieu_depart}</span>
      <span><strong>Destination :</strong> {mission.lieu_destination}</span>
      <span><strong>Distance :</strong> {mission.distance_km} km</span>
      <span><strong>Poids chargé :</strong> {mission.poids_charge ? `${mission.poids_charge} T` : '—'}</span>
      <span><strong>Coût carburant :</strong> {formatAriary(mission.cout_carburant)}</span>
      <span><strong>Date départ :</strong> {formatDate(mission.date_depart)}</span>
      <span><strong>Retour réel :</strong> {formatDate(mission.date_retour_reelle)}</span>
    </div>
    {mission.notes && (
      <div className="bg-gray-50 rounded-lg p-3">
        <strong>Marchandises :</strong> {mission.notes}
      </div>
    )}
  </div>
);

// ────────────────────────────────────────────────
// Page principale
// ────────────────────────────────────────────────
export default function Missions() {
  const { user }       = useAuth();
  const isGestionnaire = ['admin', 'gestionnaire'].includes(user?.role);
  const { ajouterToast, ToastContainer } = useToast();
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [missions,     setMissions]     = useState([]);
  const [chargement,   setChargement]   = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [dateDebut,    setDateDebut]    = useState('');
  const [dateFin,      setDateFin]      = useState('');
  const [modal,        setModal]        = useState({ ouvert: false, mission: null, mode: 'new' });

  const chargerMissions = useCallback(async () => {
    setChargement(true);
    try {
      const params = {};
      if (filtreStatut) params.statut = filtreStatut;
      if (dateDebut)    params.debut  = dateDebut;
      if (dateFin)      params.fin    = dateFin;
      const { data } = await api.get('/missions', { params });
      setMissions(data);
    } catch {
      setMissions([]);
    } finally {
      setChargement(false);
    }
  }, [filtreStatut, dateDebut, dateFin]);

  useEffect(() => { chargerMissions(); }, [chargerMissions]);

  /** Démarre la simulation via l'API et affiche une notification */
  const demarrerMission = async (mission) => {
    try {
      await api.post(`/simulation/demarrer/${mission.id}`);
      ajouterToast(
        'Mission démarrée !',
        `${mission.lieu_depart} → ${mission.lieu_destination} · Visible sur la Carte globale`
      );
      chargerMissions();
    } catch (e) {
      ajouterToast(
        'Erreur de démarrage',
        e.response?.data?.message || e.message,
        true
      );
    }
  };

  /** Supprime une mission (tous statuts) avec confirmation */
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
    <div className="space-y-4">

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Date de début" />
        <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Date de fin" />
        <div className="flex-1" />
        {isGestionnaire && (
          <button onClick={() => setModal({ ouvert: true, mission: null, mode: 'new' })}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nouvelle mission
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {chargement ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : missions.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Aucune mission trouvée</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Titre', 'Camion', 'Chauffeur', 'Trajet', 'Départ', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {missions.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">{m.titre}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{m.immatriculation}</td>
                    <td className="px-4 py-3 text-gray-600">{m.chauffeur_prenom} {m.chauffeur_nom}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {m.lieu_depart} → {m.lieu_destination}
                      <br /><span className="text-gray-400">{m.distance_km} km</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(m.date_depart)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${BADGES[m.statut]}`}>
                        {LABELS[m.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap items-center">

                        {/* Démarrer (planifiée seulement) */}
                        {isGestionnaire && m.statut === 'planifiee' && (
                          <button onClick={() => demarrerMission(m)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
                            title="Démarrer la simulation">
                            <Play className="w-3 h-3" /> Démarrer
                          </button>
                        )}

                        {/* Annuler (planifiée) */}
                        {isGestionnaire && m.statut === 'planifiee' && (
                          <button onClick={() => changerStatut(m.id, 'annulee')}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition-colors"
                            title="Annuler">
                            <X className="w-3 h-3" /> Annuler
                          </button>
                        )}

                        {/* Terminer (en_cours) */}
                        {isGestionnaire && m.statut === 'en_cours' && (
                          <button onClick={() => changerStatut(m.id, 'terminee')}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
                            title="Terminer">
                            <Check className="w-3 h-3" /> Terminer
                          </button>
                        )}

                        {/* Détail (terminée) */}
                        {m.statut === 'terminee' && (
                          <button onClick={() => setModal({ ouvert: true, mission: m, mode: 'detail' })}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                            title="Voir le détail">
                            <Eye className="w-3 h-3" /> Détail
                          </button>
                        )}

                        {/* Bon de livraison PDF — toutes les missions */}
                        <a
                          href={`http://localhost:5000/api/missions/${m.id}/bon-livraison`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Télécharger le bon de livraison PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </a>

                        {/* Supprimer — tous les statuts, admin uniquement */}
                        {user?.role === 'admin' && (
                          <button onClick={() => supprimerMission(m)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer la mission">
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal */}
      <Modal
        isOpen={modal.ouvert}
        onClose={fermerModal}
        titre={modal.mode === 'detail' ? `Détail — ${modal.mission?.titre}` : 'Nouvelle mission de transport'}
        taille="max-w-2xl"
      >
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
