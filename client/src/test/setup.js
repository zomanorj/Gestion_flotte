// Initialisation commune des tests (Vitest + Testing Library)
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom n'implémente pas matchMedia : écran large par défaut, modifiable par test
if (!window.matchMedia) {
  window.matchMedia = vi.fn((requete) => ({
    matches: false,
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
