import { Search, X } from 'lucide-react';

/** Champ de recherche avec icône et bouton d'effacement. */
export default function ChampRecherche({ valeur, onChange, placeholder = 'Rechercher…', className = '' }) {
  return (
    <div className={`champ-recherche ${className}`}>
      <Search size={16} className="champ-recherche-icone" aria-hidden="true" />
      <input type="search" value={valeur} onChange={(e) => onChange(e.target.value)}
             placeholder={placeholder} aria-label={placeholder} className="form-control" />
      {valeur && (
        <button type="button" className="btn btn-icone btn-icone-sm champ-recherche-effacer"
                onClick={() => onChange('')} aria-label="Effacer la recherche">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
