import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api, { telechargerFichier } from '../services/api';
import { connecter, rendre, repondre } from '../test/outils';
import MesMissions from './MesMissions';

vi.mock('../services/api', () => ({ default: { get: vi.fn() }, telechargerFichier: vi.fn() }));

const mission = (id, statut, date_depart, extra = {}) => ({
  id, statut, date_depart, titre: `Mission ${id}`, date_retour_prevue: date_depart,
  lieu_depart: 'Antananarivo', lieu_destination: 'Toamasina', immatriculation: 'MAD-002-24',
  marque: 'Volvo', modele: 'FH16', distance_km: 350, ...extra,
});

const section = (titre) => screen.getByRole('heading', { name: new RegExp(`^${titre}`) }).closest('section');
const titres = (titre) => within(section(titre)).queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('Mes missions', () => {
  beforeEach(() => {
    connecter({ id: 3, nom: 'Randria Paul', email: 'chauffeur@flotte.mg', role: 'chauffeur' });
  });

  it('regroupe les missions : en cours, à venir (la plus proche d’abord), historique', async () => {
    repondre(api.get, { '/missions/miennes': [
      mission(1, 'planifiee', '2026-12-20T08:00:00'),
      mission(2, 'en_cours', '2026-10-08T08:00:00'),
      mission(3, 'planifiee', '2026-11-02T08:00:00'),
      mission(4, 'terminee', '2026-09-01T08:00:00'),
      mission(5, 'annulee', '2026-08-01T08:00:00'),
    ] });

    rendre(<MesMissions />);

    expect(await screen.findByText('1 en cours, 2 à venir')).toBeInTheDocument();
    expect(titres('En cours')).toEqual(['Mission 2']);
    expect(titres('À venir')).toEqual(['Mission 3', 'Mission 1']);
    expect(titres('Historique')).toEqual(['Mission 4', 'Mission 5']);
  });

  it('télécharge le bon de livraison de la mission', async () => {
    repondre(api.get, { '/missions/miennes': [mission(7, 'planifiee', '2026-11-02')] });
    rendre(<MesMissions />);

    fireEvent.click(await screen.findByRole('button', { name: /Bon de livraison/ }));

    expect(telechargerFichier).toHaveBeenCalledWith('/missions/7/bon-livraison', 'bon-livraison-7.pdf');
  });

  it('limite l’historique à 10 missions, extensible', async () => {
    const anciennes = Array.from({ length: 12 }, (_, i) => mission(100 + i, 'terminee', `2025-01-${String(i + 1).padStart(2, '0')}`));
    repondre(api.get, { '/missions/miennes': anciennes });

    rendre(<MesMissions />);

    await screen.findByText('Mission 100');
    expect(titres('Historique')).toHaveLength(10);
    expect(within(section('Historique')).getByText('(12)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Afficher les 12 missions' }));
    expect(titres('Historique')).toHaveLength(12);
  });

  it('explique au chauffeur que son compte n’est lié à aucune fiche', async () => {
    repondre(api.get, { '/missions/miennes': { status: 404, message: "Aucune fiche chauffeur n'est liée à ce compte" } });

    rendre(<MesMissions />);

    expect(await screen.findByText(/n'est lié à aucune fiche chauffeur/)).toBeInTheDocument();
  });
});
