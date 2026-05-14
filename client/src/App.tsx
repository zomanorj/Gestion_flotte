/**
 * App.tsx
 * Composant racine de l'application Transport STTA.
 * Il configure le routeur principal et déclare les routes de l'application.
 * Pour l'instant (Sprint 0), une seule route pointe vers la page d'accueil.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AccueilPage from './pages/AccueilPage'

function App() {
  return (
    // BrowserRouter fournit le contexte de navigation à toute l'application
    <BrowserRouter>
      <Routes>
        {/* Route principale : page d'accueil */}
        <Route path="/" element={<AccueilPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
