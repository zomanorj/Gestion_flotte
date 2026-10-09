import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Truck, MapPin, Calendar, AlertTriangle, CheckCircle2, FileCheck } from 'lucide-react';
import { useTableauDeBord } from '../requetes';
import StatCard    from '../components/StatCard';
import AlerteBadge from '../components/AlerteBadge';
import { formaterMontant } from '../utils/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);


export default function Dashboard() {
  const { data: stats, isPending: chargement, isError } = useTableauDeBord();
  const erreur = isError ? 'Impossible de charger les statistiques' : '';

  if (chargement) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ height: '16rem' }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="alert alert-danger d-flex align-items-center gap-2">
        <AlertTriangle size={20} className="flex-shrink-0" />
        {erreur}
      </div>
    );
  }

  const chartData = {
    labels: stats.missionsParSemaine.map((s) => s.semaine),
    datasets: [{
      label: 'Missions',
      data: stats.missionsParSemaine.map((s) => s.count),
      borderColor: '#343a40',
      backgroundColor: 'rgba(52,58,64,0.08)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#343a40',
      pointRadius: 5
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title:  { display: true, text: 'Missions par semaine (4 dernières semaines)', font: { size: 14 } }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  };

  return (
    <div className="d-flex flex-column gap-4">

      {/* KPIs */}
      <div className="row g-3 align-items-stretch">
        <div className="col-12 col-sm-6 col-xl">
          <StatCard titre="Camions disponibles" valeur={stats.vehiculesDisponibles}
            icone={<Truck size={28} />} couleur="neutre"
            sousTitre={`sur ${stats.totalVehicules} camions`} />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <StatCard titre="Missions en cours" valeur={stats.missionsEnCours}
            icone={<MapPin size={28} />} couleur="neutre"
            sousTitre={`${stats.missionsPlanifiees} planifiée(s)`} />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <StatCard titre="Missions aujourd'hui" valeur={stats.missionsAujourdhui}
            icone={<Calendar size={28} />} couleur="neutre"
            sousTitre="départs prévus ce jour" />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <StatCard titre="Alertes maintenance" valeur={stats.alertesMaintenance}
            icone={<AlertTriangle size={28} />} couleur={stats.alertesMaintenance > 0 ? 'danger' : 'neutre'}
            sousTitre="non lues" />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <StatCard titre="Documents à renouveler" valeur={stats.documentsExpires}
            icone={<FileCheck size={28} />} couleur={stats.documentsExpires > 0 ? 'attention' : 'neutre'}
            sousTitre="expirés ou < 30 jours" />
        </div>
      </div>

      {/* Graphique + alertes */}
      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="card border rounded-3 h-100">
            <div className="card-body p-4">
              <div style={{ height: '14rem' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
              <div className="mt-3 pt-3 border-top d-flex gap-4 small text-gray-600">
                <span>
                  Terminées ce mois :
                  <strong className="text-dark ms-1">{stats.missionsTermineesThisMois}</strong>
                </span>
                <span>
                  Coût carburant :
                  <strong className="text-primary ms-1">{formaterMontant(stats.coutTotalMois)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card border rounded-3 h-100">
            <div className="card-body p-4">
              <h3 className="fw-semibold text-dark mb-3 fs-6">Alertes récentes</h3>
              {stats.dernieresAlertes?.length === 0 ? (
                <div className="d-flex align-items-center gap-2 small text-muted">
                  <CheckCircle2 size={16} className="text-success" />
                  Aucune alerte en attente
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {stats.dernieresAlertes.map((a) => (
                    <AlerteBadge key={a.id} alerte={a} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
