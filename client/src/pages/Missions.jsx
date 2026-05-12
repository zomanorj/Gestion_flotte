// Page gestion des missions — workflow complet de statuts
import React, { useState, useEffect, useCallback } from 'react';
import { Play, X, Check, Eye, Trash2, AlertTriangle, Coins, Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

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

const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const formatAriary = (n) => n ? new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' Ar' : '—';

/** Formulaire de création de mission */
const FormulaireMission = ({ onSauvegarder, onAnnuler }) => {
  const [form, setForm] = useState({
    titre: '', vehicule_id: '', chauffeur_id: '',
    lieu_depart: 'Antananarivo', lieu_destination: '',
    distance_km: '', date_depart: '', date_retour_prevue: '',
    poids_charge: '', notes: ''
  });
  const [vehicules,   setVehicules]   = useState([]);
  const [chauffeurs,  setChauffeurs]  = useState([]);
  const [erreur,      setErreur]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [coutEstime,  setCoutEstime]  = useState(null);

  // Chargement des ressources disponibles uniquement
  useEffect(() => {
    api.get('/vehicules',  { params: { statut: 'disponible' } }).then(({ data }) => setVehicules(data));
    api.get('/chauffeurs', { params: { statut: 'disponible' } }).then(({ data }) => setChauffeurs(data));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => {
      const next = { ...p, [name]: value };
      // Calcul automatique du coût estimé lors de la saisie de la distance
      if (name === 'distance_km' && value > 0) {
        setCoutEstime(parseFloat(value) * 0.30 * 5200);
      } else if (name === 'distance_km') {
        setCoutEstime(null);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      <div>
        <label className="block font-medium text-gray-700 mb-1">Titre de la mission *</label>
        <input name="titre" value={form.titre} onChange={handleChange} required
          placeholder="Livraison matériel — Toamasina"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-gray-700 mb-1">Véhicule disponible *</label>
          <select name="vehicule_id" value={form.vehicule_id} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Choisir —</option>
            {vehicules.map((v) => (
              <option key={v.id} value={v.id}>{v.immatriculation} ({v.marque} {v.modele})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">Chauffeur disponible *</label>
          <select name="chauffeur_id" value={form.chauffeur_id} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Choisir —</option>
            {chauffeurs.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-gray-700 mb-1">Lieu de départ *</label>
          <input name="lieu_depart" value={form.lieu_depart} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">Destination *</label>
          <input name="lieu_destination" value={form.lieu_destination} onChange={handleChange} required
            placeholder="Toamasina"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label className="block font-medium text-gray-700 mb-1">Distance (km)</label>
        <input type="number" name="distance_km" value={form.distance_km} onChange={handleChange}
          min="0" step="0.1" placeholder="260"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {coutEstime !== null && (
          <p className="flex items-center gap-1.5 text-xs text-blue-600 mt-1">
            <Coins className="w-3.5 h-3.5" />
            Coût carburant estimé : <strong>{formatAriary(coutEstime)}</strong>
            <span className="text-gray-400">(0,30 L/km × 5 200 Ar/L)</span>
          </p>
        )}
      </div>

      {/* Poids de la charge transportée */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">Poids chargé (tonnes)</label>
        <input type="number" name="poids_charge" value={form.poids_charge} onChange={handleChange}
          min="0" max="100" step="0.5" placeholder="ex: 32.5"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p className="text-xs text-gray-400 mt-1">Tonnage effectivement chargé sur le camion</p>
      </div>

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

      <div>
        <label className="block font-medium text-gray-700 mb-1">Marchandises transportées</label>
        <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
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
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {loading ? '…' : 'Créer la mission'}
        </button>
      </div>
    </form>
  );
};

/** Détail d'une mission de transport terminée */
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
        <strong>Marchandises transportées :</strong> {mission.notes}
      </div>
    )}
  </div>
);

export default function Missions() {
  const { user } = useAuth();
  const isGestionnaire = ['admin', 'gestionnaire'].includes(user?.role);

  const [missions,    setMissions]    = useState([]);
  const [chargement,  setChargement]  = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [dateDebut,   setDateDebut]   = useState('');
  const [dateFin,     setDateFin]     = useState('');
  const [modal,       setModal]       = useState({ ouvert: false, mission: null, mode: 'new' });

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

  /** Change le statut d'une mission et recharge la liste */
  const changerStatut = async (id, nouveauStatut) => {
    try {
      await api.put(`/missions/${id}/statut`, { statut: nouveauStatut });
      chargerMissions();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const supprimer = async (id) => {
    if (!window.confirm('Supprimer cette mission ?')) return;
    try {
      await api.delete(`/missions/${id}`);
      chargerMissions();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const fermerModal = () => setModal({ ouvert: false, mission: null, mode: 'new' });
  const apresCreation = () => { fermerModal(); chargerMissions(); };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Date de début" />
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Date de fin" />
        <div className="flex-1" />
        {isGestionnaire && (
          <button
            onClick={() => setModal({ ouvert: true, mission: null, mode: 'new' })}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Nouvelle mission de transport
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
                  {['Titre', 'Véhicule', 'Chauffeur', 'Trajet', 'Départ', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {missions.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{m.titre}</td>
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
                      <div className="flex gap-1 flex-wrap">
                        {/* Boutons selon le statut */}
                        {isGestionnaire && m.statut === 'planifiee' && (
                          <>
                            <button
                              onClick={() => changerStatut(m.id, 'en_cours')}
                              className="flex items-center gap-1 px-2 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                              title="Démarrer la mission"
                            >
                              <Play className="w-3 h-3" /> Démarrer
                            </button>
                            <button
                              onClick={() => changerStatut(m.id, 'annulee')}
                              className="flex items-center gap-1 px-2 py-1.5 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition-colors"
                              title="Annuler la mission"
                            >
                              <X className="w-3 h-3" /> Annuler
                            </button>
                          </>
                        )}
                        {isGestionnaire && m.statut === 'en_cours' && (
                          <button
                            onClick={() => changerStatut(m.id, 'terminee')}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
                            title="Terminer la mission"
                          >
                            <Check className="w-3 h-3" /> Terminer
                          </button>
                        )}
                        {m.statut === 'terminee' && (
                          <button
                            onClick={() => setModal({ ouvert: true, mission: m, mode: 'detail' })}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                            title="Voir le détail"
                          >
                            <Eye className="w-3 h-3" /> Détail
                          </button>
                        )}
                        {user?.role === 'admin' && ['annulee', 'planifiee'].includes(m.statut) && (
                          <button
                            onClick={() => supprimer(m.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                            title="Supprimer"
                          >
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
        titre={modal.mode === 'detail' ? `Détail — ${modal.mission?.titre}` : 'Nouvelle mission'}
        taille="max-w-2xl"
      >
        {modal.mode === 'detail' ? (
          <DetailMission mission={modal.mission} />
        ) : (
          <FormulaireMission onSauvegarder={apresCreation} onAnnuler={fermerModal} />
        )}
      </Modal>
    </div>
  );
}
