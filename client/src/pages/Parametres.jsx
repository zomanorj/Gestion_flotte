import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Save, RotateCcw, History, AlertTriangle, Lock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

// Ordre d'affichage des catégories renvoyées par l'API
const CATEGORIES = ['Missions', 'Paie', 'Alertes'];

const fmtNombre = (n) => new Intl.NumberFormat('fr-FR').format(n);
const fmtDateHeure = (d) => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';

export default function Parametres() {
  const { user } = useAuth();
  const estAdmin = user?.role === 'admin';
  const { ajouterToast, ToastContainer } = useToast();

  const [parametres,  setParametres]  = useState([]);
  const [saisies,     setSaisies]     = useState({}); // { cle: texte saisi } pour les champs modifiés
  const [chargement,  setChargement]  = useState(true);
  const [erreur,      setErreur]      = useState('');
  const [sauvegarde,  setSauvegarde]  = useState(false);
  const [historique,  setHistorique]  = useState(null); // null : pas encore chargé

  const appliquer = (liste) => { setParametres(liste); setSaisies({}); };

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await api.get('/parametres');
      appliquer(data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les paramètres');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const chargerHistorique = async () => {
    try {
      const { data } = await api.get('/parametres/historique');
      setHistorique(data);
    } catch {
      ajouterToast('Erreur', "Impossible de charger l'historique", true);
    }
  };

  // Champs dont la saisie diffère de la valeur en vigueur
  const modifications = Object.fromEntries(
    Object.entries(saisies)
      .filter(([cle, texte]) => texte !== '' && Number(texte) !== parametres.find(p => p.cle === cle)?.valeur)
      .map(([cle, texte]) => [cle, Number(texte)])
  );
  const nbModifications = Object.keys(modifications).length;

  const enregistrer = async () => {
    setSauvegarde(true);
    try {
      const { data } = await api.put('/parametres', { valeurs: modifications });
      appliquer(data);
      ajouterToast('Paramètres enregistrés', `${nbModifications} valeur(s) modifiée(s)`);
      if (historique) chargerHistorique();
    } catch (err) {
      ajouterToast('Enregistrement refusé', err.response?.data?.message || 'Erreur', true);
    } finally {
      setSauvegarde(false);
    }
  };

  const reinitialiser = async (p) => {
    try {
      const { data } = await api.delete(`/parametres/${p.cle}`);
      appliquer(data);
      ajouterToast('Valeur par défaut rétablie', `${p.libelle} : ${fmtNombre(p.defaut)} ${p.unite}`);
      if (historique) chargerHistorique();
    } catch (err) {
      ajouterToast('Erreur', err.response?.data?.message || 'Erreur', true);
    }
  };

  const libelle = (cle) => parametres.find(p => p.cle === cle)?.libelle || cle;

  return (
    <div className="d-flex flex-column gap-4">
      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-blue-100 rounded-3 p-2"><SlidersHorizontal size={24} className="text-blue-600" /></div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Paramètres métier</h1>
            <p className="text-muted small mb-0">Prix, barème de paie et seuils d'alerte utilisés par les calculs</p>
          </div>
        </div>
        {estAdmin && (
          <button onClick={enregistrer} disabled={!nbModifications || sauvegarde}
                  className="btn btn-primary d-flex align-items-center gap-2">
            <Save size={16} />
            {sauvegarde ? 'Enregistrement…' : `Enregistrer${nbModifications ? ` (${nbModifications})` : ''}`}
          </button>
        )}
      </div>

      {!estAdmin && (
        <div className="alert alert-info d-flex align-items-center gap-2 py-2 small mb-0">
          <Lock size={16} className="flex-shrink-0" /> Consultation seule : seul un administrateur peut modifier ces valeurs.
        </div>
      )}
      {estAdmin && (
        <div className="alert alert-warning d-flex align-items-center gap-2 py-2 small mb-0">
          <AlertTriangle size={16} className="flex-shrink-0" />
          Les nouvelles valeurs s'appliquent immédiatement aux calculs, y compris à la paie des mois déjà écoulés.
        </div>
      )}
      {erreur && <div className="alert alert-danger">{erreur}</div>}

      {chargement ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '8rem' }}>
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : CATEGORIES.map(categorie => (
        <div key={categorie} className="card border rounded-3 overflow-hidden">
          <div className="card-header bg-light fw-semibold">{categorie}</div>
          <ul className="list-group list-group-flush">
            {parametres.filter(p => p.categorie === categorie).map(p => {
              const saisie = saisies[p.cle] ?? String(p.valeur);
              const modifie = p.cle in modifications;
              return (
                <li key={p.cle} className={`list-group-item py-3 ${modifie ? 'bg-yellow-50' : ''}`}>
                  <div className="row g-3 align-items-center">
                    <div className="col-md-6">
                      <div className="fw-medium text-dark d-flex align-items-center gap-2 flex-wrap">
                        {p.libelle}
                        {p.personnalise && <span className="badge bg-blue-100 text-blue-700 fw-normal">Personnalisé</span>}
                      </div>
                      <div className="text-muted small">{p.description}</div>
                      {p.personnalise && (
                        <div className="text-muted small mt-1">
                          Modifié{p.modifie_par_nom ? ` par ${p.modifie_par_nom}` : ''} le {fmtDateHeure(p.modifie_le)}
                          {' '}— par défaut : {fmtNombre(p.defaut)} {p.unite}
                        </div>
                      )}
                    </div>
                    <div className="col-md-4">
                      <div className="input-group input-group-sm">
                        <input type="number" className="form-control" value={saisie}
                               min={p.minimum} max={p.maximum} step={p.type === 'entier' ? 1 : 'any'}
                               disabled={!estAdmin} aria-label={p.libelle}
                               onChange={e => setSaisies(s => ({ ...s, [p.cle]: e.target.value }))} />
                        <span className="input-group-text">{p.unite}</span>
                      </div>
                      <div className="text-muted small mt-1">
                        Entre {fmtNombre(p.minimum)} et {fmtNombre(p.maximum)}
                      </div>
                    </div>
                    <div className="col-md-2 text-md-end">
                      {estAdmin && p.personnalise && (
                        <button onClick={() => reinitialiser(p)} className="btn btn-sm btn-outline-secondary"
                                title={`Revenir à ${fmtNombre(p.defaut)} ${p.unite}`}>
                          <RotateCcw size={14} className="me-1" /> Défaut
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Historique des modifications (admin) */}
      {estAdmin && !chargement && (
        <div className="card border rounded-3 overflow-hidden">
          <div className="card-header bg-light d-flex align-items-center justify-content-between">
            <span className="fw-semibold d-flex align-items-center gap-2"><History size={16} /> Historique</span>
            {historique === null && (
              <button onClick={chargerHistorique} className="btn btn-sm btn-outline-primary">Afficher</button>
            )}
          </div>
          {historique !== null && (
            historique.length === 0 ? (
              <p className="text-muted small p-3 mb-0">Aucune modification pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      {['Date', 'Paramètre', 'Ancienne valeur', 'Nouvelle valeur', 'Par'].map(h => (
                        <th key={h} className="fw-semibold text-muted small px-3 py-2 text-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historique.map(h => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 text-nowrap small">{fmtDateHeure(h.modifie_le)}</td>
                        <td className="px-3 py-2 small">{h.libelle || libelle(h.cle)}</td>
                        <td className="px-3 py-2 small">{h.ancienne_valeur ?? <span className="text-muted">défaut</span>}</td>
                        <td className="px-3 py-2 small">{h.nouvelle_valeur ?? <span className="text-muted">défaut</span>}</td>
                        <td className="px-3 py-2 small">{h.modifie_par_nom || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
