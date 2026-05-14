/**
 * tailwind.config.js
 * Configuration de Tailwind CSS pour le projet Transport STTA.
 * On indique à Tailwind où chercher les classes utilisées (purge)
 * et on étend le thème avec les couleurs de la charte graphique STTA.
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind analyse ces fichiers pour ne garder que les classes utilisées
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      // Palette de couleurs STTA
      colors: {
        stta: {
          bleu:       '#1E3A5F', // Bleu marine principal
          bleuClair:  '#2E6DA4', // Bleu pour les accents
          orange:     '#E87722', // Orange pour les actions importantes
          gris:       '#F4F6F9', // Fond des sections
          grisFonce:  '#6B7280', // Texte secondaire
        },
      },
      // Police de caractères personnalisée
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },

  plugins: [],
}

