// Badge d'alerte coloré selon le type de maintenance
import React from 'react';

/** Retourne les classes CSS Tailwind selon le type d'alerte */
const couleurParType = (type = '') => {
  const t = type.toLowerCase();
  if (t.includes('contr') || t.includes('ct'))    return 'bg-red-100 text-red-700 border-red-200';
  if (t.includes('vidange'))                       return 'bg-orange-100 text-orange-700 border-orange-200';
  if (t.includes('frein') || t.includes('panne'))  return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-yellow-100 text-yellow-700 border-yellow-200';
};

/**
 * Badge affichant une alerte de maintenance.
 * @param {Object} alerte - { type, message, vehicule, immatriculation, created_at }
 */
export default function AlerteBadge({ alerte }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${couleurParType(alerte.type)}`}>
      <span className="text-lg flex-shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {alerte.immatriculation} — {alerte.type}
        </p>
        <p className="text-xs opacity-80 mt-0.5 line-clamp-2">{alerte.message}</p>
      </div>
    </div>
  );
}
