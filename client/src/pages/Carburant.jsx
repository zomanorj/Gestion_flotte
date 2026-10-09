import { useEffect, useState } from 'react';
import { Fuel, Plus, Pencil, Trash2, AlertTriangle, X, Droplets, DollarSign, Gauge, TrendingDown } from 'lucide-react';
import api from '../services/api';
import { messageErreur } from '../requetes/client';
import { useEcriture, useParametres, usePleins, useStatsCarburant, useVehicules } from '../requetes';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { formaterDate, formaterMontant, formaterNombre } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';

const TYPES_CARBURANT = { diesel: 'Diesel', essence: 'Essence', gasoil: 'Gasoil' };

const FORM_VIDE = {
  vehicule_id: '', date_plein: '', litres: '', prix_litre: '5200',
  kilometrage_au_plein: '', consommation_reelle: '',
  station: '', ville: '', type_carburant: 'diesel', notes: ''
};



export default function Carburant() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [page,      setPage]      = useState(1);
  const LIMIT = 20;
  const [filtreVehicule, setFiltreVehicule] = useState('');
  const [filtreDebut,    setFiltreDebut]    = useState('');
  const [filtreFin,      setFiltreFin]      = useState('');
  const [modal,      setModal]      = useState(false);
  const [pleinEdite, setPleinEdite] = useState(null);
  const [form,       setForm]       = useState(FORM_VIDE);
  const [errModal,   setErrModal]   = useState('');

  const liste = usePleins({ page, limit: LIMIT, vehicule_id: filtreVehicule, debut: filtreDebut, fin: filtreFin },
                          { pagine: true });
  const { data: stats = null }   = useStatsCarburant();
  const { data: vehicules = [] } = useVehicules();
  // Prix proposé pour un nouveau plein : le prix du gasoil en vigueur (paramètres, gestion uniquement)
  const { data: parametres } = useParametres({ enabled: peutModifier });
  const prixEnVigueur = parametres?.find(p => p.cle === 'prix_litre_gasoil')?.valeur;

  const pleins     = liste.data?.data ?? [];
  const paginInfo  = { total: liste.data?.total ?? 0, pages: liste.data?.pages ?? 1 };
  const chargement = liste.isPending;
  const erreur     = liste.isError ? 'Impossible de charger les données carburant' : '';

  useEffect(() => { setPage(1); }, [filtreVehicule, filtreDebut, filtreFin]);

  const enregistrement = useEcriture('carburant', ({ id, valeurs }) =>
    id ? api.put(`/carburant/${id}`, valeurs) : api.post('/carburant', valeurs));
  const suppression = useEcriture('carburant', (id) => api.delete(`/carburant/${id}`));
  const sauvegarde = enregistrement.isPending;

  const ouvrirAjout = () => {
    setForm({ ...FORM_VIDE, prix_litre: prixEnVigueur != null ? String(prixEnVigueur) : FORM_VIDE.prix_litre });
    setPleinEdite(null); setErrModal(''); setModal('ajout');
  };
  const ouvrirEdition = (plein) => {
    setForm({
      vehicule_id: plein.vehicule_id, date_plein: plein.date_plein?.slice(0, 10) || '',
      litres: plein.litres ?? '', prix_litre: plein.prix_litre ?? '5200',
      kilometrage_au_plein: plein.kilometrage_au_plein ?? '',
      consommation_reelle: plein.consommation_reelle ?? '',
      station: plein.station || '', ville: plein.ville || '',
      type_carburant: plein.type_carburant || 'diesel', notes: plein.notes || ''
    });
    setPleinEdite(plein); setErrModal(''); setModal('edition');
  };
  const fermerModal = () => { setModal(false); setPleinEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setErrModal('');
    try {
      await enregistrement.mutateAsync({ id: modal === 'ajout' ? null : pleinEdite.id, valeurs: form });
      fermerModal();
    } catch (err) {
      setErrModal(messageErreur(err, 'Erreur lors de la sauvegarde'));
    }
  };

  const supprimer = async (plein) => {
    const ok = await confirmer({
      type: 'supprimer',
      element: `Plein du ${formaterDate(plein.date_plein)} — ${plein.immatriculation}`,
      consequences: ['Cette action est irréversible', `${plein.litres} L — ${formaterMontant(plein.cout_total)}`]
    });
    if (!ok) return;
    try { await suppression.mutateAsync(plein.id); }
    catch (err) { alert(messageErreur(err, 'Erreur lors de la suppression')); }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Carburant"
        description="Pleins effectués, consommation et coût de la flotte"
        actions={peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-primary"><Plus size={16} /> Ajouter un plein</button>
        )}
      />

      {stats && (
        <div className="row g-3">
          <div className="col-12 col-sm-6 col-xl-3">
            <StatCard titre="Dépense ce mois" valeur={formaterMontant(stats.coutMois)} icone={<TrendingDown size={16} />} />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <StatCard titre="Coût total" valeur={formaterMontant(stats.coutTotal)} icone={<DollarSign size={16} />} />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <StatCard titre="Volume total" valeur={`${formaterNombre(stats.totalLitres, 1)} L`} icone={<Droplets size={16} />} />
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <StatCard titre="Consommation moyenne" icone={<Gauge size={16} />}
                      valeur={stats.consommationMoyenne ? `${formaterNombre(stats.consommationMoyenne, 2)} L/km` : '—'} />
          </div>
        </div>
      )}

      <div className="barre-filtres">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} className="form-select" aria-label="Camion">
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque}</option>)}
        </select>
        <div className="plage-dates">
          <input type="date" value={filtreDebut} onChange={(e) => setFiltreDebut(e.target.value)} className="form-control" aria-label="Du" />
          <span className="text-muted small">au</span>
          <input type="date" value={filtreFin} onChange={(e) => setFiltreFin(e.target.value)} className="form-control" aria-label="Au" />
        </div>
        {(filtreVehicule || filtreDebut || filtreFin) && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreDebut(''); setFiltreFin(''); }} className="btn btn-link btn-sm text-muted">
            <X size={14} /> Effacer les filtres
          </button>
        )}
      </div>

      {erreur && <div className="alert alert-danger d-flex align-items-center gap-2"><AlertTriangle size={20} className="flex-shrink-0" /> {erreur}</div>}

      {/* Tableau */}
      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette />
        ) : pleins.length === 0 ? (
          <EtatVide Icone={Fuel} titre="Aucun plein enregistré"
                    description="Enregistrez chaque plein pour suivre la consommation réelle des camions." />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr><th>Date</th><th>Camion</th><th>Station</th><th className="text-end">Litres</th><th className="text-end">Prix / L</th><th className="text-end">Coût</th><th>Carburant</th><th className="col-actions"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {pleins.map((p) => (
                  <tr key={p.id}>
                    <td className="text-gray-700 text-nowrap">{formaterDate(p.date_plein)}</td>
                    <td className="text-nowrap"><span className="immatriculation">{p.immatriculation}</span> <span className="text-muted small">{p.marque}</span></td>
                    <td className="text-gray-700">{p.station || '—'}{p.ville ? <span className="text-muted"> · {p.ville}</span> : ''}</td>
                    <td className="text-end text-nowrap">{formaterNombre(p.litres, 1)} L</td>
                    <td className="text-end text-nowrap text-gray-700">{formaterMontant(p.prix_litre)}</td>
                    <td className="text-end text-nowrap fw-semibold">{formaterMontant(p.cout_total)}</td>
                    <td><span className="badge etat-neutre">{TYPES_CARBURANT[p.type_carburant] || p.type_carburant}</span></td>
                    <td className="col-actions">
                      <div className="d-flex align-items-center gap-1">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(p)} className="btn btn-icone" title="Modifier" aria-label="Modifier"><Pencil size={16} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(p)} className="btn btn-icone btn-icone-danger" title="Supprimer" aria-label="Supprimer"><Trash2 size={16} /></button>
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

      {/* Formulaire */}
      <Modal isOpen={!!modal} onClose={fermerModal} titre={modal === 'ajout' ? 'Enregistrer un plein' : 'Modifier le plein'}>
            <form onSubmit={sauvegarder} className="d-flex flex-column gap-3">
              {errModal && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
                  <AlertTriangle size={16} className="flex-shrink-0" /> {errModal}
                </div>
              )}
              <div>
                <label className="form-label">Camion *</label>
                <select value={form.vehicule_id} onChange={(e) => setForm({ ...form, vehicule_id: e.target.value })} required className="form-select form-select-sm">
                  <option value="">Sélectionner un camion</option>
                  {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
                </select>
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Date du plein *</label>
                  <input type="date" value={form.date_plein} onChange={(e) => setForm({ ...form, date_plein: e.target.value })} required className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Type de carburant</label>
                  <select value={form.type_carburant} onChange={(e) => setForm({ ...form, type_carburant: e.target.value })} className="form-select form-select-sm">
                    {Object.entries(TYPES_CARBURANT).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                </div>
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Litres *</label>
                  <input type="number" step="0.01" min="0" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} required placeholder="Ex : 120.50" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Prix/litre (Ar) *</label>
                  <input type="number" step="1" min="0" value={form.prix_litre} onChange={(e) => setForm({ ...form, prix_litre: e.target.value })} required placeholder="Ex : 5200" className="form-control form-control-sm" />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Station</label>
                  <input type="text" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} placeholder="Total, Galana..." className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Ville</label>
                  <input type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Antananarivo" className="form-control form-control-sm" />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Kilométrage au plein</label>
                  <input type="number" min="0" value={form.kilometrage_au_plein} onChange={(e) => setForm({ ...form, kilometrage_au_plein: e.target.value })} placeholder="Ex : 45320" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Conso. réelle (L/km)</label>
                  <input type="number" step="0.01" min="0" value={form.consommation_reelle} onChange={(e) => setForm({ ...form, consommation_reelle: e.target.value })} placeholder="Ex : 0.32" className="form-control form-control-sm" />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Informations complémentaires..." className="form-control form-control-sm" style={{ resize: 'none' }} />
              </div>
              <div className="modale-actions">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-primary">
                  {sauvegarde && <span className="spinner-border spinner-border-sm" role="status" />}
                  {modal === 'ajout' ? 'Ajouter' : 'Enregistrer'}
                </button>
              </div>
            </form>
      </Modal>
      <ConfirmModalComponent />
    </div>
  );
}
