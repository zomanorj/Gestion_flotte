import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './context/AuthContext';

// La page de connexion reste dans le fichier principal : c'est la première affichée
import Login from './pages/Login';
import { PAGES, PAGES_PLEIN_ECRAN } from './pages/registre';

import Sidebar    from './components/Sidebar';
import Navbar     from './components/Navbar';
import ErreurPage from './components/ErreurPage';

const ChargementPage = () => (
  <div className="d-flex justify-content-center align-items-center h-100" style={{ minHeight: '12rem' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Chargement de la page…</span>
    </div>
  </div>
);

/**
 * Cadre commun à toutes les pages connectées. Une seule instance pour toute la navigation :
 * la barre latérale et la barre du haut (badges, notifications temps réel) ne sont pas
 * recréées en changeant de page, y compris vers ou depuis la carte en plein écran.
 * Sous 992 px, la barre latérale devient un tiroir ouvert par le bouton menu.
 */
const AppLayout = () => {
  const { pathname } = useLocation();
  const pleinEcran = PAGES_PLEIN_ECRAN.has(pathname);
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Le tiroir se referme après un changement de page et avec la touche Échap
  useEffect(() => { setMenuOuvert(false); }, [pathname]);
  useEffect(() => {
    if (!menuOuvert) return undefined;
    const surTouche = (e) => { if (e.key === 'Escape') setMenuOuvert(false); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [menuOuvert]);

  return (
    <div className={`d-flex vh-100 overflow-hidden ${pleinEcran ? '' : 'bg-gray-100'}`}>
      <Sidebar ouvert={menuOuvert} onFermer={() => setMenuOuvert(false)} />
      <div className="d-flex flex-column flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
        <Navbar menuOuvert={menuOuvert} onMenu={() => setMenuOuvert(true)} />
        <main className={`flex-grow-1 ${pleinEcran ? 'overflow-hidden' : 'overflow-y-auto p-3 p-lg-4'}`}>
          <ErreurPage cle={pathname}>
            <Suspense fallback={<ChargementPage />}>
              <Outlet />
            </Suspense>
          </ErreurPage>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [bannerMsg, setBannerMsg] = useState('');

  useEffect(() => {
    const onReseau = () => setBannerMsg('Serveur inaccessible — vérifiez votre connexion.');
    const on500    = () => setBannerMsg('Erreur serveur (500) — réessayez dans un instant.');
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
        <div className="alert alert-danger m-0 text-center rounded-0 d-flex justify-content-between align-items-center px-4" role="alert">
          {bannerMsg}
          <button type="button" className="btn-close" onClick={() => setBannerMsg('')} />
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
