// Page gestion des chauffeurs + historique de missions
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

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

/** Retourne les initiales d'un prénom + nom */
const initiales = (prenom = '', nom = '') =>
  (prenom[0] || '') + (nom[0] || '');

/** Formulaire ajout / modification chauffeur */
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
          <input name="prenom" value={form.prenom} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Hery" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input name="nom" value={form.nom} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Rakotondrabe" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
        <input name="telephone" value={form.telephone} onChange={handleChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="+261 34 12 345 67" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">N° Permis *</label>
          <input name="numero_permis" value={form.numero_permis} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="MG-P-2020-00789" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
          <select name="categorie_permis" value={form.categorie_permis} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {['B', 'BC', 'BCE', 'C', 'D'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
        <select name="statut" value={form.statut} onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {Object.entries(LABELS_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {erreur && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠️ {erreur}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onAnnuler}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Annuler
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
          {loading ? '…' : chauffeur?.id ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
};

/** Historique des missions d'un chauffeur */
const HistoriqueMissions = ({ chauffeurId }) => {
  const [missions,   setMissions]   = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api.get(`/chauffeurs/${chauffeurId}/missions`)
      .then(({ data }) => { setMissions(data); setChargement(false); })
      .catch(() => setChargement(false));
  }, [chauffeurId]);

  if (chargement) return <div className="text-center py-6 text-gray-400">Chargement…</div>;

  if (missions.length === 0)
    return <p className="text-center text-gray-400 py-6">Aucune mission enregistrée</p>;

  const BADGES_M = {
    planifiee: 'bg-gray-100 text-gray-700',
    en_cours:  'bg-blue-100 text-blue-700',
    terminee:  'bg-green-100 text-green-700',
    annulee:   'bg-red-100 text-red-700'
  };

  return (
    <div className="space-y-3 text-sm">
      {missions.map((m) => (
        <div key={m.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-gray-800">{m.titre}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGES_M[m.statut]}`}>
              {m.statut}
            </span>
          </div>
          <p className="text-gray-500 mt-1">
            {m.immatriculation} • {m.lieu_depart} → {m.lieu_destination}
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
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

  const chargerChauffeurs = useCallback(async () => {
    setChargement(true);
    try {
      const params = search ? { search } : {};
      const { data } = await api.get('/chauffeurs', { params });
      setChauffeurs(data);
    } catch {
      setChauffeurs([]);
    } finally {
      setChargement(false);
    }
  }, [search]);

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

  const fermerModal = () => setModal({ ouvert: false, chauffeur: null, mode: 'form' });
  const apresModification = () => { fermerModal(); chargerChauffeurs(); };

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher par nom ou numéro de permis…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isAdmin && (
          <button
            onClick={() => setModal({ ouvert: true, chauffeur: null, mode: 'form' })}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 whitespace-nowrap"
          >
            + Ajouter un chauffeur
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {chargement ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : chauffeurs.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Aucun chauffeur trouvé</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['', 'Nom', 'Téléphone', 'Permis', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chauffeurs.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    {/* Avatar avec initiales */}
                    <td className="px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center
                                      text-white font-bold text-sm">
                        {initiales(c.prenom, c.nom).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.prenom} {c.nom}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.telephone}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {c.numero_permis} <span className="text-gray-400">({c.categorie_permis})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${BADGES_STATUT[c.statut]}`}>
                        {LABELS_STATUT[c.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setModal({ ouvert: true, chauffeur: c, mode: 'historique' })}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                          title="Historique des missions"
                        >
                          📋 Missions
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => setModal({ ouvert: true, chauffeur: c, mode: 'form' })}
                              className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg"
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => setConfirmSupp(c)}
                                className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg"
                                title="Supprimer"
                              >
                                🗑
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

      {/* Modal form / historique */}
      <Modal
        isOpen={modal.ouvert}
        onClose={fermerModal}
        titre={
          modal.mode === 'historique'
            ? `Missions — ${modal.chauffeur?.prenom} ${modal.chauffeur?.nom}`
            : modal.chauffeur?.id ? 'Modifier le chauffeur' : 'Ajouter un chauffeur'
        }
        taille="max-w-lg"
      >
        {modal.mode === 'historique' ? (
          <HistoriqueMissions chauffeurId={modal.chauffeur?.id} />
        ) : (
          <FormulaireChauffeur
            chauffeur={modal.chauffeur}
            onSauvegarder={apresModification}
            onAnnuler={fermerModal}
          />
        )}
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal
        isOpen={!!confirmSupp}
        onClose={() => setConfirmSupp(null)}
        titre="Confirmer la suppression"
      >
        <p className="text-gray-700 mb-4">
          Supprimer le chauffeur <strong>{confirmSupp?.prenom} {confirmSupp?.nom}</strong> ?
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmSupp(null)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={() => supprimer(confirmSupp.id)}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}
