/**
 * Emplacements gris animés affichés pendant le chargement, à la place d'une roue : la page garde
 * sa forme et le contenu apparaît sans saut de mise en page.
 */
export function Squelette({ largeur = '100%', hauteur = '0.875rem', className = '' }) {
  return <span className={`squelette ${className}`} style={{ width: largeur, height: hauteur }} aria-hidden="true" />;
}

/** Lignes de tableau en chargement (`colonnes` cellules par ligne). */
export function LignesSquelette({ colonnes = 5, lignes = 5 }) {
  return (
    <div className="lignes-squelette" role="status" aria-label="Chargement">
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="ligne-squelette">
          {Array.from({ length: colonnes }, (_, j) => (
            <Squelette key={j} largeur={j === 0 ? '70%' : `${45 + ((i + j) % 4) * 12}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
