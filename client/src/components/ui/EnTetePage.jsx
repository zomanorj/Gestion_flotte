/**
 * En-tête commun à toutes les pages : titre (seul h1 de la page), description courte et actions
 * principales à droite. Sur téléphone, les actions passent sous le titre.
 */
export default function EnTetePage({ titre, description, actions }) {
  return (
    <header className="en-tete-page">
      <div className="min-w-0">
        <h1 className="titre-page">{titre}</h1>
        {description && <p className="description-page">{description}</p>}
      </div>
      {actions && <div className="actions-page">{actions}</div>}
    </header>
  );
}
