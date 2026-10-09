import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const LARGEURS = { sm: '26rem', md: '32rem', lg: '40rem', xl: '48rem' };
// Anciennes valeurs de `taille` (classes de largeur), encore acceptées
const ALIAS = { 'max-w-sm': 'sm', 'max-w-md': 'md', 'max-w-lg': 'md', 'max-w-xl': 'lg', 'max-w-2xl': 'xl' };
const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fenêtre modale unique de l'application.
 * - au-dessus de toute la page (portail), fond assombri, courte animation d'ouverture ;
 * - Échap ou clic sur le fond la ferme ; Tab reste dans la fenêtre ;
 * - à l'ouverture, le premier champ reçoit le focus ; à la fermeture, il revient où il était.
 * `pied` : boutons alignés en bas (souvent Annuler / Enregistrer), hors de la zone qui défile.
 */
export default function Modal({ isOpen, onClose, titre, description, children, pied, taille = 'md' }) {
  const fenetre = useRef(null);
  const fermer = useRef(onClose);
  fermer.current = onClose;
  const idTitre = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const precedent = document.activeElement;
    const champ = fenetre.current?.querySelector('input, select, textarea') || fenetre.current;
    champ?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';

    const touche = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer.current?.(); return; }
      if (e.key !== 'Tab' || !fenetre.current) return;
      const elements = [...fenetre.current.querySelectorAll(FOCALISABLES)];
      if (elements.length === 0) return;
      const premier = elements[0], dernier = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('keydown', touche);
      document.body.style.overflow = '';
      precedent?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modale-conteneur">
      <div className="modale-fond" onClick={onClose} aria-hidden="true" />
      <div ref={fenetre} className="modale" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}
           style={{ maxWidth: LARGEURS[ALIAS[taille] || taille] || LARGEURS.md }}>
        <div className="modale-entete">
          <div className="min-w-0">
            <h2 id={idTitre} className="modale-titre">{titre}</h2>
            {description && <p className="modale-description">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn btn-icone btn-icone-sm" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="modale-corps">{children}</div>
        {pied && <div className="modale-pied">{pied}</div>}
      </div>
    </div>,
    document.body,
  );
}
