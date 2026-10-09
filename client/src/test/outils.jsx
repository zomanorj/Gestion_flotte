// Outils de test : rendu d'un composant avec les fournisseurs de l'application
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

/** Client de requêtes isolé par test, sans nouvelle tentative (les erreurs sont immédiates). */
export const nouveauClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
});

/** Utilisateur connecté, tel que l'application le garde dans localStorage. */
export function connecter(user = { id: 1, nom: 'Rakoto Jean', email: 'admin@flotte.mg', role: 'admin' }) {
  localStorage.setItem('token', 'token-de-test');
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

/** Rendu avec cache de requêtes, routeur (à l'adresse `route`, mêmes options que main.jsx) et authentification. */
export function rendre(ui, { route = '/', client = nouveauClient() } = {}) {
  const resultat = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...resultat, client };
}

/**
 * Réponses de `api.get` (simulé avec vi.mock) selon le chemin demandé.
 * Un objet `{ status, message }` produit une erreur HTTP de ce code, au format de l'API.
 */
export function repondre(mock, routes) {
  mock.mockImplementation((chemin) => {
    if (!(chemin in routes)) return Promise.reject(new Error(`Route non simulée : ${chemin}`));
    const valeur = routes[chemin];
    if (valeur && valeur.status) {
      return Promise.reject({ response: { status: valeur.status, data: { message: valeur.message } } });
    }
    return Promise.resolve({ data: typeof valeur === 'function' ? valeur() : valeur });
  });
}
