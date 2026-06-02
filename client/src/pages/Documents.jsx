import React, { useEffect, useState, useCallback } from 'react';
import { FileCheck, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

const TYPES = {
  carte_grise: 'Carte grise', assurance: 'Assurance', vignette: 'Vignette',
  visite_technique: 'Visite technique', autorisation_transport: 'Autorisation transport'
};

const STATUT_CONFIG = {
  valide:         { label: 'Valide',         bg: 'bg-green-100', text: 'text-green-700',  Icon: CheckCircle2 },
  expire_bientot: { label: 'Expire bientôt', bg: 'bg-orange-100', text: 'text-orange-700', Icon: Clock },
  expire:         { label: 'Expiré',         bg: 'bg-red-100',   text: 'text-red-700',    Icon: AlertTriangle }
};

const FORM_VIDE = { vehicule_id: '', type: 'carte_grise', numero: '', date_emission: '', date_expiration: '', notes: '' };
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const StatutBadge = ({ statut }) => {
  const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG.valide;
  return (
    <span className={`badge rounded-pill d-inline-flex align-items-center gap-1 fw-medium ${cfg.bg} ${cfg.text}`}>
      <cfg.Icon size={12} /> {cfg.label}
    </span>
  );
};

export default function Documents() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [docs,      setDocs]      = useState([]);
  const [alertes,   setAlertes]   = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur,    setErreur]    = useState('');
  const [filtreVehicule, setFiltreVehicule] = useState('');
  const [filtreType,     setFiltreType]     = useState('');
  const [modal,     setModal]     = useState(false);
  const [docEdite,  setDocEdite]  = useState(null);
  const [form,      setForm]      = useState(FORM_VIDE);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [errModal,  setErrModal]  = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = {};
      if (filtreVehicule) params.vehicule_id = filtreVehicule;
      if (filtreType)     params.type        = filtreType;
      const [resDocs, resAlertes, resVehicules] = await Promise.all([
        api.get('/documents', { params }),
        api.get('/documents/alertes'),
        api.get('/vehicules')
      ]);
      setDocs(resDocs.data); setAlertes(resAlertes.data); setVehicules(resVehicules.data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les documents');
    } finally {
      setChargement(false);
    }
  }, [filtreVehicule, filtreType]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => { setForm(FORM_VIDE); setDocEdite(null); setErrModal(''); setModal('ajout'); };
  const ouvrirEdition = (doc) => {
    setForm({ vehicule_id: doc.vehicule_id, type: doc.type, numero: doc.numero || '',
              date_emission: doc.date_emission?.slice(0, 10) || '',
              date_expiration: doc.date_expiration?.slice(0, 10) || '', notes: doc.notes || '' });
    setDocEdite(doc); setErrModal(''); setModal('edition');
  };
  const fermerModal = () => { setModal(false); setDocEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setSauvegarde(true); setErrModal('');
    try {
      if (modal === 'ajout') await api.post('/documents', form);
      else await api.put(`/documents/${docEdite.id}`, form);
      fermerModal(); charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally { setSauvegarde(false); }
  };

  const supprimer = async (doc) => {
    const ok = await confirmer({ type: 'supprimer', element: `${TYPES[doc.type]} — ${doc.immatriculation}`,
      consequences: ['Le document sera définitivement supprimé', 'Cette action est irréversible'] });
    if (!ok) return;
    try { await api.delete(`/documents/${doc.id}`); charger(); }
    catch (err) { alert(err.response?.data?.message || 'Erreur lors de la suppression'); }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-blue-100 rounded-3 p-2"><FileCheck size={24} className="text-blue-600" /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Documents</h1>
            <p className="text-muted small mb-0">{docs.length} document(s) enregistré(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-primary d-flex align-items-center gap-2">
            <Plus size={16} /> Ajouter un document
          </button>
        )}
      </div>

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="alert alert-danger rounded-3">
          <h3 className="d-flex align-items-center gap-2 fw-semibold fs-6 mb-3">
            <AlertTriangle size={20} />
            {alertes.length} document(s) nécessitant une attention
          </h3>
          <div className="row g-3">
            {alertes.map((a) => (
              <div key={a.id} className="col-12 col-sm-6 col-xl-4">
                <div className={`rounded-3 p-3 border ${a.statut === 'expire' ? 'bg-red-100 border-red-300' : 'bg-orange-50 border-orange-200'}`}>
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div>
                      <p className={`fw-semibold small mb-0 ${a.statut === 'expire' ? 'text-red-800' : 'text-orange-800'}`}>{TYPES[a.type]}</p>
                      <p className="text-muted text-xs mt-1 mb-0">{a.immatriculation} — {a.marque}</p>
                    </div>
                    <StatutBadge statut={a.statut} />
                  </div>
                  <p className={`text-xs mt-2 fw-medium mb-0 ${a.statut === 'expire' ? 'text-red-700' : 'text-orange-700'}`}>
                    {a.jours_restants < 0 ? `Expiré depuis ${Math.abs(a.jours_restants)} jour(s)` : `Expire dans ${a.jours_restants} jour(s)`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="d-flex flex-wrap gap-3 align-items-center bg-white border rounded-3 p-3">
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Tous les camions</option>
          {vehicules.map((v) => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
        </select>
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className="form-select" style={{ width: 'auto' }}>
          <option value="">Tous les types</option>
          {Object.entries(TYPES).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        {(filtreVehicule || filtreType) && (
          <button onClick={() => { setFiltreVehicule(''); setFiltreType(''); }}
                  className="btn btn-link text-muted p-0 d-flex align-items-center gap-1 small">
            <X size={16} /> Effacer
          </button>
        )}
      </div>

      {erreur && <div className="alert alert-danger d-flex align-items-center gap-2"><AlertTriangle size={20} className="flex-shrink-0" /> {erreur}</div>}

      {/* Tableau */}
      <div className="card border rounded-3 overflow-hidden">
        {chargement ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '10rem' }}>
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <FileCheck size={48} className="mb-3 opacity-25" />
            <p className="fw-medium">Aucun document trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Type', 'Numéro', 'Camion', 'Émission', 'Expiration', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-3 py-2 fw-medium text-dark text-nowrap">{TYPES[doc.type]}</td>
                    <td className="px-3 py-2 text-gray-600">{doc.numero || '—'}</td>
                    <td className="px-3 py-2 text-nowrap">
                      <span className="fw-medium text-dark">{doc.immatriculation}</span>
                      <span className="text-muted small ms-1">{doc.marque}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-nowrap">{fmtDate(doc.date_emission)}</td>
                    <td className="px-3 py-2 text-gray-600 text-nowrap">{fmtDate(doc.date_expiration)}</td>
                    <td className="px-3 py-2"><StatutBadge statut={doc.statut} /></td>
                    <td className="px-3 py-2">
                      <div className="d-flex align-items-center gap-2">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(doc)} className="btn btn-sm btn-outline-primary"><Pencil size={14} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(doc)} className="btn btn-sm btn-outline-danger"><Trash2 size={14} /></button>
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
      {modal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
             style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3 shadow-lg w-100" style={{ maxWidth: '32rem' }}>
            <div className="d-flex align-items-center justify-content-between p-4 border-bottom">
              <h2 className="fs-6 fw-bold text-dark mb-0">
                {modal === 'ajout' ? 'Ajouter un document' : 'Modifier le document'}
              </h2>
              <button onClick={fermerModal} className="btn-close" />
            </div>
            <form onSubmit={sauvegarder} className="p-4 d-flex flex-column gap-3">
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
              <div>
                <label className="form-label">Type de document *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required className="form-select form-select-sm">
                  {Object.entries(TYPES).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Numéro du document</label>
                <input type="text" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })}
                       placeholder="Ex : ASS-2025-001" className="form-control form-control-sm" />
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Date d'émission *</label>
                  <input type="date" value={form.date_emission} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} required className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Date d'expiration *</label>
                  <input type="date" value={form.date_expiration} onChange={(e) => setForm({ ...form, date_expiration: e.target.value })} required className="form-control form-control-sm" />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          rows={2} placeholder="Informations complémentaires..."
                          className="form-control form-control-sm" style={{ resize: 'none' }} />
              </div>
              <div className="d-flex gap-3 pt-1">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-primary btn-sm flex-grow-1">
                  {sauvegarde ? 'Enregistrement...' : modal === 'ajout' ? 'Ajouter' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModalComponent />
    </div>
  );
}
