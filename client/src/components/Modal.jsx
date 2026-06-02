import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, titre, children, taille = 'max-w-lg' }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidths = {
    'max-w-sm':  '24rem',
    'max-w-md':  '28rem',
    'max-w-lg':  '32rem',
    'max-w-xl':  '36rem',
    'max-w-2xl': '42rem',
  };
  const maxW = maxWidths[taille] || '32rem';

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
         style={{ zIndex: 1050 }}>
      {/* Overlay */}
      <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 backdrop-blur-sm"
           onClick={onClose} />

      {/* Contenu */}
      <div className="position-relative bg-white rounded-3 shadow-lg w-100 d-flex flex-column"
           style={{ maxWidth: maxW, maxHeight: '90vh' }}>
        {/* En-tête */}
        <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
          <h3 className="fs-6 fw-semibold text-gray-800 mb-0">{titre}</h3>
          <button onClick={onClose}
                  className="btn-close btn-sm"
                  aria-label="Fermer" />
        </div>

        {/* Corps */}
        <div className="overflow-y-auto flex-grow-1 px-4 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}
