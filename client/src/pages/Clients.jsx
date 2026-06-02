import React, { useEffect, useState, useCallback } from 'react';
import { Building2, Plus, Pencil, Trash2, AlertTriangle, X, Phone, Mail, MapPin, History, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

const TYPES = { entreprise: 'Entreprise', particulier: 'Particulier' };

const STATUT_CFG = {
  planifiee: { label: 'Planifiée',  cls: 'bg-yellow-100 text-yellow-700' },
  en_cours:  { label: 'En cours',   cls: 'bg-blue-100   text-blue-700'   },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100  text-green-700'  },
  annulee:   { label: 'Annulée',    cls: 'bg-gray-100   text-gray-500'   }
};

const FORM_VIDE = { nom: '', type: 'entreprise', contact_nom: '', telephone: '', email: '', adresse: '', ville: '', notes: '' };
const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtMontant = (n) => n != null ? `${Number(n).toLocaleString('fr-FR')} Ar` : '—';

export default function Clients() {
  const { user } = useAuth();
  const isAdmin      = user?.role === 'admin';
  const peutModifier = user?.role === 'admin' || user?.role === 'gestionnaire';
  const { confirmer, ConfirmModalComponent } = useConfirm();

  const [clients,    setClients]    = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur,     setErreur]     = useState('');
  const [modal,       setModal]       = useState(false);
  const [clientEdite, setClientEdite] = useState(null);
  const [form,        setForm]        = useState(FORM_VIDE);
  const [sauvegarde,  setSauvegarde]  = useState(false);
  const [errModal,    setErrModal]    = useState('');
  const [historique, setHistorique] = useState(null);
  const [chargemHist, setChargemHist] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await api.get('/clients');
      setClients(data); setErreur('');
    } catch {
      setErreur('Impossible de charger les clients');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => { setForm(FORM_VIDE); setClientEdite(null); setErrModal(''); setModal(true); };
  const ouvrirEdition = (c) => {
    setForm({ nom: c.nom, type: c.type, contact_nom: c.contact_nom || '', telephone: c.telephone || '',
              email: c.email || '', adresse: c.adresse || '', ville: c.ville || '', notes: c.notes || '' });
    setClientEdite(c); setErrModal(''); setModal(true);
  };
  const fermerModal = () => { setModal(false); setClientEdite(null); };

  const sauvegarder = async (e) => {
    e.preventDefault(); setSauvegarde(true); setErrModal('');
    try {
      if (clientEdite) await api.put(`/clients/${clientEdite.id}`, form);
      else await api.post('/clients', form);
      fermerModal(); charger();
    } catch (err) {
      setErrModal(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally { setSauvegarde(false); }
  };

  const supprimer = async (c) => {
    const ok = await confirmer({ type: 'supprimer', element: c.nom,
      consequences: ['Les missions liées seront détachées de ce client', 'Cette action est irréversible'] });
    if (!ok) return;
    try { await api.delete(`/clients/${c.id}`); charger(); }
    catch (err) { alert(err.response?.data?.message || 'Erreur lors de la suppression'); }
  };

  const voirHistorique = async (c) => {
    setChargemHist(true);
    try {
      const { data } = await api.get(`/clients/${c.id}/missions`);
      setHistorique(data);
    } catch {
      alert('Impossible de charger les missions de ce client');
    } finally {
      setChargemHist(false);
    }
  };

  // Vue historique
  if (historique) {
    return (
      <div className="d-flex flex-column gap-4">
        <div className="d-flex align-items-center gap-3">
          <button onClick={() => setHistorique(null)} className="btn btn-light d-flex align-items-center gap-1">
            <ArrowLeft size={20} />
          </button>
          <div className="d-flex align-items-center gap-3">
            <div className="bg-blue-100 rounded-3 p-2"><History size={24} className="text-blue-600" /></div>
            <div>
              <h1 className="fs-4 fw-bold text-dark mb-0">Missions — {historique.client.nom}</h1>
              <p className="text-muted small mb-0">{historique.missions.length} mission(s)</p>
            </div>
          </div>
        </div>

        <div className="card border rounded-3 overflow-hidden">
          {historique.missions.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <History size={48} className="mb-3 opacity-25" />
              <p>Aucune mission pour ce client</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    {['Titre', 'Camion', 'Chauffeur', 'Trajet', 'Date départ', 'Statut', 'Coût'].map(h => (
                      <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historique.missions.map(m => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 fw-medium text-dark text-truncate" style={{ maxWidth: '160px' }}>{m.titre}</td>
                      <td className="px-3 py-2 text-gray-600 font-monospace small">{m.immatriculation}</td>
                      <td className="px-3 py-2 text-gray-600">{m.chauffeur_prenom} {m.chauffeur_nom}</td>
                      <td className="px-3 py-2 text-gray-600 small">
                        {m.lieu_depart} → {m.lieu_destination}
                        <br /><span className="text-muted">{m.distance_km} km</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-nowrap">{fmtDate(m.date_depart)}</td>
                      <td className="px-3 py-2">
                        <span className={`badge rounded-pill fw-medium ${STATUT_CFG[m.statut]?.cls || ''}`}>
                          {STATUT_CFG[m.statut]?.label || m.statut}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-dark text-nowrap">{fmtMontant(m.cout_carburant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vue liste
  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-indigo-100 rounded-3 p-2"><Building2 size={24} className="text-indigo-600" /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Clients</h1>
            <p className="text-muted small mb-0">{clients.length} client(s) enregistré(s)</p>
          </div>
        </div>
        {peutModifier && (
          <button onClick={ouvrirAjout} className="btn btn-primary d-flex align-items-center gap-2">
            <Plus size={16} /> Ajouter un client
          </button>
        )}
      </div>

      {erreur && <div className="alert alert-danger d-flex align-items-center gap-2"><AlertTriangle size={20} className="flex-shrink-0" /> {erreur}</div>}

      <div className="card border rounded-3 overflow-hidden">
        {chargement ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '10rem' }}>
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <Building2 size={48} className="mb-3 opacity-25" />
            <p className="fw-medium">Aucun client enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Nom', 'Type', 'Contact', 'Téléphone', 'Ville', 'Missions', 'Actions'].map(h => (
                    <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 fw-semibold text-dark">{c.nom}</td>
                    <td className="px-3 py-2">
                      <span className={`badge rounded-pill fw-medium ${c.type === 'entreprise' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                        {TYPES[c.type]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{c.contact_nom || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {c.telephone ? <span className="d-flex align-items-center gap-1"><Phone size={12} /> {c.telephone}</span> : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {c.ville ? <span className="d-flex align-items-center gap-1"><MapPin size={12} /> {c.ville}</span> : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => voirHistorique(c)}
                              className="btn btn-link p-0 text-primary d-flex align-items-center gap-1 small fw-medium">
                        <History size={16} />
                        {c.nb_missions} mission{c.nb_missions !== 1 ? 's' : ''}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="d-flex align-items-center gap-2">
                        {peutModifier && (
                          <button onClick={() => ouvrirEdition(c)} className="btn btn-sm btn-outline-primary"><Pencil size={14} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => supprimer(c)} className="btn btn-sm btn-outline-danger"><Trash2 size={14} /></button>
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
          <div className="bg-white rounded-3 shadow-lg w-100 overflow-y-auto" style={{ maxWidth: '32rem', maxHeight: '90vh' }}>
            <div className="d-flex align-items-center justify-content-between p-4 border-bottom position-sticky top-0 bg-white" style={{ zIndex: 10 }}>
              <h2 className="fs-6 fw-bold text-dark mb-0">
                {clientEdite ? 'Modifier le client' : 'Ajouter un client'}
              </h2>
              <button onClick={fermerModal} className="btn-close" />
            </div>
            <form onSubmit={sauvegarder} className="p-4">
              {errModal && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-3">
                  <AlertTriangle size={16} className="flex-shrink-0" /> {errModal}
                </div>
              )}
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Nom *</label>
                  <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Ex : COLAS Madagascar" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="form-select form-select-sm">
                    {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label">Ville</label>
                  <input type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Antananarivo" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Nom du contact</label>
                  <input type="text" value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} placeholder="Ex : Rakoto Fils" className="form-control form-control-sm" />
                </div>
                <div className="col-6">
                  <label className="form-label">Téléphone</label>
                  <input type="text" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="034 11 111 11" className="form-control form-control-sm" />
                </div>
                <div className="col-12">
                  <label className="form-label">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@entreprise.mg" className="form-control form-control-sm" />
                </div>
                <div className="col-12">
                  <label className="form-label">Adresse</label>
                  <textarea value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} rows={2} placeholder="Adresse complète..." className="form-control form-control-sm" style={{ resize: 'none' }} />
                </div>
                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Informations complémentaires..." className="form-control form-control-sm" style={{ resize: 'none' }} />
                </div>
              </div>
              <div className="d-flex gap-3 mt-3">
                <button type="button" onClick={fermerModal} className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
                <button type="submit" disabled={sauvegarde} className="btn btn-primary btn-sm flex-grow-1">
                  {sauvegarde ? 'Enregistrement...' : clientEdite ? 'Enregistrer' : 'Ajouter'}
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
