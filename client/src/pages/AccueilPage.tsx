/**
 * AccueilPage.tsx
 * Page d'accueil de l'application TransiFlow.
 * Elle présente un résumé visuel des fonctionnalités principales
 * et sert de point d'entrée avant la connexion.
 */

import NavBar from '../components/NavBar'
import CarteStatistique from '../components/CarteStatistique'

// Données fictives pour la démo — à remplacer par des appels API
const statistiquesDemo = [
  { titre: 'Véhicules actifs',   valeur: '12', icone: '🚌', couleur: 'bg-blue-100  text-blue-800'  },
  { titre: 'Missions du jour',   valeur: '5',  icone: '📋', couleur: 'bg-orange-100 text-orange-800' },
  { titre: 'Chauffeurs dispo',   valeur: '8',  icone: '👤', couleur: 'bg-green-100  text-green-800'  },
  { titre: 'KM parcourus (mois)', valeur: '4 820', icone: '📍', couleur: 'bg-purple-100 text-purple-800' },
]

function AccueilPage() {
  return (
    <div className="min-h-screen bg-TransiFlow-gris">
      {/* Barre de navigation en haut */}
      <NavBar />

      {/* Section héro : titre principal */}
      <section className="bg-TransiFlow-bleu text-white py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          TransiFlow
        </h1>
        <p className="text-lg text-blue-200 max-w-xl mx-auto">
          Système de gestion de flotte et de missions — TransiFlow
        </p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <button className="btn-primary">Nouvelle mission</button>
          <button className="bg-white text-TransiFlow-bleu px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
            Voir la flotte
          </button>
        </div>
      </section>

      {/* Tableau de bord rapide : statistiques clés */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-TransiFlow-bleu mb-6">
          Tableau de bord
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statistiquesDemo.map((stat) => (
            <CarteStatistique
              key={stat.titre}
              titre={stat.titre}
              valeur={stat.valeur}
              icone={stat.icone}
              couleur={stat.couleur}
            />
          ))}
        </div>
      </section>

      {/* Section modules : présentation des grandes fonctionnalités */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-semibold text-TransiFlow-bleu mb-6">
          Modules disponibles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ModuleCard
            titre="Gestion des véhicules"
            description="Suivi des immatriculations, assurances, kilométrage et disponibilité de la flotte."
            icone="🚗"
          />
          <ModuleCard
            titre="Gestion des chauffeurs"
            description="Fiches chauffeurs, permis de conduire, statuts et affectations aux missions."
            icone="👨‍✈️"
          />
          <ModuleCard
            titre="Planification des missions"
            description="Création, suivi et historique des missions de transport avec rapports."
            icone="🗺️"
          />
        </div>
      </section>

      {/* Pied de page */}
      <footer className="bg-TransiFlow-bleu text-blue-200 text-center py-4 text-sm">
        © {new Date().getFullYear()} TransiFlow — Tous droits réservés
      </footer>
    </div>
  )
}

// --- Sous-composant local : carte module ---
// Utilisé uniquement sur cette page, donc défini ici plutôt que dans /components

interface ModuleCardProps {
  titre: string
  description: string
  icone: string
}

function ModuleCard({ titre, description, icone }: ModuleCardProps) {
  return (
    <div className="card hover:shadow-lg transition-shadow cursor-pointer border border-gray-100">
      <div className="text-4xl mb-3">{icone}</div>
      <h3 className="text-lg font-semibold text-TransiFlow-bleu mb-2">{titre}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

export default AccueilPage
