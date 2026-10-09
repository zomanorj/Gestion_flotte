
export default function StatCard({ titre, valeur, icone, couleur = 'neutre', sousTitre }) {
  // Neutre par défaut ; attention (orange) et danger (rouge) sont réservés aux alertes
  const palettes = {
    neutre:    { bg: 'bg-white',     border: 'border-gray-200',   icon: 'icone-page',                    val: 'text-dark'       },
    attention: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'bg-orange-100 text-orange-800', val: 'text-orange-800' },
    danger:    { bg: 'bg-red-50',    border: 'border-red-200',    icon: 'bg-red-100 text-red-800',       val: 'text-red-800'    },
  };

  const p = palettes[couleur] || palettes.neutre;

  return (
    <div className={`rounded-3 border ${p.bg} ${p.border} p-3 d-flex align-items-center gap-3 h-100`}>
      <div className={`rounded-3 ${p.icon} d-flex align-items-center justify-content-center flex-shrink-0`}
           style={{ width: '56px', height: '56px' }}>
        {icone}
      </div>
      <div>
        <p className="small text-muted fw-medium mb-0">{titre}</p>
        <p className={`fs-3 fw-bold mb-0 ${p.val}`}>{valeur}</p>
        {sousTitre && <p className="text-xs text-muted mb-0 mt-1">{sousTitre}</p>}
      </div>
    </div>
  );
}
