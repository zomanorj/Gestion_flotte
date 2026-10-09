import { useEffect, useState } from 'react';

/**
 * Valeur mise à jour seulement après `delai` ms sans changement : une recherche saisie au
 * clavier déclenche une requête à la fin de la frappe, pas une par touche.
 */
export function useDiffere(valeur, delai = 300) {
  const [differee, setDifferee] = useState(valeur);
  useEffect(() => {
    const minuteur = setTimeout(() => setDifferee(valeur), delai);
    return () => clearTimeout(minuteur);
  }, [valeur, delai]);
  return differee;
}
