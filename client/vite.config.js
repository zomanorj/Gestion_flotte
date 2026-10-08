import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite — proxy API pour éviter les problèmes CORS en développement
export default defineConfig({
  plugins: [react()],
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
