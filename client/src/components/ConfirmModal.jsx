import { useState, useRef } from 'react';
import { AlertTriangle, Trash2, Edit, CheckCircle, X } from 'lucide-react';

const TYPES = {
  supprimer: {
    Icone:         Trash2,
    couleurIcone:  'text-danger',
    couleurBg:     'bg-red-50',
    couleurBouton: 'btn-danger',
    titre:         'Confirmer la suppression',
    texteBtn:      'Supprimer définitivement'
  },
  modifier: {
    Icone:         Edit,
    couleurIcone:  'text-primary',
    couleurBg:     'bg-blue-50',
    couleurBouton: 'btn-primary',
    titre:         'Confirmer la modification',
    texteBtn:      'Enregistrer'
  },
  attention: {
    Icone:         AlertTriangle,
    couleurIcone:  'text-orange-500',
    couleurBg:     'bg-orange-50',
    couleurBouton: 'btn-warning',
    titre:         'Attention',
    texteBtn:      'Confirmer'
  },
  regler: {
    Icone:         CheckCircle,
    couleurIcone:  'text-success',
    couleurBg:     'bg-green-50',
    couleurBouton: 'btn-success',
    titre:         'Marquer comme réglé',
    texteBtn:      'Marquer réglé'
  }
};

export default function ConfirmModal({
  isOpen, onClose, onConfirm,
  type = 'supprimer', titre, element, consequences, loading = false
}) {
  if (!isOpen) return null;
  const cfg = TYPES[type] || TYPES.supprimer;
  const { Icone } = cfg;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
         style={{ zIndex: 1060, backgroundColor: 'rgba(0,0,0,0.6)' }}
         onClick={onClose}>
      <div className="bg-white rounded-3 shadow-lg overflow-hidden"
           style={{ maxWidth: '28rem', width: '100%' }}
           onClick={e => e.stopPropagation()}>

        {/* Header coloré */}
        <div className={`${cfg.couleurBg} p-4 d-flex align-items-start gap-3`}>
          <div className={`${cfg.couleurIcone} flex-shrink-0 mt-1`}>
            <Icone size={28} />
          </div>
          <div className="flex-grow-1">
            <h3 className="fw-bold text-dark fs-6 mb-0">{titre || cfg.titre}</h3>
            {element && (
              <p className="text-gray-600 mt-1 mb-0">
                <span className="fw-semibold text-dark">"{element}"</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="btn-close" />
        </div>

        {/* Conséquences */}
        {consequences?.length > 0 && (
          <div className="px-4 py-3 bg-light border-top border-bottom">
            <p className="text-xs fw-semibold text-gray-400 text-uppercase mb-2">Conséquences</p>
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
              {consequences.map((c, i) => (
                <li key={i} className="small text-gray-600 d-flex align-items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0">•</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Boutons */}
        <div className="p-4 d-flex gap-3 justify-content-end">
          <button onClick={onClose} disabled={loading}
                  className="btn btn-outline-secondary px-4">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading}
                  className={`btn ${cfg.couleurBouton} px-4 d-flex align-items-center gap-2`}>
            {loading && (
              <span className="spinner-border spinner-border-sm" role="status" />
            )}
            {cfg.texteBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

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
