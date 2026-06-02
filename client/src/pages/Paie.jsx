import React, { useState, useEffect } from 'react';
import { Wallet, Download, Pencil, AlertTriangle, Users, TrendingUp, MapPin } from 'lucide-react';
import api from '../services/api';

const MOIS_FR = ['', 'Janvier','Février','Mars','Avril','Mai','Juin',
                 'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const fmtMontant = (n) => n != null ? `${Math.round(n).toLocaleString('fr-FR')} Ar` : '—';

export default function Paie() {
  const now = new Date();
  const [annee,   setAnnee]   = useState(now.getFullYear());
  const [mois,    setMois]    = useState(now.getMonth() + 1);
  const [resume,  setResume]  = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur,  setErreur]  = useState('');

  // Modal édition salaire
  const [modalSalaire, setModalSalaire] = useState(null); // { id, nom, prenom, salaire_base, prime_mission }
  const [formSalaire,  setFormSalaire]  = useState({ salaire_base: '', prime_mission: '' });
  const [errSalaire,   setErrSalaire]   = useState('');
  const [savSalaire,   setSavSalaire]   = useState(false);

  const charger = async () => {
    setChargement(true); setErreur('');
    try {
      const { data } = await api.get(`/paie/${annee}/${mois}`);
      setResume(data);
    } catch {
      setErreur('Impossible de charger la paie');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, [annee, mois]);

  const telechargerPDF = (chauffeurId) => {
    const token = localStorage.getItem('token');
    window.open(
      `http://localhost:5000/api/paie/chauffeur/${chauffeurId}/${annee}/${mois}/pdf`,
      '_blank'
    );
  };

  const ouvrirSalaire = (fiche) => {
    setFormSalaire({ salaire_base: fiche.salaire_base || 800000, prime_mission: fiche.total_primes / Math.max(1, fiche.nb_missions) || 50000 });
    setModalSalaire({ id: fiche.chauffeur_id, nom: fiche.nom, prenom: fiche.prenom });
    setErrSalaire('');
  };

  const sauvegarderSalaire = async (e) => {
    e.preventDefault(); setSavSalaire(true); setErrSalaire('');
    try {
      await api.patch(`/paie/chauffeur/${modalSalaire.id}/salaire`, formSalaire);
      setModalSalaire(null);
      charger();
    } catch (err) {
      setErrSalaire(err.response?.data?.message || 'Erreur');
    } finally { setSavSalaire(false); }
  };

  const annees = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="d-flex flex-column gap-4">
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-emerald-100 rounded-3 p-2"><Wallet size={24} className="text-emerald-600" /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Paie des chauffeurs</h1>
            <p className="text-muted small mb-0">Bulletins de salaire mensuels</p>
          </div>
        </div>

        {/* Sélecteur mois/année */}
        <div className="d-flex align-items-center gap-2">
          <select value={mois} onChange={e => setMois(parseInt(e.target.value))} className="form-select form-select-sm" style={{ width: '130px' }}>
            {MOIS_FR.slice(1).map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} className="form-select form-select-sm" style={{ width: '90px' }}>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {erreur && <div className="alert alert-danger">{erreur}</div>}

      {/* KPIs */}
      {resume && (
        <div className="row g-3">
          <div className="col-12 col-sm-4">
            <div className="card border rounded-3">
              <div className="card-body p-3 d-flex align-items-center gap-3">
                <div className="bg-success rounded-3 p-2"><TrendingUp size={24} color="white" /></div>
                <div>
                  <p className="text-xs text-muted fw-medium text-uppercase mb-1">Masse salariale nette</p>
                  <p className="fs-5 fw-bold text-dark mb-0">{fmtMontant(resume.masse_salariale)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-sm-4">
            <div className="card border rounded-3">
              <div className="card-body p-3 d-flex align-items-center gap-3">
                <div className="bg-primary rounded-3 p-2"><Users size={24} color="white" /></div>
                <div>
                  <p className="text-xs text-muted fw-medium text-uppercase mb-1">Chauffeurs actifs</p>
                  <p className="fs-5 fw-bold text-dark mb-0">{resume.fiches.length}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-sm-4">
            <div className="card border rounded-3">
              <div className="card-body p-3 d-flex align-items-center gap-3">
                <div className="bg-warning rounded-3 p-2"><MapPin size={24} color="white" /></div>
                <div>
                  <p className="text-xs text-muted fw-medium text-uppercase mb-1">Missions ce mois</p>
                  <p className="fs-5 fw-bold text-dark mb-0">{resume.nb_missions}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="card border rounded-3 overflow-hidden">
        {chargement ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '10rem' }}>
            <div className="spinner-border text-success" role="status" />
          </div>
        ) : !resume || resume.fiches.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <Wallet size={48} className="mb-3 opacity-25" />
            <p className="fw-medium">Aucune donnée pour {MOIS_FR[mois]} {annee}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {['Chauffeur', 'Missions', 'Km parcourus', 'Salaire de base', 'Primes missions', 'Bonus km', 'Net à payer', 'Actions'].map(h => (
                    <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resume.fiches.map((f) => (
                  <tr key={f.chauffeur_id}>
                    <td className="px-3 py-2 fw-medium text-dark text-nowrap">{f.prenom} {f.nom}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`badge rounded-pill fw-medium ${f.nb_missions > 0 ? 'bg-primary' : 'bg-gray-100 text-gray-600'}`}>
                        {f.nb_missions}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{f.total_km.toLocaleString()} km</td>
                    <td className="px-3 py-2 text-gray-600">{fmtMontant(f.salaire_base)}</td>
                    <td className="px-3 py-2 text-blue-700">{fmtMontant(f.total_primes)}</td>
                    <td className="px-3 py-2 text-orange-600">{f.km_bonus > 0 ? fmtMontant(f.km_bonus) : '—'}</td>
                    <td className="px-3 py-2 fw-bold text-success text-nowrap">{fmtMontant(f.net_a_payer)}</td>
                    <td className="px-3 py-2">
                      <div className="d-flex gap-1">
                        <button onClick={() => telechargerPDF(f.chauffeur_id)}
                                className="btn btn-sm btn-outline-danger" title="Bulletin PDF">
                          <Download size={14} />
                        </button>
                        <button onClick={() => ouvrirSalaire(f)}
                                className="btn btn-sm btn-outline-secondary" title="Modifier le salaire">
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <td className="px-3 py-2 fw-bold text-dark">TOTAL</td>
                  <td className="px-3 py-2 text-center fw-bold">{resume.nb_missions}</td>
                  <td className="px-3 py-2 fw-bold">{resume.fiches.reduce((s, f) => s + f.total_km, 0).toLocaleString()} km</td>
                  <td colSpan={3} />
                  <td className="px-3 py-2 fw-bold text-success">{fmtMontant(resume.masse_salariale)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal modification salaire */}
      {modalSalaire && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
             style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3 shadow-lg p-4" style={{ maxWidth: '28rem', width: '100%' }}>
            <h3 className="fs-6 fw-bold mb-1">Modifier le salaire</h3>
            <p className="text-muted small mb-3">{modalSalaire.prenom} {modalSalaire.nom}</p>
            {errSalaire && <div className="alert alert-danger small py-2 mb-3">{errSalaire}</div>}
            <form onSubmit={sauvegarderSalaire} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label">Salaire de base mensuel (Ar)</label>
                <input type="number" min="0" value={formSalaire.salaire_base}
                       onChange={e => setFormSalaire({...formSalaire, salaire_base: e.target.value})}
                       className="form-control form-control-sm" />
              </div>
              <div>
                <label className="form-label">Prime par mission (Ar)</label>
                <input type="number" min="0" value={formSalaire.prime_mission}
                       onChange={e => setFormSalaire({...formSalaire, prime_mission: e.target.value})}
                       className="form-control form-control-sm" />
              </div>
              <p className="text-muted text-xs mb-0">
                Bonus km : +20 000 Ar par tranche de 500 km au-delà de 500 km/mois
              </p>
              <div className="d-flex gap-2">
                <button type="button" onClick={() => setModalSalaire(null)}
                        className="btn btn-outline-secondary btn-sm flex-grow-1">Annuler</button>
                <button type="submit" disabled={savSalaire}
                        className="btn btn-success btn-sm flex-grow-1">
                  {savSalaire ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
