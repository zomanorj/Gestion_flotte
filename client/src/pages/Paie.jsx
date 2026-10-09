import { useState } from 'react';
import { Wallet, Download, Pencil, Users, TrendingUp, MapPin } from 'lucide-react';
import api, { telechargerFichier } from '../services/api';
import { messageErreur } from '../requetes/client';
import { useEcriture, usePaie } from '../requetes';
import { formaterKm, formaterMontant } from '../utils/format';
import { LignesSquelette } from '../components/ui/Squelette';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';

const MOIS_FR = ['', 'Janvier','Février','Mars','Avril','Mai','Juin',
                 'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];


export default function Paie() {
  const now = new Date();
  const [annee,   setAnnee]   = useState(now.getFullYear());
  const [mois,    setMois]    = useState(now.getMonth() + 1);
  const [erreurPdf, setErreurPdf] = useState('');
  // Le mois précédent reste affiché pendant le chargement du suivant
  const { data: resume = null, isPending: chargement, isError } = usePaie(annee, mois);
  const erreur = isError ? 'Impossible de charger la paie' : erreurPdf;

  // Modal édition salaire
  const [modalSalaire, setModalSalaire] = useState(null); // { id, nom, prenom, salaire_base, prime_mission }
  const [formSalaire,  setFormSalaire]  = useState({ salaire_base: '', prime_mission: '' });
  const [errSalaire,   setErrSalaire]   = useState('');
  const salaire = useEcriture('paie', ({ id, valeurs }) => api.patch(`/paie/chauffeur/${id}/salaire`, valeurs));
  const savSalaire = salaire.isPending;

  const telechargerPDF = async (fiche) => {
    setErreurPdf('');
    try {
      await telechargerFichier(
        `/paie/chauffeur/${fiche.chauffeur_id}/${annee}/${mois}/pdf`,
        `bulletin_${fiche.nom}_${mois}_${annee}.pdf`
      );
    } catch {
      setErreurPdf('Impossible de télécharger le bulletin');
    }
  };

  const ouvrirSalaire = (fiche) => {
    setFormSalaire({ salaire_base: fiche.salaire_base || 800000, prime_mission: fiche.total_primes / Math.max(1, fiche.nb_missions) || 50000 });
    setModalSalaire({ id: fiche.chauffeur_id, nom: fiche.nom, prenom: fiche.prenom });
    setErrSalaire('');
  };

  const sauvegarderSalaire = async (e) => {
    e.preventDefault(); setErrSalaire('');
    try {
      await salaire.mutateAsync({ id: modalSalaire.id, valeurs: formSalaire });
      setModalSalaire(null);
    } catch (err) {
      setErrSalaire(messageErreur(err, 'Erreur'));
    }
  };

  const annees = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Paie des chauffeurs"
        description="Salaire de base, primes de mission et bonus kilométrique, nets de la cotisation CNAPS"
        actions={(
          <div className="d-flex align-items-center gap-2">
            <select value={mois} onChange={e => setMois(parseInt(e.target.value))} className="form-select" aria-label="Mois">
              {MOIS_FR.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} className="form-select" aria-label="Année">
              {annees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      />

      {erreur && <div className="alert alert-danger">{erreur}</div>}

      {resume && (
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <StatCard titre="Masse salariale nette" valeur={formaterMontant(resume.masse_salariale)} icone={<TrendingUp size={16} />}
                      sousTitre={`${MOIS_FR[mois]} ${annee}`} />
          </div>
          <div className="col-12 col-md-4">
            <StatCard titre="Chauffeurs" valeur={resume.fiches.length} icone={<Users size={16} />} />
          </div>
          <div className="col-12 col-md-4">
            <StatCard titre="Missions du mois" valeur={resume.nb_missions} icone={<MapPin size={16} />} />
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="card carte-tableau">
        {chargement ? (
          <LignesSquelette />
        ) : !resume || resume.fiches.length === 0 ? (
          <EtatVide Icone={Wallet} titre={`Aucune donnée pour ${MOIS_FR[mois].toLowerCase()} ${annee}`}
                    description="Aucun chauffeur ni aucune mission sur cette période." />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Chauffeur</th><th className="text-end">Missions</th><th className="text-end">Distance</th>
                  <th className="text-end">Salaire de base</th><th className="text-end">Primes</th><th className="text-end">Bonus km</th>
                  <th className="text-end">Net à payer</th><th className="col-actions"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {resume.fiches.map((f) => (
                  <tr key={f.chauffeur_id}>
                    <td className="fw-medium text-nowrap">{f.prenom} {f.nom}</td>
                    <td className="text-end">{f.nb_missions}</td>
                    <td className="text-end text-nowrap text-gray-700">{formaterKm(f.total_km)}</td>
                    <td className="text-end text-nowrap text-gray-700">{formaterMontant(f.salaire_base)}</td>
                    <td className="text-end text-nowrap text-gray-700">{formaterMontant(f.total_primes)}</td>
                    <td className="text-end text-nowrap text-gray-700">{f.km_bonus > 0 ? formaterMontant(f.km_bonus) : '—'}</td>
                    <td className="text-end text-nowrap fw-semibold">{formaterMontant(f.net_a_payer)}</td>
                    <td className="col-actions">
                      <div className="d-flex gap-1">
                        <button onClick={() => telechargerPDF(f)}
                                className="btn btn-icone" title="Bulletin PDF" aria-label="Bulletin PDF"><Download size={16} /></button>
                        <button onClick={() => ouvrirSalaire(f)}
                                className="btn btn-icone" title="Modifier le salaire" aria-label="Modifier le salaire"><Pencil size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="ligne-total">
                  <td>Total</td>
                  <td className="text-end">{resume.nb_missions}</td>
                  <td className="text-end text-nowrap">{formaterKm(resume.fiches.reduce((s, f) => s + f.total_km, 0))}</td>
                  <td colSpan={3} />
                  <td className="text-end text-nowrap">{formaterMontant(resume.masse_salariale)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Salaire */}
      <Modal isOpen={!!modalSalaire} onClose={() => setModalSalaire(null)} titre="Modifier la rémunération" taille="sm"
             description={modalSalaire ? `${modalSalaire.prenom} ${modalSalaire.nom}` : undefined}>
        <form onSubmit={sauvegarderSalaire} className="d-flex flex-column gap-3">
          {errSalaire && <div className="alert alert-danger small py-2 mb-0">{errSalaire}</div>}
          <div>
            <label className="form-label">Salaire de base mensuel (Ar)</label>
            <input type="number" min="0" value={formSalaire.salaire_base}
                   onChange={e => setFormSalaire({ ...formSalaire, salaire_base: e.target.value })} className="form-control form-control-sm" />
          </div>
          <div>
            <label className="form-label">Prime par mission terminée (Ar)</label>
            <input type="number" min="0" value={formSalaire.prime_mission}
                   onChange={e => setFormSalaire({ ...formSalaire, prime_mission: e.target.value })} className="form-control form-control-sm" />
            <p className="form-text mb-0">Le bonus kilométrique suit le barème défini dans les Paramètres.</p>
          </div>
          <div className="modale-actions">
            <button type="button" onClick={() => setModalSalaire(null)} className="btn btn-outline-secondary">Annuler</button>
            <button type="submit" disabled={savSalaire} className="btn btn-primary">
              {savSalaire && <span className="spinner-border spinner-border-sm" role="status" />}
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
