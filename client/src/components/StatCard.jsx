/**
 * Indicateur du tableau de bord : libellé, valeur en grand, précision en dessous.
 * `couleur` : neutre par défaut ; attention (orange) et danger (rouge) seulement pour une alerte.
 */
const TONS = {
  neutre:    { carte: '',                    icone: 'icone-page' },
  attention: { carte: 'stat-carte-attention', icone: 'ton-attention' },
  danger:    { carte: 'stat-carte-danger',    icone: 'ton-danger' },
};

export default function StatCard({ titre, valeur, icone, couleur = 'neutre', sousTitre }) {
  const ton = TONS[couleur] || TONS.neutre;
  return (
    <div className={`card stat-carte h-100 ${ton.carte}`}>
      <div className="card-body d-flex flex-column gap-2">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <p className="stat-libelle mb-0">{titre}</p>
          <span className={`stat-icone ${ton.icone}`} aria-hidden="true">{icone}</span>
        </div>
        <p className="valeur-kpi mb-0">{valeur}</p>
        {sousTitre && <p className="stat-precision mb-0">{sousTitre}</p>}
      </div>
    </div>
  );
}
