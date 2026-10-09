import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Truck, MapPin, CalendarClock, Fuel, AlertTriangle, CheckCircle2, Plus, ArrowRight } from 'lucide-react';
import { useTableauDeBord } from '../requetes';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';
import { Squelette } from '../components/ui/Squelette';
import { formaterDate, formaterMontant } from '../utils/format';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// Répartition de la flotte : gris pour l'activité normale, couleurs d'état pour l'indisponibilité
const ETATS_FLOTTE = [
  { cle: 'vehiculesDisponibles', libelle: 'Disponibles',    couleur: 'var(--gris-800)' },
  { cle: 'vehiculesEnMission',   libelle: 'En mission',     couleur: 'var(--gris-500)' },
  { cle: 'vehiculesMaintenance', libelle: 'En maintenance', couleur: '#fd7e14' },
  { cle: 'vehiculesEnPanne',     libelle: 'En panne',       couleur: '#dc3545' },
];

const OPTIONS_GRAPHIQUE = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 500 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#212529', padding: 10, cornerRadius: 8, displayColors: false,
      titleFont: { family: 'Inter Variable', weight: '600' }, bodyFont: { family: 'Inter Variable' },
      callbacks: { label: (c) => `${c.parsed.y} mission(s)` },
    },
  },
  scales: {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6c757d', font: { family: 'Inter Variable', size: 12 } } },
    y: {
      beginAtZero: true, border: { display: false },
      grid: { color: '#e9ecef' },
      ticks: { stepSize: 1, precision: 0, color: '#adb5bd', font: { family: 'Inter Variable', size: 11 } },
    },
  },
};

