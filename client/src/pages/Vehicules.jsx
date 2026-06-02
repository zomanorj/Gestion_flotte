import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Pencil, Trash2, AlertTriangle, Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const BADGES_STATUT = {
  disponible:  'bg-green-100 text-green-800',
  en_mission:  'bg-blue-100 text-blue-800',
  en_panne:    'bg-red-100 text-red-800',
  maintenance: 'bg-yellow-100 text-yellow-700'
};

const LABELS_STATUT = {
  disponible:  'Disponible',
  en_mission:  'En mission',
  en_panne:    'En panne',
  maintenance: 'Maintenance'
};

const TYPES_CAMION = {
  porteur: 'Porteur', tracteur: 'Tracteur', benne: 'Benne',
  frigorifique: 'Frigorifique', citerne: 'Citerne'
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

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
      <label className="form-label">{label}</label>
      <input name={name} type={type} value={form[name]} onChange={handleChange}
             className="form-control form-control-sm" {...attrs} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
      {champInput('immatriculation', 'Immatriculation *', 'text', { placeholder: 'MAD-001-24', required: true })}

      <div className="row g-3">
        <div className="col-6">{champInput('marque', 'Marque *', 'text', { placeholder: 'Mercedes', required: true })}</div>
        <div className="col-6">{champInput('modele', 'Modèle *', 'text', { placeholder: 'Actros', required: true })}</div>
      </div>

      <div className="row g-3">
        <div className="col-6">
          <label className="form-label">Type de camion</label>
          <select name="type_camion" value={form.type_camion} onChange={handleChange} className="form-select form-select-sm">
            {Object.entries(TYPES_CAMION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="col-6">{champInput('tonnage', 'Tonnage (T)', 'number', { min: 0, max: 100, step: 0.5, placeholder: '32.5' })}</div>
      </div>

      {champInput('numero_chassis', 'N° Châssis (VIN)', 'text', { placeholder: 'WDB9340321L123456' })}

      <div className="row g-3">
        <div className="col-6">{champInput('annee', 'Année', 'number', { min: 2000, max: 2030 })}</div>
        <div className="col-6">{champInput('kilometrage', 'Kilométrage (km)', 'number', { min: 0 })}</div>
      </div>

      <div className="row g-3">
        <div className="col-6">{champInput('consommation_litre_km', 'Consommation (L/km)', 'number', { min: 0.01, max: 1, step: 0.01 })}</div>
        <div className="col-6">
          <label className="form-label">Statut</label>
          <select name="statut" value={form.statut} onChange={handleChange} className="form-select form-select-sm">
            {Object.entries(LABELS_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-6">{champInput('date_derniere_vidange', 'Dernière vidange', 'date')}</div>
        <div className="col-6">{champInput('date_prochain_ct', 'Prochain CT', 'date')}</div>
      </div>

      {erreur && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
          <AlertTriangle size={16} className="flex-shrink-0" /> {erreur}
        </div>
      )}

      <div className="d-flex gap-3 pt-1">
        <button type="button" onClick={onAnnuler} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm flex-grow-1">
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

  const ouvrirFormulaire = (camion = null) => setModal({ ouvert: true, camion, mode: 'form' });
  const ouvrirDetail     = (camion)         => setModal({ ouvert: true, camion, mode: 'detail' });
  const fermerModal      = ()               => setModal({ ouvert: false, camion: null, mode: 'form' });
  const apresModification = ()              => { fermerModal(); chargerCamions(); };

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
    <div className="d-flex flex-column gap-3">
      {/* Barre d'outils */}
      <div className="d-flex flex-column flex-sm-row gap-2">
        <input type="text" placeholder="Rechercher par immatriculation, marque…"
               value={search} onChange={(e) => setSearch(e.target.value)}
               className="form-control flex-grow-1" />
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {isAdmin && (
          <button onClick={() => ouvrirFormulaire()}
                  className="btn btn-primary d-flex align-items-center gap-2 text-nowrap">
            <Plus size={16} /> Ajouter un camion
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="card border rounded-3 overflow-hidden">
        {chargement ? (
          <div className="d-flex align-items-center justify-content-center" style={{ height: '8rem' }}>
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : camions.length === 0 ? (
          <p className="text-center text-muted py-5">Aucun camion trouvé</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Immatriculation', 'Marque / Modèle', 'Type', 'Tonnage (T)', 'Kilométrage', 'Statut', 'Prochain CT', 'Actions'].map((h) => (
                    <th key={h} className="text-uppercase small fw-semibold text-muted text-nowrap px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {camions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-monospace fw-medium text-dark">{c.immatriculation}</td>
                    <td className="px-3 py-2 text-gray-700">{c.marque} {c.modele}</td>
                    <td className="px-3 py-2 text-gray-600 text-capitalize">{TYPES_CAMION[c.type_camion] || c.type_camion}</td>
                    <td className="px-3 py-2 text-gray-600">{c.tonnage ? `${c.tonnage} T` : '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{new Intl.NumberFormat('fr-FR').format(c.kilometrage)} km</td>
                    <td className="px-3 py-2">
                      <span className={`badge rounded-pill small fw-medium ${BADGES_STATUT[c.statut] || 'bg-gray-100 text-gray-700'}`}>
                        {LABELS_STATUT[c.statut] || c.statut}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-nowrap">{formatDate(c.date_prochain_ct)}</td>
                    <td className="px-3 py-2">
                      <div className="d-flex gap-1">
                        <button onClick={() => ouvrirDetail(c)} className="btn btn-sm btn-light" title="Voir le détail">
                          <Eye size={14} />
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => ouvrirFormulaire(c)} className="btn btn-sm btn-outline-primary" title="Modifier">
                              <Pencil size={14} />
                            </button>
                            {user?.role === 'admin' && (
                              <button onClick={() => setConfirmSuppression(c)} className="btn btn-sm btn-outline-danger" title="Supprimer">
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

      {/* Modal formulaire / détail */}
      <Modal isOpen={modal.ouvert} onClose={fermerModal}
             titre={modal.mode === 'detail' ? `Détail — ${modal.camion?.immatriculation}` : modal.camion?.id ? 'Modifier le camion' : 'Ajouter un camion'}
             taille="max-w-xl">
        {modal.mode === 'form' ? (
          <FormulaireCamion camion={modal.camion} onSauvegarder={apresModification} onAnnuler={fermerModal} />
        ) : (
          <DetailCamion camion={modal.camion} />
        )}
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal isOpen={!!confirmSuppression} onClose={() => setConfirmSuppression(null)} titre="Confirmer la suppression">
        <p className="text-gray-700 mb-4">
          Supprimer le camion <strong>{confirmSuppression?.immatriculation}</strong> ? Cette action est irréversible.
        </p>
        <div className="d-flex gap-3">
          <button onClick={() => setConfirmSuppression(null)} className="btn btn-outline-secondary flex-grow-1">Annuler</button>
          <button onClick={() => supprimer(confirmSuppression.id)}
                  className="btn btn-danger flex-grow-1 d-flex align-items-center justify-content-center gap-2">
            <Trash2 size={16} /> Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}

function DetailCamion({ camion }) {
  const [detail,     setDetail]     = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!camion?.id) return;
    api.get(`/vehicules/${camion.id}`)
      .then(({ data }) => { setDetail(data); setChargement(false); })
      .catch(() => setChargement(false));
  }, [camion]);

  if (chargement) return <div className="text-center py-4 text-muted">Chargement…</div>;
  if (!detail)    return <div className="text-center py-4 text-danger">Erreur de chargement</div>;

  return (
    <div className="d-flex flex-column gap-3 small">
      <div className="row g-2 text-gray-600">
        <div className="col-6"><strong>Marque :</strong> {detail.marque}</div>
        <div className="col-6"><strong>Modèle :</strong> {detail.modele}</div>
        <div className="col-6"><strong>Année :</strong> {detail.annee}</div>
        <div className="col-6"><strong>Km :</strong> {new Intl.NumberFormat('fr-FR').format(detail.kilometrage)}</div>
        <div className="col-6"><strong>Type :</strong> {TYPES_CAMION[detail.type_camion] || detail.type_camion}</div>
        <div className="col-6"><strong>Tonnage :</strong> {detail.tonnage ? `${detail.tonnage} T` : '—'}</div>
        <div className="col-6"><strong>Conso :</strong> {detail.consommation_litre_km} L/km</div>
        <div className="col-6"><strong>Statut :</strong> {LABELS_STATUT[detail.statut]}</div>
        {detail.numero_chassis && (
          <div className="col-12"><strong>Châssis :</strong> <span className="font-monospace">{detail.numero_chassis}</span></div>
        )}
      </div>

      {detail.missions?.length > 0 && (
        <>
          <h4 className="fw-semibold text-dark border-top pt-3 fs-6">5 dernières missions</h4>
          <div className="d-flex flex-column gap-2">
            {detail.missions.map((m) => (
              <div key={m.id} className="bg-light rounded-2 p-2">
                <p className="fw-medium mb-1">{m.titre}</p>
                <p className="text-muted mb-0">{m.lieu_depart} → {m.lieu_destination} — {m.distance_km} km</p>
              </div>
            ))}
          </div>
        </>
      )}

      {detail.maintenances?.length > 0 && (
        <>
          <h4 className="fw-semibold text-dark border-top pt-3 fs-6">Maintenances</h4>
          <div className="d-flex flex-column gap-2">
            {detail.maintenances.map((m) => (
              <div key={m.id} className="bg-light rounded-2 p-2">
                <p className="fw-medium mb-1">{m.type} — {new Intl.NumberFormat('fr-FR').format(m.cout)} Ar</p>
                <p className="text-muted mb-0">{new Date(m.date_maintenance).toLocaleDateString('fr-FR')}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
