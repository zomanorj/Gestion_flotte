import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { connecter, rendre, repondre } from '../test/outils';
import Sidebar from './Sidebar';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const ALERTES = {
  '/vehicules/alertes': [{ id: 1 }, { id: 2 }],
  '/documents/alertes': [],
  '/maintenances/alertes': [{ id: 9 }],
};
const lien = (nom) => screen.queryByRole('link', { name: new RegExp(nom) });

describe('Sidebar', () => {
  beforeEach(() => { repondre(api.get, ALERTES); });

  it('chauffeur : « Mes missions » en premier, ni paie, ni paramètres, ni utilisateurs', () => {
    connecter({ id: 3, nom: 'Randria Paul', email: 'chauffeur@flotte.mg', role: 'chauffeur' });
    rendre(<Sidebar />);

    expect(screen.getAllByRole('link')[0]).toHaveTextContent('Mes missions');
    expect(lien('Paie')).toBeNull();
    expect(lien('Paramètres')).toBeNull();
    expect(lien('Utilisateurs')).toBeNull();
  });

  it('admin : toutes les pages de gestion, sans « Mes missions »', () => {
    connecter();
    rendre(<Sidebar />);

    expect(lien('Paie')).toBeInTheDocument();
    expect(lien('Utilisateurs')).toBeInTheDocument();
    expect(lien('Mes missions')).toBeNull();
  });

  it('affiche le nombre d’alertes en badge', async () => {
    connecter();
    rendre(<Sidebar />);

    expect(await screen.findByText('2')).toBeInTheDocument();                       // véhicules
    expect(lien('Maintenances')).toHaveTextContent('1');
    expect(lien('Documents')).toHaveTextContent(/^Documents$/);                     // aucune alerte
  });

  it('tiroir : se ferme au choix d’un lien, même celui de la page affichée, et sur le voile', () => {
    connecter();
    const onFermer = vi.fn();
    const { container } = rendre(<Sidebar ouvert onFermer={onFermer} />, { route: '/vehicules' });

    expect(container.querySelector('#barre-laterale')).toHaveClass('ouverte');
    fireEvent.click(lien('Véhicules'));                                             // page déjà affichée
    fireEvent.click(container.querySelector('.voile-menu'));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le menu' }));

    expect(onFermer).toHaveBeenCalledTimes(3);
  });
});