function Chargement() {
  return (
    <div className="d-flex flex-column gap-4" aria-busy="true">
      <Squelette largeur="16rem" hauteur="1.75rem" />
      <div className="row g-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="col-12 col-sm-6 col-xl-3">
            <div className="card"><div className="card-body d-flex flex-column gap-3">
              <Squelette largeur="50%" /><Squelette largeur="35%" hauteur="1.75rem" /><Squelette largeur="60%" />
            </div></div>
          </div>
        ))}
      </div>
      <div className="card"><div className="card-body"><Squelette hauteur="14rem" /></div></div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isPending, isError } = useTableauDeBord();
  const peutPlanifier = ['admin', 'gestionnaire'].includes(user?.role);
  const prenom = user?.nom?.split(' ').slice(-1)[0];

  if (isPending) return <Chargement />;
  if (isError) {
    return (
      <div className="alert alert-danger d-flex align-items-center gap-2">
        <AlertTriangle size={18} className="flex-shrink-0" /> Impossible de charger le tableau de bord.
      </div>
    );
  }

  const graphique = {
    labels: stats.missionsParSemaine.map((s) => s.semaine),
    datasets: [{
      data: stats.missionsParSemaine.map((s) => s.count),
      backgroundColor: '#343a40', hoverBackgroundColor: '#212529',
      borderRadius: 6, maxBarThickness: 44,
    }],
  };
  const totalFlotte = Math.max(stats.totalVehicules, 1);
  const alertes = stats.alertesMaintenance + stats.documentsExpires;

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre={prenom ? `Bonjour, ${prenom}` : 'Tableau de bord'}
        description={`Situation de la flotte au ${JOUR.format(new Date())}.`}
        actions={peutPlanifier && (
          <Link to="/missions" className="btn btn-primary"><Plus size={16} /> Planifier une mission</Link>
        )}
      />

      {/* Indicateurs */}
      <div className="row g-3">
        <div className="col-6 col-xl-3">
          <StatCard titre="Camions disponibles" valeur={stats.vehiculesDisponibles} icone={<Truck size={16} />}
                    sousTitre={`sur ${stats.totalVehicules} camion(s)`} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard titre="Missions en cours" valeur={stats.missionsEnCours} icone={<MapPin size={16} />}
                    sousTitre={`${stats.missionsPlanifiees} planifiée(s)`} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard titre="Départs aujourd'hui" valeur={stats.missionsAujourdhui} icone={<CalendarClock size={16} />}
                    sousTitre={`${stats.missionsTermineesThisMois} mission(s) terminée(s) ce mois`} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard titre="Carburant ce mois" valeur={formaterMontant(stats.coutTotalMois)} icone={<Fuel size={16} />}
                    sousTitre="missions terminées" />
        </div>
      </div>

      <div className="row g-3">
        {/* Activité */}
        <div className="col-12 col-xl-8">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span>Missions par semaine</span>
              <span className="small text-muted fw-normal">4 dernières semaines</span>
            </div>
            <div className="card-body">
              <div style={{ height: '15rem' }}><Bar data={graphique} options={OPTIONS_GRAPHIQUE} /></div>
            </div>
          </div>
        </div>

        {/* État de la flotte */}
        <div className="col-12 col-xl-4">
          <div className="card h-100">
            <div className="card-header">État de la flotte</div>
            <div className="card-body d-flex flex-column gap-3">
              <div className="barre-repartition" role="img"
                   aria-label={ETATS_FLOTTE.map((e) => `${stats[e.cle]} ${e.libelle.toLowerCase()}`).join(', ')}>
                {ETATS_FLOTTE.map((e) => stats[e.cle] > 0 && (
                  <span key={e.cle} style={{ width: `${(stats[e.cle] / totalFlotte) * 100}%`, background: e.couleur }} />
                ))}
              </div>
              <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                {ETATS_FLOTTE.map((e) => (
                  <li key={e.cle} className="d-flex align-items-center gap-2">
                    <span className="pastille-legende" style={{ background: e.couleur }} />
                    <span className="flex-grow-1 text-gray-700">{e.libelle}</span>
                    <span className="fw-semibold chiffres">{stats[e.cle]}</span>
                  </li>
                ))}
              </ul>
              <Link to="/vehicules" className="lien-fleche mt-auto">Voir les véhicules <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>

        {/* Camions en mission */}
        <div className="col-12 col-xl-8">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span>Camions en mission</span>
              <Link to="/missions" className="lien-fleche fw-normal">Toutes les missions <ArrowRight size={14} /></Link>
            </div>
            {stats.vehiculesEnMissionCarte.length === 0 ? (
              <EtatVide Icone={Truck} titre="Aucun camion en mission"
                        description="Les missions démarrées apparaîtront ici." />
            ) : (
              <ul className="list-unstyled mb-0 liste-lignes">
                {stats.vehiculesEnMissionCarte.map((v) => (
                  <li key={v.id} className="d-flex align-items-center gap-3">
                    <span className="stat-icone icone-page"><Truck size={15} /></span>
                    <div className="flex-grow-1 min-w-0">
                      <p className="mb-0 fw-medium text-truncate">{v.titre}</p>
                      <p className="mb-0 small text-muted text-truncate">
                        {v.chauffeur_prenom} {v.chauffeur_nom} · vers {v.lieu_destination}
                      </p>
                    </div>
                    <span className="immatriculation text-gray-700 d-none d-sm-inline">{v.immatriculation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* À surveiller */}
        <div className="col-12 col-xl-4">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span>À surveiller</span>
              {alertes > 0 && <span className="badge etat-danger">{alertes}</span>}
            </div>
            {stats.dernieresAlertes.length === 0 ? (
              <EtatVide Icone={CheckCircle2} titre="Rien à signaler" description="Aucune alerte en attente." />
            ) : (
              <ul className="list-unstyled mb-0 liste-lignes">
                {stats.dernieresAlertes.map((a) => (
                  <li key={a.id} className="d-flex align-items-start gap-3">
                    <span className="stat-icone ton-danger flex-shrink-0"><AlertTriangle size={14} /></span>
                    <div className="min-w-0">
                      <p className="mb-0 fw-medium">{a.immatriculation} <span className="text-muted fw-normal">· {a.type}</span></p>
                      <p className="mb-0 small text-muted">{a.message}</p>
                      {a.created_at && <p className="mb-0 text-xs text-muted mt-1">{formaterDate(a.created_at)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="card-body pt-0 mt-auto d-flex flex-column gap-1">
              <Link to="/maintenances" className="lien-fleche">{stats.alertesMaintenance} alerte(s) de maintenance <ArrowRight size={14} /></Link>
              <Link to="/documents" className="lien-fleche">{stats.documentsExpires} document(s) à renouveler <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
