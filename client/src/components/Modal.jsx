// Composant Modal réutilisable avec overlay
import React, { useEffect } from 'react';

/**
 * Fenêtre modale générique.
 * @param {boolean} isOpen   - Contrôle la visibilité
 * @param {Function} onClose - Appelée à la fermeture
 * @param {string} titre     - Titre affiché dans l'en-tête
 * @param {ReactNode} children - Contenu du corps
 * @param {string} taille    - Classe Tailwind de largeur max (défaut : 'max-w-lg')
 */
export default function Modal({ isOpen, onClose, titre, children, taille = 'max-w-lg' }) {
  // Fermeture avec la touche Échap
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Blocage du scroll du body quand la modale est ouverte
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay sombre — clic pour fermer */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Contenu de la modale */}
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${taille} max-h-[90vh] flex flex-col`}>
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">{titre}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
                       text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
