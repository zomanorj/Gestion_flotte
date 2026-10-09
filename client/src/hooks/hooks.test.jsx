import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obtenirSocket } from '../services/socket';
import { useDiffere } from './useDiffere';
import { useEvenement } from './useEvenement';

vi.mock('../services/socket', () => ({ obtenirSocket: vi.fn() }));

describe('useDiffere', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ne transmet la valeur qu’après 300 ms sans changement', () => {
    const { result, rerender } = renderHook(({ v }) => useDiffere(v), { initialProps: { v: '' } });

    rerender({ v: 'M' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ v: 'Me' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('');   // la frappe continue : rien n'est encore transmis

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('Me');
  });
});

describe('useEvenement', () => {
  /** Socket factice : garde les abonnements pour simuler la réception d'un événement. */
  function socketFactice() {
    const abonnes = {};
    return {
      abonnes,
      on: vi.fn((nom, f) => { (abonnes[nom] ??= []).push(f); }),
      off: vi.fn((nom, f) => { abonnes[nom] = abonnes[nom].filter((g) => g !== f); }),
      recevoir: (nom, donnees) => (abonnes[nom] || []).forEach((f) => f(donnees)),
    };
  }

  it('appelle la dernière version du gestionnaire, sans réabonnement à chaque rendu', () => {
    const socket = socketFactice();
    obtenirSocket.mockReturnValue(socket);
    const recus = [];
    const { rerender } = renderHook(({ suffixe }) => useEvenement('mission:statut', (d) => recus.push(d + suffixe)),
      { initialProps: { suffixe: '-a' } });

    rerender({ suffixe: '-b' });
    socket.recevoir('mission:statut', 'x');

    expect(recus).toEqual(['x-b']);
    expect(socket.on).toHaveBeenCalledTimes(1);
  });

  it('se désabonne au démontage', () => {
    const socket = socketFactice();
    obtenirSocket.mockReturnValue(socket);
    const gestionnaire = vi.fn();
    const { unmount } = renderHook(() => useEvenement('flotte:positions', gestionnaire));

    unmount();
    socket.recevoir('flotte:positions', []);

    expect(gestionnaire).not.toHaveBeenCalled();
    expect(socket.abonnes['flotte:positions']).toEqual([]);
  });

  it('ne s’abonne pas sans nom d’événement', () => {
    obtenirSocket.mockClear();
    renderHook(() => useEvenement(null, vi.fn()));
    expect(obtenirSocket).not.toHaveBeenCalled();
  });
});
