import { useState, useRef } from 'react';
import Modal from './Modal';
import { AlertTriangle, Trash2, Edit, CheckCircle } from 'lucide-react';

const TYPES = {
  supprimer: {
    Icone:         Trash2,
    ton:           'ton-danger',
    couleurBouton: 'btn-danger',
    titre:         'Confirmer la suppression',
    texteBtn:      'Supprimer définitivement'
  },
  modifier: {
    Icone:         Edit,
    ton:           'icone-page',
    couleurBouton: 'btn-primary',
    titre:         'Confirmer la modification',
    texteBtn:      'Enregistrer'
  },
  attention: {
    Icone:         AlertTriangle,
    ton:           'ton-attention',
    couleurBouton: 'btn-primary',
    titre:         'Attention',
    texteBtn:      'Confirmer'
  },
  regler: {
    Icone:         CheckCircle,
    ton:           'ton-succes',
    couleurBouton: 'btn-primary',
    titre:         'Marquer comme réglé',
    texteBtn:      'Marquer réglé'
  }
};

/**
 * Confirmation d'une action (suppression, désactivation…) : titre, élément concerné, conséquences
 * listées, puis Annuler / confirmer. S'appuie sur la fenêtre modale commune (focus, Échap, animation).
 */
export default function ConfirmModal({
  isOpen, onClose, onConfirm,
  type = 'supprimer', titre, element, consequences, loading = false
}) {
  const cfg = TYPES[type] || TYPES.supprimer;
  const { Icone } = cfg;

  return (
    <Modal isOpen={isOpen} onClose={onClose} taille="sm"
           titre={<span className="d-flex align-items-center gap-2"><span className={`stat-icone ${cfg.ton}`}><Icone size={15} /></span>{titre || cfg.titre}</span>}
           pied={<>
             <button onClick={onClose} disabled={loading} className="btn btn-outline-secondary">Annuler</button>
             <button onClick={onConfirm} disabled={loading} className={`btn ${cfg.couleurBouton}`}>
               {loading && <span className="spinner-border spinner-border-sm" role="status" />}
               {cfg.texteBtn}
             </button>
           </>}>
      {element && <p className="fw-medium text-dark mb-2">{element}</p>}
      {consequences?.length > 0 && (
        <ul className="liste-consequences mb-0">
          {consequences.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
    </Modal>
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

  // Composant de même identité d'un rendu à l'autre (comme useToast) : un nouveau rendu de la page
  // pendant la confirmation ne recrée pas la fenêtre (qui reprendrait sinon le focus)
  const actuel = useRef();
  actuel.current = { config, handleConfirm, handleClose };
  const [ConfirmModalComponent] = useState(() => function ConfirmModalComponent() {
    const { config: c, handleConfirm: confirmer, handleClose: fermer } = actuel.current;
    return c ? <ConfirmModal {...c} onConfirm={confirmer} onClose={fermer} /> : null;
  });

  return { confirmer, ConfirmModalComponent };
}
