import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite — proxy API pour éviter les problèmes CORS en développement
// Découpage du build : les bibliothèques stables sont dans des fichiers séparés, gardés en cache
// par le navigateur tant que leurs versions ne changent pas (le code de l'application, lui, change
// à chaque déploiement). Les autres dépendances suivent les pages qui les utilisent.
const GROUPES = {
  'socle-react': ['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler', '@remix-run/router'],
  // Partagés par plusieurs pages : un fichier commun plutôt qu'hébergés dans la première page qui les utilise
  'graphiques':  ['chart.js', 'react-chartjs-2', '@kurkle/color'],
  'icones':      ['lucide-react'],
  'donnees':     ['@tanstack/react-query', '@tanstack/query-core'],
};

function decouperEnFichiers(id) {
  const module = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1];
  return module && Object.keys(GROUPES).find((groupe) => GROUPES[groupe].includes(module));
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: decouperEnFichiers }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      // Socket.io (polling + websocket) — l'en-tête Origin est conservé pour le contrôle CORS
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true
      }
    }
  }
});
