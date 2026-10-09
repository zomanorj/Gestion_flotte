import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Remplace une page qui plante (erreur d'affichage, fichier de page introuvable) par un message
 * et un bouton de rechargement, au lieu d'un écran blanc. La barre latérale reste utilisable :
 * changer de page efface l'erreur (prop `cle`).
 */
export default class ErreurPage extends React.Component {
  state = { erreur: null };

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    console.error('Erreur dans la page :', erreur, info?.componentStack);
  }

  componentDidUpdate(precedentes) {
    if (precedentes.cle !== this.props.cle && this.state.erreur) this.setState({ erreur: null });
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className="d-flex flex-column align-items-center justify-content-center text-center gap-3 p-5">
        <div className="bg-red-100 rounded-circle p-3"><AlertTriangle size={28} className="text-red-600" /></div>
        <div>
          <h2 className="fs-5 fw-semibold mb-1">Cette page n'a pas pu s'afficher</h2>
          <p className="text-muted small mb-0">
            Une nouvelle version de l'application a peut-être été mise en ligne. Rechargez la page pour continuer.
          </p>
        </div>
        <button onClick={() => window.location.reload()} className="btn btn-primary d-flex align-items-center gap-2">
          <RotateCw size={16} /> Recharger
        </button>
      </div>
    );
  }
}
