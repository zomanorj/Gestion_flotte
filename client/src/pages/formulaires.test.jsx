// Non-régression des formulaires : défauts corrigés qui ne doivent pas revenir
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  const ROUTES = {
    '/missions': PAGE_VIDE, '/vehicules': [CAMION], '/chauffeurs': [{ id: 2, nom: 'Rabe', prenom: 'Hery', statut: 'disponible' }],
    '/clients': [], '/parametres': [{ cle: 'prix_litre_gasoil', valeur: 5200 }],
  };

  it('création : villes et distance saisies, coût carburant estimé avec la consommation du camion', async () => {
    repondre(api.get, ROUTES);
    api.post.mockResolvedValue({ data: { id: 1 } });
    rendre(<Missions />);
    // La fenêtre est rendue dans document.body (portail), hors du conteneur de la page
    const champ = (nom) => document.querySelector(`[name=${nom}]`);

    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle mission/ }));
    await waitFor(() => expect(champ('vehicule_id').querySelectorAll('option').length).toBeGreaterThan(1));
    fireEvent.change(champ('titre'), { target: { value: 'Ciment Toamasina' } });
    fireEvent.change(champ('vehicule_id'), { target: { value: '4' } });
    fireEvent.change(champ('chauffeur_id'), { target: { value: '2' } });
    fireEvent.change(champ('lieu_destination'), { target: { value: 'Toamasina' } });
    fireEvent.change(champ('distance_km'), { target: { value: '350' } });
    fireEvent.change(champ('date_depart'), { target: { value: '2036-01-10T08:00' } });
    fireEvent.change(champ('date_retour_prevue'), { target: { value: '2036-01-11T18:00' } });

    // 350 km × 0,3 L/km × 5 200 Ar = 546 000 Ar
    expect(screen.getByText(/546\s000 Ar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Créer la mission' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/missions', expect.objectContaining({
      lieu_depart: 'Antananarivo', lieu_destination: 'Toamasina', distance_km: '350',
    })));
  });

  it('démarrage : passe la mission en cours par le changement de statut', async () => {
    const planifiee = { id: 5, titre: 'Riz Mahajanga', statut: 'planifiee', lieu_depart: 'Antananarivo',
                        lieu_destination: 'Mahajanga', distance_km: 570, date_depart: '2036-02-01T08:00:00' };
    repondre(api.get, { ...ROUTES, '/missions': { ...PAGE_VIDE, data: [planifiee], total: 1 } });
    api.put.mockResolvedValue({ data: { ...planifiee, statut: 'en_cours' } });
    connecter({ id: 2, nom: 'Rabe Marie', email: 'gestionnaire@flotte.mg', role: 'gestionnaire' });

    rendre(<Missions />);
    fireEvent.click(await screen.findByRole('button', { name: /Démarrer/ }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/missions/5/statut', { statut: 'en_cours' }));
    expect(api.post).not.toHaveBeenCalled();
  });
});
