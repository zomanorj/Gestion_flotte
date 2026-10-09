// Non-régression des formulaires : défauts corrigés qui ne doivent pas revenir
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { connecter, rendre, repondre } from '../test/outils';
import Maintenances from './Maintenances';
import Missions from './Missions';
import Vehicules from './Vehicules';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  telechargerFichier: vi.fn(),
}));

const PAGE_VIDE = { data: [], total: 0, page: 1, pages: 1, limit: 20 };
const CAMION = { id: 4, immatriculation: 'MAD-004-24', marque: 'Scania', modele: 'R500', statut: 'disponible',
                 consommation_litre_km: 0.3 };

beforeEach(() => {
  vi.clearAllMocks();
  connecter();
});

describe('Véhicules', () => {
  it('ajout d’un camion : enregistré, fenêtre fermée, sans erreur JavaScript', async () => {
    repondre(api.get, { '/vehicules': PAGE_VIDE });
    api.post.mockResolvedValue({ data: { id: 9 } });
    // Erreur levée après l'enregistrement (ex. setLoading supprimé mais encore appelé) : promesse rejetée
    // sans gestionnaire, que seul Node voit sous jsdom
    const erreurs = [];
    const surErreur = (raison) => erreurs.push(raison);
    process.on('unhandledRejection', surErreur);

    rendre(<Vehicules />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un camion/ }));
    fireEvent.change(screen.getByPlaceholderText('MAD-001-24'), { target: { value: 'MAD-009-26' } });
    fireEvent.change(screen.getByPlaceholderText('Mercedes'), { target: { value: 'Isuzu' } });
    fireEvent.change(screen.getByPlaceholderText('Actros'), { target: { value: 'FVR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => expect(screen.queryByPlaceholderText('MAD-001-24')).toBeNull());
    await new Promise((ok) => setTimeout(ok, 0));
    process.off('unhandledRejection', surErreur);

    expect(api.post).toHaveBeenCalledWith('/vehicules', expect.objectContaining({ immatriculation: 'MAD-009-26' }));
    expect(erreurs).toEqual([]);
  });
});

describe('Maintenances', () => {
  it('la saisie au clavier garde le focus et tout le texte tapé', async () => {
    repondre(api.get, { '/maintenances': PAGE_VIDE, '/maintenances/alertes': [], '/vehicules': [CAMION] });
    const utilisateur = userEvent.setup();

    rendre(<Maintenances />);
    await utilisateur.click(await screen.findByRole('button', { name: /Planifier une maintenance/ }));
    const garage = screen.getByPlaceholderText('Ex : Garage Rakoto');
    await utilisateur.click(garage);
    await utilisateur.keyboard('Garage Rabe');

    expect(screen.getByPlaceholderText('Ex : Garage Rakoto')).toHaveValue('Garage Rabe');
    expect(screen.getByPlaceholderText('Ex : Garage Rakoto')).toHaveFocus();
  });
});

describe('Missions', () => {
  it('distance : une réponse d’itinéraire arrivée en retard n’écrase pas le trajet choisi ensuite', async () => {
    repondre(api.get, {
      '/missions': PAGE_VIDE, '/vehicules': [CAMION], '/chauffeurs': [], '/clients': [],
      '/simulation/villes': { villes: ['Antananarivo', 'Toamasina', 'Antsirabe'] },
      '/parametres': [{ cle: 'prix_litre_gasoil', valeur: 5200 }],
    });
    // Réponses du calcul d'itinéraire contrôlées à la main, pour les faire arriver dans le désordre
    const enAttente = {};
    api.post.mockImplementation((chemin, corps) => new Promise((ok) => { enAttente[corps.villeArrivee] = ok; }));

    const { container } = rendre(<Missions />);
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle mission/ }));
    await waitFor(() => expect(container.querySelectorAll('select[name=lieu_destination] option').length).toBeGreaterThan(1));
    fireEvent.change(container.querySelector('select[name=lieu_depart]'), { target: { value: 'Antananarivo' } });
    fireEvent.change(container.querySelector('select[name=lieu_destination]'), { target: { value: 'Toamasina' } });
    fireEvent.change(container.querySelector('select[name=lieu_destination]'), { target: { value: 'Antsirabe' } });

    // Antsirabe (demandée en dernier) répond d'abord, puis l'ancienne demande vers Toamasina
    await act(async () => { enAttente.Antsirabe({ data: { distanceKm: 170, dureeMin: 180 } }); });
    await act(async () => { enAttente.Toamasina({ data: { distanceKm: 350, dureeMin: 420 } }); });

    expect(screen.getByText('170 km')).toBeInTheDocument();
    expect(screen.queryByText('350 km')).toBeNull();
  });
});
