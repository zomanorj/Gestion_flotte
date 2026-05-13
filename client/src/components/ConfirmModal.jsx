// Modal de confirmation stylisé — remplace tous les window.confirm() du projet
import { useState, useRef } from 'react';
import { AlertTriangle, Trash2, Edit, CheckCircle, X } from 'lucide-react';

// Configuration visuelle par type d'action
const TYPES = {
  supprimer: {
    Icone:         Trash2,
    couleurIcone:  'text-red-500',
    couleurBg:     'bg-red-50',
    couleurBouton: 'bg-red-500 hover:bg-red-600',
    titre:         'Confirmer la suppression',
    texteBtn:      'Supprimer définitivement'
  },
  modifier: {
    Icone:         Edit,
    couleurIcone:  'text-blue-500',
    couleurBg:     'bg-blue-50',
    couleurBouton: 'bg-blue-500 hover:bg-blue-600',
    titre:         'Confirmer la modification',
    texteBtn:      'Enregistrer'
  },
  attention: {
    Icone:         AlertTriangle,
    couleurIcone:  'text-orange-500',
    couleurBg:     'bg-orange-50',
    couleurBouton: 'bg-orange-500 hover:bg-orange-600',
    titre:         'Attention',
    texteBtn:      'Confirmer'
  },
  regler: {
    Icone:         CheckCircle,
    couleurIcone:  'text-green-500',
    couleurBg:     'bg-green-50',
    couleurBouton: 'bg-green-500 hover:bg-green-600',
    titre:         'Marquer comme réglé',
    texteBtn:      'Marquer réglé'
  }
};

/**
 * Modal de confirmation avec header coloré, liste des conséquences et bouton d'action.
 * @param {boolean}  isOpen       - Affiche/masque le modal
 * @param {Function} onClose      - Appelée au clic Annuler ou fond
 * @param {Function} onConfirm    - Appelée au clic bouton principal
 * @param {string}   type         - 'supprimer'|'modifier'|'attention'|'regler'
 * @param {string}   titre        - Remplace le titre par défaut du type
 * @param {string}   element      - Nom de l'entité concernée (affiché en gras)
 * @param {string[]} consequences - Liste des conséquences à afficher
 * @param {boolean}  loading      - Désactive les boutons et affiche un spinner
 */
export default function ConfirmModal({
  isOpen, onClose, onConfirm,
  type = 'supprimer', titre, element, consequences, loading = false
}) {
  if (!isOpen) return null;
  const cfg = TYPES[type] || TYPES.supprimer;
  const { Icone } = cfg;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header coloré */}
        <div className={`${cfg.couleurBg} p-6 flex items-start gap-4`}>
          <div className={`${cfg.couleurIcone} mt-0.5 shrink-0`}>
            <Icone size={28} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-lg">{titre || cfg.titre}</h3>
            {element && (
              <p className="text-gray-600 mt-1">
                <span className="font-semibold text-gray-900">"{element}"</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Liste des conséquences */}
        {consequences?.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Conséquences</p>
            <ul className="space-y-1.5">
              {consequences.map((c, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Boutons */}
        <div className="p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600
                       font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-white font-medium
                        flex items-center gap-2 transition-all
                        ${cfg.couleurBouton}
                        ${loading
                          ? 'opacity-50 cursor-not-allowed'
                          : 'shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
                        }`}
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {cfg.texteBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook useConfirm — gère un ConfirmModal via une Promise.
 *
 * Usage :
 *   const { confirmer, ConfirmModalComponent } = useConfirm()
 *   const ok = await confirmer({ type:'supprimer', element:'Camion MAD-001', consequences:[...] })
 *   if (!ok) return
 *   // ... action confirmée
 *   return <div>...<ConfirmModalComponent /></div>
 */
export function useConfirm() {
  const [config,   setConfig]   = useState(null);
  const resolveRef = useRef(null);

  const confirmer = (options) =>
    new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfig({ ...options, isOpen: true, loading: false });
    });

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setConfig(null);
  };

  const handleClose = () => {
    resolveRef.current?.(false);
    setConfig(null);
  };

  const ConfirmModalComponent = () =>
    config ? (
      <ConfirmModal {...config} onConfirm={handleConfirm} onClose={handleClose} />
    ) : null;

  return { confirmer, ConfirmModalComponent };
}
