import React from 'react';
import { AlertTriangle } from 'lucide-react';

const couleurParType = (type = '') => {
  const t = type.toLowerCase();
  if (t.includes('contr') || t.includes('ct'))    return 'bg-red-100 text-red-700 border-red-200';
  if (t.includes('vidange'))                       return 'bg-orange-100 text-orange-700 border-orange-200';
  if (t.includes('frein') || t.includes('panne'))  return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-yellow-100 text-yellow-700';
};

export default function AlerteBadge({ alerte }) {
  return (
    <div className={`d-flex align-items-start gap-2 p-2 rounded-2 border small ${couleurParType(alerte.type)}`}>
      <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
      <div className="flex-grow-1 min-w-0">
        <p className="fw-medium text-truncate mb-0">
          {alerte.immatriculation} — {alerte.type}
        </p>
        <p className="text-xs opacity-75 mt-1 mb-0">{alerte.message}</p>
      </div>
    </div>
  );
}
