import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { clientRequetes } from '../requetes/client';
import { fermerSocket, reconnecterSocket } from '../services/socket';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../services/socket', () => ({ fermerSocket: vi.fn(), reconnecterSocket: vi.fn() }));

const CHAUFFEUR = { id: 3, nom: 'Randria Paul', email: 'chauffeur@flotte.mg', role: 'chauffeur' };

const monter = async () => {
  const rendu = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(rendu.result.current.isLoading).toBe(false));
  return rendu.result;
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientRequetes.clear();
  });

  it('connexion : enregistre la session et renvoie le compte (redirection selon le rôle)', async () => {
    api.post.mockResolvedValue({ data: { token: 'jwt', user: CHAUFFEUR } });
    const auth = await monter();

    let reponse;
    await act(async () => { reponse = await auth.current.login('chauffeur@flotte.mg', 'password123'); });

    expect(reponse).toEqual({ success: true, user: CHAUFFEUR });
    expect(auth.current.user).toEqual(CHAUFFEUR);
    expect(localStorage.getItem('token')).toBe('jwt');
  });

  it('connexion : aucune donnée ni connexion temps réel du compte précédent ne subsiste', async () => {
    clientRequetes.setQueryData(['paie', 2026, 10], { fiches: ['du compte précédent'] });
    api.post.mockResolvedValue({ data: { token: 'jwt', user: CHAUFFEUR } });
    const auth = await monter();

    await act(() => auth.current.login('chauffeur@flotte.mg', 'password123'));

    expect(clientRequetes.getQueryData(['paie', 2026, 10])).toBeUndefined();
    expect(fermerSocket).toHaveBeenCalled();
  });

  it('connexion refusée : message de l’API, rien n’est enregistré', async () => {
    api.post.mockRejectedValue({ response: { status: 401, data: { message: 'Email ou mot de passe incorrect' } } });
    const auth = await monter();

    let reponse;
    await act(async () => { reponse = await auth.current.login('x@flotte.mg', 'faux'); });

    expect(reponse).toEqual({ success: false, message: 'Email ou mot de passe incorrect' });
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('déconnexion : session, cache et connexion temps réel effacés', async () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify(CHAUFFEUR));
    clientRequetes.setQueryData(['missions', 'miennes'], [{ id: 1 }]);
    const auth = await monter();
    expect(auth.current.user).toEqual(CHAUFFEUR);

    act(() => auth.current.logout());

    expect(auth.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(clientRequetes.getQueryData(['missions', 'miennes'])).toBeUndefined();
    expect(fermerSocket).toHaveBeenCalled();
  });

  it('nouveau token (changement de son mot de passe) : enregistré et temps réel reconnecté', async () => {
    const auth = await monter();

    act(() => auth.current.majToken('jwt-2'));

    expect(localStorage.getItem('token')).toBe('jwt-2');
    expect(reconnecterSocket).toHaveBeenCalled();
  });
});
