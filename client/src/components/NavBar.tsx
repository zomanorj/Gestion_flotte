/**
 * NavBar.tsx
 * Barre de navigation principale de l'application Transport STTA.
 * Affiche le logo, le nom du projet et les liens de navigation.
 * Ce composant est réutilisé sur toutes les pages de l'application.
 */

import { Link } from 'react-router-dom'

function NavBar() {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo et nom du projet */}
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="w-9 h-9 bg-stta-bleu rounded-lg flex items-center justify-center text-white font-bold text-sm">
            ST
          </div>
          <span className="font-bold text-stta-bleu text-lg">Transport STTA</span>
        </Link>

        {/* Liens de navigation (à compléter dans les prochains sprints) */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link to="/vehicules" className="hover:text-stta-bleu transition-colors">Véhicules</Link>
          <Link to="/chauffeurs" className="hover:text-stta-bleu transition-colors">Chauffeurs</Link>
          <Link to="/missions"   className="hover:text-stta-bleu transition-colors">Missions</Link>
        </div>

        {/* Bouton de connexion (fonctionnel au Sprint 1) */}
        <button className="btn-secondary text-sm">
          Connexion
        </button>
      </div>
    </nav>
  )
}

export default NavBar
