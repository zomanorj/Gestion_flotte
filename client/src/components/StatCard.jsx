// Carte statistique réutilisable pour le dashboard
import React from 'react';

/**
 * Affiche une métrique clé avec icône lucide-react et couleur.
 * @param {string} titre     - Libellé de la statistique
 * @param {string|number} valeur - Valeur à mettre en avant
 * @param {ReactNode} icone  - Composant lucide-react déjà instancié avec sa className
 * @param {string} couleur   - Thème de couleur : 'green' | 'blue' | 'orange' | 'red' | 'yellow'
 * @param {string} sousTitre - Texte explicatif optionnel sous la valeur
 */
export default function StatCard({ titre, valeur, icone, couleur = 'blue', sousTitre }) {
  const palettes = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'bg-green-100 text-green-600',   val: 'text-green-700'  },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'bg-blue-100 text-blue-600',     val: 'text-blue-700'   },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'bg-orange-100 text-orange-600', val: 'text-orange-700' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200',    icon: 'bg-red-100 text-red-600',       val: 'text-red-700'    },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', val: 'text-yellow-700' }
  };

  const p = palettes[couleur] || palettes.blue;

  return (
    <div className={`rounded-xl border ${p.bg} ${p.border} p-5 flex items-center gap-4`}>
      <div className={`w-14 h-14 rounded-xl ${p.icon} flex items-center justify-center flex-shrink-0`}>
        {icone}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{titre}</p>
        <p className={`text-3xl font-bold ${p.val}`}>{valeur}</p>
        {sousTitre && <p className="text-xs text-gray-400 mt-0.5">{sousTitre}</p>}
      </div>
    </div>
  );
}
