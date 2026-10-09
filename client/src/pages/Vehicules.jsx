import { useState, useEffect } from 'react';
import { Eye, Pencil, Trash2, AlertTriangle, Plus, Truck } from 'lucide-react';
import api from '../services/api';
import { messageErreur } from '../requetes/client';
import { useEcriture, useVehicule, useVehicules } from '../requetes';
import { useDiffere } from '../hooks/useDiffere';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';
import ChampRecherche from '../components/ui/ChampRecherche';
import Trajet from '../components/ui/Trajet';
import { LignesSquelette } from '../components/ui/Squelette';
import { formaterDate, formaterKm, formaterMontant } from '../utils/format';

const BADGES_STATUT = {
  disponible:  'etat-succes',
  en_mission:  'etat-actif',
  en_panne:    'etat-danger',
  maintenance: 'etat-attention'
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
  const enregistrer = useEcriture('vehicules', (valeurs) =>
    camion?.id ? api.put(`/vehicules/${camion.id}`, valeurs) : api.post('/vehicules', valeurs));
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

      <div className="modale-actions">
        <button type="button" onClick={onAnnuler} className="btn btn-outline-secondary">Annuler</button>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading && <span className="spinner-border spinner-border-sm" role="status" />}
          {camion?.id ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
};

export default function Vehicules() {
  const { user } = useAuth();
  const isAdmin  = ['admin', 'gestionnaire'].includes(user?.role);

  const [search,     setSearch]     = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [modal,      setModal]      = useState({ ouvert: false, camion: null, mode: 'form' });
  const [confirmSuppression, setConfirmSuppression] = useState(null);
  const [page,       setPage]       = useState(1);
  const LIMIT = 15;

  const recherche = useDiffere(search);
  const { data, isPending: chargement } = useVehicules(
    { page, limit: LIMIT, statut: filtreStatut, search: recherche }, { pagine: true });
  const camions   = data?.data ?? [];
  const paginInfo = { total: data?.total ?? 0, pages: data?.pages ?? 1 };

  useEffect(() => { setPage(1); }, [filtreStatut, recherche]);

  const suppression = useEcriture('vehicules', (id) => api.delete(`/vehicules/${id}`));

  const ouvrirFormulaire = (camion = null) => setModal({ ouvert: true, camion, mode: 'form' });
  const ouvrirDetail     = (camion)         => setModal({ ouvert: true, camion, mode: 'detail' });
  const fermerModal      = ()               => setModal({ ouvert: false, camion: null, mode: 'form' });
  const apresModification = ()              => fermerModal();

  const supprimer = async (id) => {
    try {
      await suppression.mutateAsync(id);
      setConfirmSuppression(null);
    } catch (err) {
      alert(messageErreur(err, 'Erreur lors de la suppression'));
    }
  };

  const filtre = Boolean(recherche || filtreStatut);

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Véhicules"
        description={chargement ? 'Chargement…' : `${paginInfo.total} camion(s) ${filtre ? 'correspondant aux filtres' : 'dans la flotte'}`}
        actions={isAdmin && (
          <button onClick={() => ouvrirFormulaire()} className="btn btn-primary"><Plus size={16} /> Ajouter un camion</button>
        )}
      />

      <div className="barre-filtres">
        <ChampRecherche valeur={search} onChange={setSearch} placeholder="Rechercher par immatriculation, marque…" />
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="form-select" aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette colonnes={7} />
        ) : camions.length === 0 ? (
          <EtatVide Icone={Truck} titre={filtre ? 'Aucun camion trouvé' : 'Aucun camion enregistré'}
                    description={filtre ? 'Modifiez la recherche ou le statut.' : 'Ajoutez un premier camion pour planifier des missions.'} />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Immatriculation</th><th>Marque / modèle</th><th>Type</th>
                  <th className="text-end">Tonnage</th><th className="text-end">Kilométrage</th>
                  <th>Statut</th><th>Prochain CT</th><th className="col-actions"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {camions.map((c) => (
                  <tr key={c.id}>
                    <td className="immatriculation fw-medium">{c.immatriculation}</td>
                    <td>{c.marque} <span className="text-muted">{c.modele}</span></td>
                    <td className="text-gray-700">{TYPES_CAMION[c.type_camion] || c.type_camion}</td>
                    <td className="text-end">{c.tonnage ? `${c.tonnage} T` : '—'}</td>
                    <td className="text-end text-nowrap">{formaterKm(c.kilometrage)}</td>
                    <td>
                      <span className={`badge ${BADGES_STATUT[c.statut] || 'etat-neutre'}`}>
                        {LABELS_STATUT[c.statut] || c.statut}
                      </span>
                    </td>
                    <td className="text-nowrap text-gray-700">{formaterDate(c.date_prochain_ct)}</td>
                    <td className="col-actions">
                      <div className="d-flex gap-1">
                        <button onClick={() => ouvrirDetail(c)} className="btn btn-icone" title="Voir le détail" aria-label="Voir le détail"><Eye size={16} /></button>
                        {isAdmin && (
                          <button onClick={() => ouvrirFormulaire(c)} className="btn btn-icone" title="Modifier" aria-label="Modifier"><Pencil size={16} /></button>
                        )}
                        {user?.role === 'admin' && (
                          <button onClick={() => setConfirmSuppression(c)} className="btn btn-icone btn-icone-danger" title="Supprimer" aria-label="Supprimer"><Trash2 size={16} /></button>
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

      {/* Modal formulaire / détail */}
      <Modal isOpen={modal.ouvert} onClose={fermerModal}
             titre={modal.mode === 'detail' ? modal.camion?.immatriculation : modal.camion?.id ? 'Modifier le camion' : 'Ajouter un camion'}
             description={modal.mode === 'detail' ? `${modal.camion?.marque} ${modal.camion?.modele}` : undefined}
             taille="lg">
        {modal.mode === 'form' ? (
          <FormulaireCamion camion={modal.camion} onSauvegarder={apresModification} onAnnuler={fermerModal} />
        ) : (
          <DetailCamion camion={modal.camion} />
        )}
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal isOpen={!!confirmSuppression} onClose={() => setConfirmSuppression(null)} titre="Supprimer ce camion ?" taille="sm"
             pied={<>
               <button onClick={() => setConfirmSuppression(null)} className="btn btn-outline-secondary">Annuler</button>
               <button onClick={() => supprimer(confirmSuppression.id)} className="btn btn-danger"><Trash2 size={16} /> Supprimer</button>
             </>}>
        <p className="text-gray-700 mb-0">
          Le camion <strong>{confirmSuppression?.immatriculation}</strong> et son historique seront supprimés. Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
}

function DetailCamion({ camion }) {
  const { data: detail, isPending: chargement } = useVehicule(camion?.id);

  if (chargement) return <LignesSquelette colonnes={2} lignes={4} />;
  if (!detail)    return <p className="text-danger mb-0">Impossible de charger le camion.</p>;

  const champs = [
    ['Type', TYPES_CAMION[detail.type_camion] || detail.type_camion],
    ['Année', detail.annee],
    ['Kilométrage', formaterKm(detail.kilometrage)],
    ['Tonnage', detail.tonnage ? `${detail.tonnage} T` : '—'],
    ['Consommation', `${detail.consommation_litre_km} L/km`],
    ['Statut', <span key="s" className={`badge ${BADGES_STATUT[detail.statut] || 'etat-neutre'}`}>{LABELS_STATUT[detail.statut]}</span>],
    ['Dernière vidange', formaterDate(detail.date_derniere_vidange)],
    ['Prochain CT', formaterDate(detail.date_prochain_ct)],
  ];

  return (
    <div>
      <dl className="grille-details">
        {champs.map(([libelle, valeur]) => (
          <div key={libelle}><dt>{libelle}</dt><dd>{valeur}</dd></div>
        ))}
        {detail.numero_chassis && (
          <div style={{ gridColumn: '1 / -1' }}><dt>Châssis</dt><dd className="immatriculation">{detail.numero_chassis}</dd></div>
        )}
      </dl>

      {detail.missions?.length > 0 && (
        <>
          <p className="titre-bloc">Dernières missions</p>
          {detail.missions.map((m) => (
            <div key={m.id} className="element-liste">
              <p className="fw-medium mb-1">{m.titre}</p>
              <p className="text-muted small mb-0">
                <Trajet depart={m.lieu_depart} destination={m.lieu_destination} /> · {formaterKm(m.distance_km, 1)}
              </p>
            </div>
          ))}
        </>
      )}

      {detail.maintenances?.length > 0 && (
        <>
          <p className="titre-bloc">Maintenances</p>
          {detail.maintenances.map((m) => (
            <div key={m.id} className="element-liste d-flex justify-content-between gap-3">
              <span className="fw-medium">{m.type}</span>
              <span className="text-muted small">{formaterDate(m.date_maintenance)} · {formaterMontant(m.cout)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
