import { Info } from 'lucide-react';
import { useModeDemo } from '../requetes';

// Rappel affiché en haut de l'écran sur la version de démonstration publique
export default function BandeauDemo() {
  const { data } = useModeDemo();
  if (!data?.demo) return null;
  return (
    <div className="bandeau-demo" role="status">
      <Info size={14} className="flex-shrink-0" />
      <span>Version de démonstration : les données sont réinitialisées chaque jour.</span>
    </div>
  );
}
