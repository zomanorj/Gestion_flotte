import { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { ProtectedRoute } from './context/AuthContext';

// La page de connexion reste dans le fichier principal : c'est la première affichée
import Login from './pages/Login';
import { PAGES } from './pages/registre';
import { emplacement } from './navigation';

import Sidebar    from './components/Sidebar';
import Navbar     from './components/Navbar';
import ErreurPage from './components/ErreurPage';

const ChargementPage = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '12rem' }}>
    <div className="spinner-border spinner-border-sm text-secondary" role="status">
      <span className="visually-hidden">Chargement de la page…</span>
    </div>
  </div>
);

/**
 * Cadre commun à toutes les pages connectées. Une seule instance pour toute la navigation :
 * la barre latérale et la barre du haut (badges, notifications temps réel) ne sont pas
 * recréées en changeant de page.
 * Sous 992 px, la barre latérale devient un tiroir ouvert par le bouton menu.
 */
const AppLayout = () => {
  const { pathname } = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Le tiroir se referme après un changement de page et avec la touche Échap ;
  // le titre de l'onglet suit la page (« Véhicules · TransiFlow »)
  useEffect(() => {
    setMenuOuvert(false);
    const page = emplacement(pathname)?.page;
    document.title = page ? `${page} · TransiFlow` : 'TransiFlow';
  }, [pathname]);
  useEffect(() => {
    if (!menuOuvert) return undefined;
    const surTouche = (e) => { if (e.key === 'Escape') setMenuOuvert(false); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [menuOuvert]);

  return (
    <div className="d-flex vh-100 overflow-hidden bg-body">
      <Sidebar ouvert={menuOuvert} onFermer={() => setMenuOuvert(false)} />
      <div className="d-flex flex-column flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
        <Navbar menuOuvert={menuOuvert} onMenu={() => setMenuOuvert(true)} />
        <main className="flex-grow-1 overflow-y-auto">
          {/* Largeur de lecture limitée sur grand écran ; courte entrée à chaque changement de page */}
          <div key={pathname} className="contenu entree-page">
            <ErreurPage cle={pathname}>
              <Suspense fallback={<ChargementPage />}>
                <Outlet />
              </Suspense>
            </ErreurPage>
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [bannerMsg, setBannerMsg] = useState('');

  useEffect(() => {
    const onReseau = () => setBannerMsg('Serveur injoignable. Vérifiez votre connexion internet.');
    const on500    = () => setBannerMsg('Le serveur a rencontré une erreur. Réessayez dans un instant.');
    window.addEventListener('api:reseau',    onReseau);
    window.addEventListener('api:erreur500', on500);
    return () => {
      window.removeEventListener('api:reseau',    onReseau);
      window.removeEventListener('api:erreur500', on500);
    };
  }, []);

  return (
    <>
      {bannerMsg && (
        <div className="bandeau-erreur" role="alert">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span className="flex-grow-1">{bannerMsg}</span>
          <button type="button" className="btn btn-icone btn-icone-sm text-white" onClick={() => setBannerMsg('')} aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
      )}
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          {PAGES.map(({ chemin, Composant }) => (
            <Route key={chemin} path={chemin} element={<Composant />} />
          ))}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
