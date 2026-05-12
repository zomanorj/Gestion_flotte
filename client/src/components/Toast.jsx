// Composant Toast — notifications temporaires en bas à droite
import { useEffect, useState } from 'react';
import { Truck, X, AlertTriangle } from 'lucide-react';

/**
 * Toast individuel qui se ferme automatiquement.
 * @param {string}   message  - Titre principal du toast
 * @param {string}   sousTitre - Texte secondaire (optionnel)
 * @param {Function} onClose  - Appelée à la fermeture
 * @param {number}   duree    - Durée d'affichage en ms (défaut : 4000)
 * @param {boolean}  erreur   - Style rouge si true
 */
export function Toast({ message, sousTitre, onClose, duree = 4000, erreur = false }) {
  useEffect(() => {
    const t = setTimeout(onClose, duree);
    return () => clearTimeout(t);
  }, [onClose, duree]);

  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-4
                    flex items-start gap-3 min-w-72 max-w-sm
                    animate-slide-in border border-slate-700">
      <div className={`rounded-full p-2 mt-0.5 flex-shrink-0 ${erreur ? 'bg-red-500' : 'bg-orange-500'}`}>
        {erreur
          ? <AlertTriangle className="w-[18px] h-[18px]" />
          : <Truck className="w-[18px] h-[18px]" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{message}</p>
        {sousTitre && (
          <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{sousTitre}</p>
        )}
      </div>
      <button onClick={onClose}
        className="text-slate-500 hover:text-white flex-shrink-0 mt-0.5 transition-colors">
        <X className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}

/**
 * Hook pour gérer plusieurs toasts simultanément.
 * Retourne : { ajouterToast, ToastContainer }
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const ajouterToast = (message, sousTitre, erreur = false) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, sousTitre, erreur }]);
  };

  const supprimerToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const ToastContainer = () => (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
      {toasts.map(t => (
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

  return { ajouterToast, ToastContainer };
}
