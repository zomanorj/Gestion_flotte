import React from 'react';

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
    <div className={`rounded-3 border ${p.bg} ${p.border} p-3 d-flex align-items-center gap-3`}>
      <div className={`rounded-3 ${p.icon} d-flex align-items-center justify-content-center flex-shrink-0`}
           style={{ width: '56px', height: '56px' }}>
        {icone}
      </div>
      <div>
        <p className="small text-gray-500 fw-medium mb-0">{titre}</p>
        <p className={`fs-3 fw-bold mb-0 ${p.val}`}>{valeur}</p>
        {sousTitre && <p className="text-xs text-gray-400 mb-0 mt-1">{sousTitre}</p>}
      </div>
    </div>
  );
}
