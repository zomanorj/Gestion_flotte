import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  dateDuJour, formaterDate, formaterDateHeure, formaterKm, formaterMontant, formaterNombre, pourPdf,
} from './format';

/** Exécute les tests du bloc dans le fuseau `nom`, puis rétablit le fuseau d'origine. */
function dansLeFuseau(nom) {
  const origine = process.env.TZ;
  beforeAll(() => { process.env.TZ = nom; });
  afterAll(() => {
    if (origine === undefined) delete process.env.TZ;
    else process.env.TZ = origine;
  });
}

// Intl sépare les milliers par une espace fine insécable (U+202F) : comparaison sur des espaces simples
const lisible = (texte) => texte.replace(/[\u202F\u00A0]/g, ' ');

describe('formaterDate', () => {
  // Fuseau à l'ouest de Greenwich : une date seule lue en UTC tomberait la veille
  dansLeFuseau('America/New_York');

  it('lit une date seule comme un jour du calendrier local', () => {
    expect(formaterDate('2024-04-20')).toBe('20/04/2024');
  });

  it('formate une date avec heure', () => {
    expect(formaterDate('2024-04-20T23:30:00')).toBe('20/04/2024');
    expect(formaterDateHeure('2024-04-20T08:30:00')).toBe('20/04/2024 08:30');
  });

  it.each([null, undefined, '', 'pas une date'])('affiche un tiret pour %s', (valeur) => {
    expect(formaterDate(valeur)).toBe('—');
  });
});

describe('montants et nombres', () => {
  it('arrondit les montants à l’ariary', () => {
    expect(lisible(formaterMontant(589680))).toBe('589 680 Ar');
    expect(lisible(formaterMontant('1234.6'))).toBe('1 235 Ar');
    expect(formaterMontant(0)).toBe('0 Ar');
  });

  it('affiche la valeur de remplacement sans montant', () => {
    expect(formaterMontant(null)).toBe('—');
    expect(formaterMontant(undefined, '0 Ar')).toBe('0 Ar');
  });

  it('limite les décimales des nombres et des distances', () => {
    expect(formaterNombre(0.3, 3)).toBe('0,3');
    expect(lisible(formaterNombre(12345))).toBe('12 345');
    expect(formaterKm(405.25, 1)).toBe('405,3 km');
    expect(formaterKm('')).toBe('—');
  });
});

describe('dateDuJour', () => {
  dansLeFuseau('Indian/Antananarivo');
  afterAll(() => { vi.useRealTimers(); });

  it('donne la date locale au format des champs date, pas la date UTC', () => {
    vi.useFakeTimers();
    // 1 h 30 le 10 octobre à Antananarivo (UTC+3) = 22 h 30 UTC le 9 : toISOString() donnerait le 9
    vi.setSystemTime(new Date('2026-10-09T22:30:00Z'));
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-09');
    expect(dateDuJour()).toBe('2026-10-10');
  });
});

describe('pourPdf', () => {
  it('remplace la flèche et les espaces absentes des polices de jsPDF', () => {
    expect(pourPdf(`Tana → Antsirabe : ${formaterMontant(589680)}`)).toBe('Tana -> Antsirabe : 589 680 Ar');
  });
});
