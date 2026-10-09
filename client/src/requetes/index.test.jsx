import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { nouveauClient } from '../test/outils';
import { DEPENDANCES, useEcriture, useRafraichir, useVehicules } from '.';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const enveloppe = (client) => function Fournisseur({ children }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

/** Cache pré-rempli d'une donnée par domaine, pour observer lesquelles sont invalidées. */
function cacheRempli() {
  const client = nouveauClient();
  const domaines = [...new Set(Object.values(DEPENDANCES).flat())];
  domaines.forEach((d) => client.setQueryData([d, 'liste', {}], ['donnée']));
  const invalides = () => domaines.filter((d) => client.getQueryState([d, 'liste', {}]).isInvalidated);
  return { client, invalides };
}

describe('useEcriture', () => {
  it('rafraîchit, après succès, tous les domaines qui dépendent des missions', async () => {
    const { client, invalides } = cacheRempli();
    const { result } = renderHook(() => useEcriture('missions', () => Promise.resolve('ok')),
      { wrapper: enveloppe(client) });

    await act(() => result.current.mutateAsync());

    expect(invalides().sort()).toEqual([...DEPENDANCES.missions].sort());
    expect(invalides()).not.toContain('carburant');
  });

  it('ne rafraîchit rien quand l’écriture échoue', async () => {
    const { client, invalides } = cacheRempli();
    const { result } = renderHook(() => useEcriture('missions', () => Promise.reject(new Error('refus'))),
      { wrapper: enveloppe(client) });

    await act(() => result.current.mutateAsync().catch(() => {}));

    expect(invalides()).toEqual([]);
  });

  it('appelle le onSuccess de la page après le rafraîchissement', async () => {
    const { client } = cacheRempli();
    const ordre = [];
    const espion = vi.spyOn(client, 'invalidateQueries').mockImplementation(async () => { ordre.push('rafraîchi'); });
    const { result } = renderHook(
      () => useEcriture('carburant', () => Promise.resolve(), { onSuccess: () => ordre.push('page') }),
      { wrapper: enveloppe(client) },
    );

    await act(() => result.current.mutateAsync());

    expect(espion).toHaveBeenCalledWith({ queryKey: ['carburant'] });
    expect(ordre).toEqual(['rafraîchi', 'page']);
  });
});

describe('useRafraichir', () => {
  it('invalide les domaines demandés (événements temps réel)', async () => {
    const { client, invalides } = cacheRempli();
    const { result } = renderHook(() => useRafraichir(), { wrapper: enveloppe(client) });

    await act(() => result.current('notifications', 'documents'));

    expect(invalides().sort()).toEqual(['documents', 'notifications']);
  });
});

describe('listes', () => {
  beforeEach(() => { api.get.mockReset(); });

  it('ignore les filtres vides : même requête et même cache pour {statut: ""} et {}', async () => {
    api.get.mockResolvedValue({ data: [{ id: 1 }] });
    const client = nouveauClient();
    const { result } = renderHook(() => useVehicules({ statut: '', search: 'Volvo' }), { wrapper: enveloppe(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/vehicules', { params: { search: 'Volvo' } });
    expect(client.getQueryData(['vehicules', 'liste', { search: 'Volvo' }])).toEqual([{ id: 1 }]);
  });

  it('demande la pagination à l’API pour une liste paginée', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0, page: 2, pages: 1, limit: 15 } });
    const { result } = renderHook(() => useVehicules({ page: 2, limit: 15 }, { pagine: true }),
      { wrapper: enveloppe(nouveauClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/vehicules', { params: { page: 2, limit: 15, paginate: 'true' } });
  });
});
