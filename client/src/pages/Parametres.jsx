import { useState, useEffect } from 'react';
import { Save, RotateCcw, History, AlertTriangle, Lock } from 'lucide-react';
import api from '../services/api';
import { messageErreur } from '../requetes/client';
import { useEcriture, useHistoriqueParametres, useParametres } from '../requetes';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formaterDateHeure, formaterNombre } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import EnTetePage from '../components/ui/EnTetePage';

// Ordre d'affichage des catégories renvoyées par l'API
const CATEGORIES = ['Missions', 'Paie', 'Alertes'];


export default function Parametres() {
  const { user } = useAuth();
  const estAdmin = user?.role === 'admin';
  const { ajouterToast, ToastContainer } = useToast();

  const [saisies,     setSaisies]     = useState({}); // { cle: texte saisi } pour les champs modifiés
  const [voirHistorique, setVoirHistorique] = useState(false);

  const { data: parametres = [], isPending: chargement, isError } = useParametres();
  const erreur = isError ? 'Impossible de charger les paramètres' : '';
  const hist = useHistoriqueParametres(voirHistorique);
  const historique = voirHistorique ? hist.data ?? null : null; // null : pas encore chargé

  useEffect(() => {
    if (!hist.isError) return;
    ajouterToast('Erreur', "Impossible de charger l'historique", true);
    setVoirHistorique(false);
  }, [hist.isError]); // eslint-disable-line react-hooks/exhaustive-deps

  // L'écriture rafraîchit aussi l'historique et les données calculées avec ces paramètres
  const modification = useEcriture('parametres', (valeurs) => api.put('/parametres', { valeurs }));
  const retablissement = useEcriture('parametres', (cle) => api.delete(`/parametres/${cle}`));
  const sauvegarde = modification.isPending;

  // Champs dont la saisie diffère de la valeur en vigueur
  const modifications = Object.fromEntries(
    Object.entries(saisies)
      .filter(([cle, texte]) => texte !== '' && Number(texte) !== parametres.find(p => p.cle === cle)?.valeur)
      .map(([cle, texte]) => [cle, Number(texte)])
  );
  const nbModifications = Object.keys(modifications).length;

  const enregistrer = async () => {
    try {
      await modification.mutateAsync(modifications);
      setSaisies({});
      ajouterToast('Paramètres enregistrés', `${nbModifications} valeur(s) modifiée(s)`);
    } catch (err) {
      ajouterToast('Enregistrement refusé', messageErreur(err, 'Erreur'), true);
    }
  };

  const reinitialiser = async (p) => {
    try {
      await retablissement.mutateAsync(p.cle);
      setSaisies(({ [p.cle]: _, ...autres }) => autres);
      ajouterToast('Valeur par défaut rétablie', `${p.libelle} : ${formaterNombre(p.defaut, 3)} ${p.unite}`);
    } catch (err) {
      ajouterToast('Erreur', messageErreur(err, 'Erreur'), true);
    }
  };

  const libelle = (cle) => parametres.find(p => p.cle === cle)?.libelle || cle;

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage titre="Paramètres métier" description="Prix du carburant, barème de paie et seuils d'alerte utilisés par les calculs" />

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
        <LignesSquelette />
      ) : CATEGORIES.map(categorie => (
        <div key={categorie} className="card carte-tableau">
          <div className="card-header">{categorie}</div>
          <ul className="list-group list-group-flush">
            {parametres.filter(p => p.categorie === categorie).map(p => {
              const saisie = saisies[p.cle] ?? String(p.valeur);
              const modifie = p.cle in modifications;
              return (
                <li key={p.cle} className={`list-group-item py-3 parametre${modifie ? ' parametre-modifie' : ''}`}>
                  <div className="row g-3 align-items-center">
                    <div className="col-md-6">
                      <div className="fw-medium text-dark d-flex align-items-center gap-2 flex-wrap">
                        {p.libelle}
                        {p.personnalise && <span className="badge etat-neutre">Personnalisé</span>}
                        {modifie && <span className="badge etat-actif">Modifié</span>}
                      </div>
                      <div className="text-muted small">{p.description}</div>
                      {p.personnalise && (
                        <div className="text-muted small mt-1">
                          Modifié{p.modifie_par_nom ? ` par ${p.modifie_par_nom}` : ''} le {formaterDateHeure(p.modifie_le)}
                          {' '}— par défaut : {formaterNombre(p.defaut, 3)} {p.unite}
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
                        Entre {formaterNombre(p.minimum, 3)} et {formaterNombre(p.maximum, 3)}
                      </div>
                    </div>
                    <div className="col-md-2 text-md-end">
                      {estAdmin && p.personnalise && (
                        <button onClick={() => reinitialiser(p)} className="btn btn-sm btn-link text-muted"
                                title={`Revenir à ${formaterNombre(p.defaut, 3)} ${p.unite}`}>
                          <RotateCcw size={14} /> Valeur par défaut
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
        <div className="card carte-tableau">
          <div className="card-header d-flex align-items-center justify-content-between">
            <span className="d-flex align-items-center gap-2"><History size={16} /> Historique des modifications</span>
            {!voirHistorique && (
              <button onClick={() => setVoirHistorique(true)} className="btn btn-sm btn-outline-secondary">Afficher</button>
            )}
          </div>
          {historique !== null && (
            historique.length === 0 ? (
              <p className="text-muted small p-3 mb-0">Aucune modification pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table align-middle">
                  <thead>
                    <tr><th>Date</th><th>Paramètre</th><th className="text-end">Avant</th><th className="text-end">Après</th><th>Par</th></tr>
                  </thead>
                  <tbody>
                    {historique.map(h => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 text-nowrap small">{formaterDateHeure(h.modifie_le)}</td>
                        <td className="px-3 py-2 small">{h.libelle || libelle(h.cle)}</td>
                        <td className="px-3 py-2 small text-end">{h.ancienne_valeur ?? <span className="text-muted">défaut</span>}</td>
                        <td className="px-3 py-2 small text-end">{h.nouvelle_valeur ?? <span className="text-muted">défaut</span>}</td>
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

      {/* Barre d'enregistrement : visible tant qu'une valeur saisie diffère de la valeur en vigueur */}
      {estAdmin && nbModifications > 0 && (
        <div className="barre-enregistrement" role="region" aria-label="Modifications non enregistrées">
          <span>{nbModifications} modification(s) non enregistrée(s)</span>
          <div className="d-flex gap-2">
            <button onClick={() => setSaisies({})} className="btn btn-sm btn-outline-light">Annuler les modifications</button>
            <button onClick={enregistrer} disabled={sauvegarde} className="btn btn-sm btn-light">
              {sauvegarde ? <span className="spinner-border spinner-border-sm" role="status" /> : <Save size={14} />}
              Enregistrer
            </button>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
