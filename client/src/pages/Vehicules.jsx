// Page gestion des camions — CRUD + filtres + badges statut
import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Pencil, Trash2, AlertTriangle, Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

/** Configuration couleur des badges de statut */
const BADGES_STATUT = {
  disponible:  'bg-green-100 text-green-800',
  en_mission:  'bg-blue-100 text-blue-800',
  en_panne:    'bg-red-100 text-red-800',
  maintenance: 'bg-yellow-100 text-yellow-800'
};

const LABELS_STATUT = {
  disponible:  'Disponible',
  en_mission:  'En mission',
  en_panne:    'En panne',
  maintenance: 'Maintenance'
};

/** Types de camions disponibles */
const TYPES_CAMION = {
  porteur:      'Porteur',
  tracteur:     'Tracteur',
  benne:        'Benne',
  frigorifique: 'Frigorifique',
  citerne:      'Citerne'
};

/** Formate une date en français */
const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

/** Formulaire de création / modification de camion */
const FormulaireCamion = ({ camion, onSauvegarder, onAnnuler }) => {
  const [form, setForm] = useState({
    immatriculation:       camion?.immatriculation       || '',
    marque:                camion?.marque                || '',
    modele:                camion?.modele                || '',
    annee:                 camion?.annee                 || new Date().getFullYear(),
    kilometrage:           camion?.kilometrage            || 0,
    consommation_litre_km: camion?.consommation_litre_km || 0.30,
    statut:                camion?.statut                || 'disponible',
    date_derniere_vidange: camion?.date_derniere_vidange?.slice(0, 10) || '',
    date_prochain_ct:      camion?.date_prochain_ct?.slice(0, 10)      || '',
    tonnage:               camion?.tonnage               || '',
    type_camion:           camion?.type_camion           || 'porteur',
    numero_chassis:        camion?.numero_chassis        || ''
  });
  const [erreur,  setErreur]  = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErreur('');
    try {
      if (camion?.id) {
        await api.put(`/vehicules/${camion.id}`, form);
      } else {
        await api.post('/vehicules', form);
      }
      onSauvegarder();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const champInput = (name, label, type = 'text', attrs = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={name} type={type} value={form[name]}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        {...attrs}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {champInput('immatriculation', 'Immatriculation *', 'text', { placeholder: 'MAD-001-24', required: true })}

      <div className="grid grid-cols-2 gap-3">
        {champInput('marque', 'Marque *', 'text', { placeholder: 'Mercedes', required: true })}
        {champInput('modele', 'Modèle *', 'text', { placeholder: 'Actros', required: true })}
      </div>

      {/* Type de camion et tonnage */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type de camion</label>
          <select name="type_camion" value={form.type_camion} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Object.entries(TYPES_CAMION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {champInput('tonnage', 'Tonnage (T)', 'number', { min: 0, max: 100, step: 0.5, placeholder: '32.5' })}
      </div>

      {champInput('numero_chassis', 'N° Châssis (VIN)', 'text', { placeholder: 'WDB9340321L123456' })}

      <div className="grid grid-cols-2 gap-3">
        {champInput('annee', 'Année', 'number', { min: 2000, max: 2030 })}
        {champInput('kilometrage', 'Kilométrage (km)', 'number', { min: 0 })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {champInput('consommation_litre_km', 'Consommation (L/km)', 'number', { min: 0.01, max: 1, step: 0.01 })}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
          <select name="statut" value={form.statut} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Object.entries(LABELS_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {champInput('date_derniere_vidange', 'Dernière vidange', 'date')}
        {champInput('date_prochain_ct', 'Prochain CT', 'date')}
      </div>

      {erreur && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {erreur}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onAnnuler}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Annuler
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
          {loading ? '…' : camion?.id ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
};

export default function Vehicules() {
  const { user } = useAuth();
  const isAdmin  = ['admin', 'gestionnaire'].includes(user?.role);

  const [camions,    setCamions]    = useState([]);
  const [chargement, setChargement] = useState(true);
  const [search,     setSearch]     = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [modal,      setModal]      = useState({ ouvert: false, camion: null, mode: 'form' });
  const [confirmSuppression, setConfirmSuppression] = useState(null);

  const chargerCamions = useCallback(async () => {
    setChargement(true);
    try {
      const params = {};
      if (filtreStatut) params.statut = filtreStatut;
      if (search)       params.search = search;
      const { data } = await api.get('/vehicules', { params });
      setCamions(data);
    } catch {
      setCamions([]);
    } finally {
      setChargement(false);
    }
  }, [filtreStatut, search]);

  useEffect(() => { chargerCamions(); }, [chargerCamions]);

  const ouvrirFormulaire = (camion = null) =>
    setModal({ ouvert: true, camion, mode: 'form' });

  const ouvrirDetail = (camion) =>
    setModal({ ouvert: true, camion, mode: 'detail' });

  const fermerModal = () => setModal({ ouvert: false, camion: null, mode: 'form' });

  const apresModification = () => { fermerModal(); chargerCamions(); };

  const supprimer = async (id) => {
    try {
      await api.delete(`/vehicules/${id}`);
      setConfirmSuppression(null);
      chargerCamions();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher par immatriculation, marque…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {isAdmin && (
          <button
            onClick={() => ouvrirFormulaire()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Ajouter un camion
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {chargement ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : camions.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Aucun camion trouvé</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Immatriculation', 'Marque / Modèle', 'Type', 'Tonnage (T)', 'Kilométrage', 'Statut', 'Prochain CT', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {camions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.immatriculation}</td>
                    <td className="px-4 py-3 text-gray-700">{c.marque} {c.modele}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {TYPES_CAMION[c.type_camion] || c.type_camion}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.tonnage ? `${c.tonnage} T` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Intl.NumberFormat('fr-FR').format(c.kilometrage)} km
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${BADGES_STATUT[c.statut] || 'bg-gray-100 text-gray-700'}`}>
                        {LABELS_STATUT[c.statut] || c.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.date_prochain_ct)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => ouvrirDetail(c)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                          title="Voir le détail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => ouvrirFormulaire(c)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => setConfirmSuppression(c)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal formulaire / détail */}
      <Modal
        isOpen={modal.ouvert}
        onClose={fermerModal}
        titre={
          modal.mode === 'detail'
            ? `Détail — ${modal.camion?.immatriculation}`
            : modal.camion?.id ? 'Modifier le camion' : 'Ajouter un camion'
        }
        taille="max-w-xl"
      >
        {modal.mode === 'form' ? (
          <FormulaireCamion
            camion={modal.camion}
            onSauvegarder={apresModification}
            onAnnuler={fermerModal}
          />
        ) : (
          <DetailCamion camion={modal.camion} />
        )}
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal
        isOpen={!!confirmSuppression}
        onClose={() => setConfirmSuppression(null)}
        titre="Confirmer la suppression"
      >
        <p className="text-gray-700 mb-4">
          Supprimer le camion <strong>{confirmSuppression?.immatriculation}</strong> ?
          Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmSuppression(null)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={() => supprimer(confirmSuppression.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** Affichage détaillé d'un camion (missions + maintenances) */
function DetailCamion({ camion }) {
  const [detail,     setDetail]     = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!camion?.id) return;
    api.get(`/vehicules/${camion.id}`)
      .then(({ data }) => { setDetail(data); setChargement(false); })
      .catch(() => setChargement(false));
  }, [camion]);

  if (chargement) return <div className="text-center py-8 text-gray-400">Chargement…</div>;
  if (!detail)    return <div className="text-center py-8 text-red-400">Erreur de chargement</div>;

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2 text-gray-600">
        <span><strong>Marque :</strong> {detail.marque}</span>
        <span><strong>Modèle :</strong> {detail.modele}</span>
        <span><strong>Année :</strong> {detail.annee}</span>
        <span><strong>Km :</strong> {new Intl.NumberFormat('fr-FR').format(detail.kilometrage)}</span>
        <span><strong>Type :</strong> {TYPES_CAMION[detail.type_camion] || detail.type_camion}</span>
        <span><strong>Tonnage :</strong> {detail.tonnage ? `${detail.tonnage} T` : '—'}</span>
        <span><strong>Conso :</strong> {detail.consommation_litre_km} L/km</span>
        <span><strong>Statut :</strong> {LABELS_STATUT[detail.statut]}</span>
        {detail.numero_chassis && (
          <span className="col-span-2"><strong>Châssis :</strong> <span className="font-mono">{detail.numero_chassis}</span></span>
        )}
      </div>

      {detail.missions?.length > 0 && (
        <>
          <h4 className="font-semibold text-gray-800 border-t pt-3">5 dernières missions</h4>
          {detail.missions.map((m) => (
            <div key={m.id} className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium">{m.titre}</p>
              <p className="text-gray-500">{m.lieu_depart} → {m.lieu_destination} — {m.distance_km} km</p>
            </div>
          ))}
        </>
      )}

      {detail.maintenances?.length > 0 && (
        <>
          <h4 className="font-semibold text-gray-800 border-t pt-3">Maintenances</h4>
          {detail.maintenances.map((m) => (
            <div key={m.id} className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium">{m.type} — {new Intl.NumberFormat('fr-FR').format(m.cout)} Ar</p>
              <p className="text-gray-500">{new Date(m.date_maintenance).toLocaleDateString('fr-FR')}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
