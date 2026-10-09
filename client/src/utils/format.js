// Mise en forme commune : dates, montants en Ariary, nombres (conventions françaises).
// Toutes les pages passent par ces fonctions pour un affichage identique partout, quelle que
// soit la langue du navigateur.

const VIDE = '—';

const estVide = (valeur) => valeur === null || valeur === undefined || valeur === '';

/**
 * Valeur de l'API en Date. Une date seule ("2024-04-20") est lue comme un jour du calendrier
 * local : `new Date("2024-04-20")` la lirait à minuit UTC, soit la veille à l'ouest de Greenwich.
 */
const enDate = (valeur) => {
  if (valeur instanceof Date) return valeur;
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
  return jour ? new Date(Number(jour[1]), Number(jour[2]) - 1, Number(jour[3])) : new Date(valeur);
};

const formaterAvec = (valeur, options) => {
  if (estVide(valeur)) return VIDE;
  const date = enDate(valeur);
  return Number.isNaN(date.getTime()) ? VIDE : date.toLocaleString('fr-FR', options);
};

/** 20/04/2024 */
export const formaterDate = (valeur) => formaterAvec(valeur, { day: '2-digit', month: '2-digit', year: 'numeric' });

/** 20/04/2024 08:30 */
export const formaterDateHeure = (valeur) => formaterAvec(valeur, { dateStyle: 'short', timeStyle: 'short' });

/** 08:30:15 */
export const formaterHeure = (valeur) => formaterAvec(valeur, { timeStyle: 'medium' });

const formateurs = {};
const formateur = (decimales) =>
  (formateurs[decimales] ??= new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }));

/** 12 345 (au plus `decimales` chiffres après la virgule) */
export const formaterNombre = (valeur, decimales = 0) =>
  estVide(valeur) || Number.isNaN(Number(valeur)) ? VIDE : formateur(decimales).format(Number(valeur));

/** 589 680 Ar, arrondi à l'ariary ; `vide` quand il n'y a pas de montant */
export const formaterMontant = (valeur, vide = VIDE) =>
  estVide(valeur) || Number.isNaN(Number(valeur)) ? vide : `${formaterNombre(valeur)} Ar`;

/** 1 250 km */
export const formaterKm = (valeur, decimales = 0) =>
  estVide(valeur) ? VIDE : `${formaterNombre(valeur, decimales)} km`;

/** Date du jour au format des champs <input type="date"> (YYYY-MM-DD), en heure locale */
export const dateDuJour = () => {
  const d = new Date();
  const deux = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
};

/**
 * Texte compatible avec les polices standard de jsPDF (jeu WinAnsi) : les espaces fines que
 * Intl place entre les milliers et la flèche n'y existent pas et s'afficheraient en caractères
 * parasites. Même règle que les PDF générés par l'API.
 */
export const pourPdf = (texte) =>
  String(texte).replace(/[\u202F\u00A0]/g, ' ').replace(/\u2192/g, '->');
