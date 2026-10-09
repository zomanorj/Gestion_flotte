import { useState } from 'react';
import {
  ClipboardList, MapPin, Truck, CalendarClock, Route, Weight, FileDown, AlertTriangle, StickyNote,
} from 'lucide-react';
import { telechargerFichier } from '../services/api';
import { useMesMissions } from '../requetes';
import { formaterDateHeure, formaterKm } from '../utils/format';

const STATUTS = {
  planifiee: { label: 'Planifiée', cls: 'bg-gray-100 text-gray-700' },
  en_cours:  { label: 'En cours',  cls: 'bg-blue-100 text-blue-800' },
  terminee:  { label: 'Terminée',  cls: 'bg-green-100 text-green-800' },
  annulee:   { label: 'Annulée',   cls: 'bg-red-100 text-red-700' },
};

const HISTORIQUE_INITIAL = 10;

const Detail = ({ Icone, children }) => (
  <div className="d-flex align-items-start gap-2 small text-gray-600">
    <Icone size={16} className="flex-shrink-0 mt-1 text-muted" />
    <div style={{ minWidth: 0 }}>{children}</div>
  </div>
);

function CarteMission({ mission, enAvant = false }) {
  const [telechargement, setTelechargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const statut = STATUTS[mission.statut] || STATUTS.planifiee;

  const telechargerBon = async () => {
    setTelechargement(true); setErreur('');
    try {
      await telechargerFichier(`/missions/${mission.id}/bon-livraison`, `bon-livraison-${mission.id}.pdf`);
    } catch {
      setErreur('Impossible de télécharger le bon de livraison');
    } finally {
      setTelechargement(false);
    }
  };

  return (
    <article className={`card rounded-3 ${enAvant ? 'border-primary border-2' : 'border'}`}>
      <div className="card-body p-3 d-flex flex-column gap-2">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <h3 className="fs-6 fw-semibold text-dark mb-0">{mission.titre}</h3>
          <span className={`badge rounded-pill fw-medium flex-shrink-0 ${statut.cls}`}>{statut.label}</span>
        </div>

        <Detail Icone={MapPin}>
          <span className="fw-medium text-dark">{mission.lieu_depart}</span>
          {' → '}
          <span className="fw-medium text-dark">{mission.lieu_destination}</span>
        </Detail>
        <Detail Icone={CalendarClock}>
          Départ {formaterDateHeure(mission.date_depart)}
          <br />
          {mission.date_retour_reelle
            ? <>Retour {formaterDateHeure(mission.date_retour_reelle)}</>
            : <>Retour prévu {formaterDateHeure(mission.date_retour_prevue)}</>}
        </Detail>
        <Detail Icone={Truck}>
          {mission.immatriculation} — {mission.marque} {mission.modele}
        </Detail>
        <div className="d-flex flex-wrap column-gap-4 row-gap-2">
          {mission.distance_km > 0 && <Detail Icone={Route}>{formaterKm(mission.distance_km, 1)}</Detail>}
          {mission.poids_charge > 0 && <Detail Icone={Weight}>{mission.poids_charge} T</Detail>}
        </div>
        {mission.notes && <Detail Icone={StickyNote}>{mission.notes}</Detail>}

        {erreur && <p className="text-danger small mb-0">{erreur}</p>}

        {mission.statut !== 'annulee' && (
          <div className="d-flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={telechargerBon} disabled={telechargement}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2">
              <FileDown size={16} /> {telechargement ? 'Téléchargement…' : 'Bon de livraison'}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const Section = ({ titre, missions, total = missions.length, enAvant, vide, children }) => (
  <section className="d-flex flex-column gap-2">
    <h2 className="fs-6 fw-semibold text-gray-600 text-uppercase small mb-0">
      {titre} <span className="text-muted fw-normal">({total})</span>
    </h2>
    {missions.length === 0
      ? <p className="text-muted small mb-0">{vide}</p>
      : (
        <div className="row g-3">
          {missions.map((m) => (
            <div key={m.id} className="col-12 col-md-6 col-xl-4">
              <CarteMission mission={m} enAvant={enAvant} />
            </div>
          ))}
        </div>
      )}
    {children}
  </section>
);

/**
 * Missions du chauffeur connecté : en cours, à venir (la plus proche en premier) et historique.
 * Affichage en cartes, lisible sur téléphone ; mis à jour en temps réel quand le gestionnaire
 * planifie, démarre ou clôture une mission.
 */
export default function MesMissions() {
  const { data: missions = [], isPending, isError, error } = useMesMissions();
  const [historiqueComplet, setHistoriqueComplet] = useState(false);

  const enCours = missions.filter((m) => m.statut === 'en_cours');
  const aVenir = missions.filter((m) => m.statut === 'planifiee')
    .sort((a, b) => String(a.date_depart).localeCompare(String(b.date_depart)));
  const historique = missions.filter((m) => m.statut === 'terminee' || m.statut === 'annulee');
  const historiqueAffiche = historiqueComplet ? historique : historique.slice(0, HISTORIQUE_INITIAL);

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex align-items-center gap-3">
        <div className="bg-blue-100 rounded-3 p-2 flex-shrink-0"><ClipboardList size={24} className="text-blue-600" /></div>
        <div style={{ minWidth: 0 }}>
          <h1 className="fs-4 fw-bold text-dark mb-0">Mes missions</h1>
          <p className="text-muted small mb-0">
            {isPending ? 'Chargement…' : `${enCours.length} en cours, ${aVenir.length} à venir`}
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement des missions…</span>
          </div>
        </div>
      ) : isError ? (
        <div className="alert alert-warning d-flex align-items-start gap-2 mb-0">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span>
            {error?.response?.status === 404
              ? "Votre compte n'est lié à aucune fiche chauffeur. Demandez à votre gestionnaire de l'associer."
              : 'Impossible de charger vos missions. Vérifiez votre connexion et réessayez.'}
          </span>
        </div>
      ) : (
        <>
          <Section titre="En cours" missions={enCours} enAvant vide="Aucune mission en cours." />
          <Section titre="À venir" missions={aVenir} vide="Aucune mission planifiée." />
          <Section titre="Historique" missions={historiqueAffiche} total={historique.length} vide="Aucune mission terminée pour le moment.">
            {historique.length > HISTORIQUE_INITIAL && (
              <button type="button" onClick={() => setHistoriqueComplet(!historiqueComplet)}
                      className="btn btn-link btn-sm align-self-start p-0">
                {historiqueComplet ? 'Afficher moins' : `Afficher les ${historique.length} missions`}
              </button>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
