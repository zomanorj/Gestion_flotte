import { useEffect, useState } from 'react';

/** Téléphone : en dessous du point de rupture `md` de Bootstrap. */
export const ECRAN_ETROIT = '(max-width: 767.98px)';

/** Vrai tant que la requête média est satisfaite (suit la rotation et le redimensionnement). */
export function useMediaQuery(requete) {
  const [satisfaite, setSatisfaite] = useState(() => window.matchMedia(requete).matches);

  useEffect(() => {
    const media = window.matchMedia(requete);
    const maj = () => setSatisfaite(media.matches);
    maj();
    media.addEventListener('change', maj);
    return () => media.removeEventListener('change', maj);
  }, [requete]);

  return satisfaite;
}
