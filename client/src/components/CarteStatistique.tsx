/**
 * CarteStatistique.tsx
 * Composant réutilisable pour afficher une statistique clé sur le tableau de bord.
 * Accepte un titre, une valeur numérique, une icône et une couleur de badge.
 */

interface CarteStatistiqueProps {
  titre: string   // Libellé de la statistique (ex: "Véhicules actifs")
  valeur: string  // Valeur affichée (ex: "12")
  icone: string   // Emoji ou icône représentant la statistique
  couleur: string // Classes Tailwind pour la couleur du badge (bg + text)
}

function CarteStatistique({ titre, valeur, icone, couleur }: CarteStatistiqueProps) {
  return (
    <div className="card flex items-center gap-4">
      {/* Icône dans un badge coloré */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${couleur}`}>
        {icone}
      </div>

      {/* Valeur et libellé */}
      <div>
        <p className="text-2xl font-bold text-stta-bleu">{valeur}</p>
        <p className="text-sm text-gray-500">{titre}</p>
      </div>
    </div>
  )
}

export default CarteStatistique
