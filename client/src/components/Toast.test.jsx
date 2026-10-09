import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from './Toast';

/** Page qui affiche un toast et se re-rend à chaque frappe, comme un formulaire. */
function Page() {
  const { ajouterToast, ToastContainer } = useToast();
  const [texte, setTexte] = useState('');
  return (
    <>
      <button onClick={() => ajouterToast('Paramètres enregistrés', '2 valeur(s) modifiée(s)')}>Enregistrer</button>
      <input aria-label="saisie" value={texte} onChange={(e) => setTexte(e.target.value)} />
      <ToastContainer />
    </>
  );
}

describe('useToast', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ferme le toast après 4 s', () => {
    render(<Page />);
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(screen.getByText('Paramètres enregistrés')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText('Paramètres enregistrés')).not.toBeInTheDocument();
  });

  it('ne relance pas la minuterie quand la page se re-rend (saisie au clavier)', () => {
    render(<Page />);
    fireEvent.click(screen.getByText('Enregistrer'));
    const saisie = screen.getByLabelText('saisie');

    // 4 s de frappe continue : une frappe toutes les 500 ms
    for (let i = 0; i < 8; i += 1) {
      act(() => { vi.advanceTimersByTime(500); });
      fireEvent.change(saisie, { target: { value: 'x'.repeat(i + 1) } });
    }

    expect(screen.queryByText('Paramètres enregistrés')).not.toBeInTheDocument();
  });

  it('garde le même élément affiché d’un rendu à l’autre', () => {
    render(<Page />);
    fireEvent.click(screen.getByText('Enregistrer'));
    const avant = screen.getByText('Paramètres enregistrés');

    fireEvent.change(screen.getByLabelText('saisie'), { target: { value: 'a' } });

    expect(screen.getByText('Paramètres enregistrés')).toBe(avant);
  });
});
