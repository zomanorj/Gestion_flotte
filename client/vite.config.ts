import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.png'],
  build: {
    outDir:    'dist',
    sourcemap: false,    // Désactivé en prod (taille réduite)
  },
})
