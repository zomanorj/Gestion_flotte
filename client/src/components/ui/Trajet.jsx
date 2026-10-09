import { ArrowRight } from 'lucide-react';

/** Départ et destination d'une mission, séparés par une flèche (icône, pas un caractère). */
export default function Trajet({ depart, destination, className = '' }) {
  return (
    <span className={`trajet ${className}`}>
      <span>{depart}</span>
      <ArrowRight size={13} aria-label="vers" className="flex-shrink-0" />
      <span>{destination}</span>
    </span>
  );
}
