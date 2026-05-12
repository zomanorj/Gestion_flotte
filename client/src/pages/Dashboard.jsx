// Page tableau de bord — statistiques, graphique et carte en temps réel
import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import api from '../services/api';
import StatCard    from '../components/StatCard';
import MapView     from '../components/MapView';
import AlerteBadge from '../components/AlerteBadge';

// Enregistrement des modules Chart.js nécessaires
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/** Formate un nombre en Ariary avec séparateurs */
const formatAriary = (n) =>
  new Intl.NumberFormat('fr-MG').format(Math.round(n)) + ' Ar';

export default function Dashboard() {
  const [stats,      setStats]      = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur,     setErreur]     = useState('');

  // Chargement des statistiques au montage du composant
  useEffect(() => {
    api.get('/dashboard/stats')
      .then(({ data }) => { setStats(data); setChargement(false); })
      .catch(() => { setErreur('Impossible de charger les statistiques'); setChargement(false); });
  }, []);

  if (chargement) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
        ⚠️ {erreur}
      </div>
    );
  }

  // Configuration du graphique en courbes
  const chartData = {
    labels: stats.missionsParSemaine.map((s) => s.semaine),
    datasets: [{
      label: 'Missions',
      data: stats.missionsParSemaine.map((s) => s.count),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#3b82f6',
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
    <div className="space-y-6">
      {/* Section statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          titre="Véhicules disponibles"
          valeur={stats.vehiculesDisponibles}
          icone="🚙"
          couleur="green"
          sousTitre={`sur ${stats.totalVehicules} au total`}
        />
        <StatCard
          titre="Missions en cours"
          valeur={stats.missionsEnCours}
          icone="📍"
          couleur="blue"
          sousTitre={`${stats.missionsPlanifiees} planifiée(s)`}
        />
        <StatCard
          titre="Missions aujourd'hui"
          valeur={stats.missionsAujourdhui}
          icone="📅"
          couleur="orange"
          sousTitre="départs prévus ce jour"
        />
        <StatCard
          titre="Alertes maintenance"
          valeur={stats.alertesMaintenance}
          icone="⚠️"
          couleur="red"
          sousTitre="non lues"
        />
      </div>

      {/* Section graphique + alertes */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Graphique missions par semaine */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          <div className="h-56">
            <Line data={chartData} options={chartOptions} />
          </div>
          {/* Résumé du mois */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6 text-sm text-gray-600">
            <span>
              Terminées ce mois :
              <strong className="text-gray-900 ml-1">{stats.missionsTermineesThisMois}</strong>
            </span>
            <span>
              Coût carburant :
              <strong className="text-blue-700 ml-1">{formatAriary(stats.coutTotalMois)}</strong>
            </span>
          </div>
        </div>

        {/* Dernières alertes */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Alertes récentes</h3>
          {stats.dernieresAlertes?.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune alerte en attente ✅</p>
          ) : (
            <div className="space-y-2">
              {stats.dernieresAlertes.map((a) => (
                <AlerteBadge key={a.id} alerte={a} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Carte Leaflet */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">
            Véhicules en mission
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {stats.vehiculesEnMissionCarte?.length || 0}
            </span>
          </h3>
          <span className="text-xs text-gray-400">Centré sur Madagascar</span>
        </div>
        <MapView
          vehicules={stats.vehiculesEnMissionCarte || []}
          className="h-72"
        />
      </div>
    </div>
  );
}
