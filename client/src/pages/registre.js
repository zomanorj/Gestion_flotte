// Registre des pages chargées à la demande
//
// Chaque page est un fichier JavaScript séparé, téléchargé à la première visite (React.lazy).
// La barre latérale précharge la page au survol d'un lien (precharger), si bien que le
// changement de page reste instantané.
import { lazy } from 'react';

const CLE_RECHARGEMENT = 'flotte:rechargement-apres-deploiement';

/**
 * Page chargée à la demande. Après un déploiement, les anciens fichiers de page n'existent plus :
 * un onglet resté ouvert échouerait à les charger. On recharge alors l'application une seule fois
 * pour récupérer la nouvelle version ; si l'échec persiste, l'erreur remonte au ErrorBoundary.
 */
function pageDifferee(importer) {
  return lazy(() => importer()
    .then((module) => {
      try { sessionStorage.removeItem(CLE_RECHARGEMENT); } catch { /* stockage indisponible */ }
      return module;
    })
    .catch((erreur) => {
      let dejaRecharge = true;
      try {
        dejaRecharge = sessionStorage.getItem(CLE_RECHARGEMENT) === '1';
        if (!dejaRecharge) sessionStorage.setItem(CLE_RECHARGEMENT, '1');
      } catch { /* stockage indisponible : pas de rechargement automatique */ }
      if (!dejaRecharge) {
        window.location.reload();
        return new Promise(() => {}); // la page se recharge : ne rien afficher entre-temps
      }
      throw erreur;
    }));
}

const IMPORTS = {
  '/':             () => import('./Dashboard'),
  '/vehicules':    () => import('./Vehicules'),
  '/chauffeurs':   () => import('./Chauffeurs'),
  '/missions':     () => import('./Missions'),
  '/carte':        () => import('./CarteGlobale'),
  '/documents':    () => import('./Documents'),
  '/carburant':    () => import('./Carburant'),
  '/depenses':     () => import('./Depenses'),
  '/maintenances': () => import('./Maintenances'),
  '/planning':     () => import('./Planning'),
  '/clients':      () => import('./Clients'),
  '/rapports':     () => import('./Rapports'),
  '/paie':         () => import('./Paie'),
  '/parametres':   () => import('./Parametres'),
  '/utilisateurs': () => import('./Utilisateurs'),
};

/** Pages affichées sans marge intérieure, sur toute la surface disponible. */
export const PAGES_PLEIN_ECRAN = new Set(['/carte']);

export const PAGES = Object.entries(IMPORTS).map(([chemin, importer]) => ({
  chemin,
  Composant: pageDifferee(importer),
}));

/** Lance le téléchargement d'une page sans l'afficher (sans effet si elle est déjà chargée). */
export function precharger(chemin) {
  IMPORTS[chemin]?.().catch(() => { /* réessayé à la navigation */ });
}
