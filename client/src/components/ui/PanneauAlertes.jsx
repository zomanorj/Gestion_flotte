import { AlertTriangle } from 'lucide-react';

/**
 * Éléments à traiter en priorité (documents expirés, maintenances urgentes) : une carte sobre,
 * la couleur d'état n'apparaît que sur l'indicateur de chaque ligne.
 * `elements` : [{ id, ton: 'danger' | 'attention', titre, sousTitre, precision, badge }]
 */
export default function PanneauAlertes({ titre, elements }) {
  if (!elements.length) return null;
  return (
    <section className="card panneau-alertes apparition" aria-label={titre}>
      <div className="card-header d-flex align-items-center gap-2">
        <span className="stat-icone ton-danger"><AlertTriangle size={15} /></span>
        <span>{titre}</span>
        <span className="badge etat-danger ms-auto">{elements.length}</span>
      </div>
      <ul className="list-unstyled mb-0 grille-alertes">
        {elements.map((e) => (
          <li key={e.id} className={`alerte-ligne alerte-${e.ton}`}>
            <div className="min-w-0 flex-grow-1">
              <p className="mb-0 fw-medium text-truncate">{e.titre}</p>
              <p className="mb-0 small text-muted text-truncate">{e.sousTitre}</p>
              {e.precision && <p className="mb-0 text-xs mt-1 alerte-precision">{e.precision}</p>}
            </div>
            {e.badge}
          </li>
        ))}
      </ul>
    </section>
  );
}
