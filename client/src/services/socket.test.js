import { io } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fermerSocket, obtenirSocket, reconnecterSocket } from './socket';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
}));

describe('connexion temps réel partagée', () => {
  beforeEach(() => {
    fermerSocket();
    io.mockClear();
  });

  it('ouvre une seule connexion pour toute la session', () => {
    expect(obtenirSocket()).toBe(obtenirSocket());
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('envoie le token courant à chaque (re)connexion', () => {
    obtenirSocket();
    const { auth } = io.mock.calls[0][1];
    const lire = () => new Promise((ok) => auth(ok));

    localStorage.setItem('token', 'ancien');
    return lire().then((a) => {
      expect(a).toEqual({ token: 'ancien' });
      localStorage.setItem('token', 'nouveau');   // ex. après un changement de mot de passe
      return lire();
    }).then((a) => expect(a).toEqual({ token: 'nouveau' }));
  });

  it('se reconnecte quand un nouveau token est reçu', () => {
    const socket = obtenirSocket();
    reconnecterSocket();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalled();
  });

  it('est fermée à la déconnexion, puis rouverte pour le compte suivant', () => {
    const premiere = obtenirSocket();
    fermerSocket();
    expect(premiere.disconnect).toHaveBeenCalled();
    expect(obtenirSocket()).not.toBe(premiere);
  });

  it('ne fait rien sans connexion ouverte', () => {
    expect(() => reconnecterSocket()).not.toThrow();
    expect(io).not.toHaveBeenCalled();
  });
});
