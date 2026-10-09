/** Liste ou page sans contenu : icône discrète, message, et action éventuelle. */
export default function EtatVide({ Icone, titre, description, action }) {
  return (
    <div className="etat-vide">
      {Icone && <span className="etat-vide-icone"><Icone size={22} strokeWidth={1.75} /></span>}
      <p className="etat-vide-titre">{titre}</p>
      {description && <p className="etat-vide-description">{description}</p>}
      {action}
    </div>
  );
}
