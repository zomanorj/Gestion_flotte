import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Composant de pagination réutilisable.
 * @param {number}   page       - Page courante (1-based)
 * @param {number}   pages      - Nombre total de pages
 * @param {number}   total      - Nombre total d'éléments
 * @param {number}   limit      - Éléments par page
 * @param {Function} onChange   - Callback(newPage)
 */
export default function Pagination({ page, pages, total, limit = 20, onChange }) {
  if (!pages || pages <= 1) return null;

  const debut = (page - 1) * limit + 1;
  const fin   = Math.min(page * limit, total);

  // Génère la liste des numéros à afficher (max 7 boutons)
  const genererPages = () => {
    const liste = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) liste.push(i);
    } else {
      liste.push(1);
      if (page > 3) liste.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
        liste.push(i);
      }
      if (page < pages - 2) liste.push('...');
      liste.push(pages);
    }
    return liste;
  };

  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-1 py-2">
      <span className="small text-muted">
        Affichage {debut}–{fin} sur <strong>{total}</strong> résultat{total > 1 ? 's' : ''}
      </span>

      <nav>
        <ul className="pagination pagination-sm mb-0 gap-1">
          {/* Précédent */}
          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
            <button className="page-link rounded-2" onClick={() => onChange(page - 1)}
                    disabled={page <= 1}>
              <ChevronLeft size={14} />
            </button>
          </li>

          {/* Pages */}
          {genererPages().map((p, i) => (
            p === '...'
              ? <li key={`e${i}`} className="page-item disabled">
                  <span className="page-link bg-transparent border-0">…</span>
                </li>
              : <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                  <button className="page-link rounded-2" onClick={() => onChange(p)}>{p}</button>
                </li>
          ))}

          {/* Suivant */}
          <li className={`page-item ${page >= pages ? 'disabled' : ''}`}>
            <button className="page-link rounded-2" onClick={() => onChange(page + 1)}
                    disabled={page >= pages}>
              <ChevronRight size={14} />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
