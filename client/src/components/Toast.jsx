import { useCallback, useEffect, useRef, useState } from 'react';
import { Truck, AlertTriangle } from 'lucide-react';

export function Toast({ message, sousTitre, onClose, duree = 4000, erreur = false }) {
  // La minuterie démarre à l'affichage et ne repart pas de zéro quand onClose change d'identité
  const fermer = useRef(onClose);
  fermer.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => fermer.current(), duree);
    return () => clearTimeout(t);
  }, [duree]);

  return (
    <div className="bg-slate-900 text-white rounded-3 shadow-lg p-3
                    d-flex align-items-start gap-3 animate-slide-in border border-slate-700"
         style={{ minWidth: '18rem', maxWidth: '24rem' }}>
      <div className={`rounded-circle p-2 flex-shrink-0 ${erreur ? 'bg-danger' : 'bg-orange-500'}`}>
        {erreur
          ? <AlertTriangle size={16} />
          : <Truck size={16} />
        }
      </div>
      <div className="flex-grow-1 min-w-0">
        <p className="fw-bold small mb-0">{message}</p>
        {sousTitre && (
          <p className="text-slate-400 text-xs mt-1 mb-0">{sousTitre}</p>
        )}
      </div>
      <button onClick={onClose}
              className="btn-close btn-close-white btn-sm flex-shrink-0"
              style={{ filter: 'invert(0.4)' }} />
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const ajouterToast = useCallback((message, sousTitre, erreur = false) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, sousTitre, erreur }]);
  }, []);

  const supprimerToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Composant de même identité d'un rendu à l'autre : un nouveau rendu de la page (saisie au
  // clavier…) ne recrée pas les toasts affichés, dont la minuterie continue. Il lit la liste
  // courante dans une ref, mise à jour à chaque rendu de la page.
  const actuels = useRef(toasts);
  actuels.current = toasts;
  const [ToastContainer] = useState(() => function ToastContainer() {
    return (
      <div className="position-fixed bottom-0 end-0 p-4 d-flex flex-column gap-2 pointer-events-none"
           style={{ zIndex: 1100 }}>
        {actuels.current.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast
              message={t.message}
              sousTitre={t.sousTitre}
              erreur={t.erreur}
              onClose={() => supprimerToast(t.id)}
            />
          </div>
        ))}
      </div>
    );
  });

  return { ajouterToast, ToastContainer };
}
