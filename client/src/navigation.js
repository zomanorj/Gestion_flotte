// Navigation de l'application : une seule description, utilisée par la barre latérale (liens
// groupés par section) et par la barre du haut (fil d'Ariane). Ajouter une page ici, puis dans
// pages/registre.js.
import {
  LayoutDashboard, ClipboardList, MapPin, Calendar, Truck, Users, FileCheck, Wrench,
  Fuel, Receipt, Wallet, Building2, FileText, SlidersHorizontal, UserCog,
} from 'lucide-react';

const GESTION = ['admin', 'gestionnaire'];

/** `roles` absent : visible par tous les rôles. `alerte` : nom du badge d'alerte de la barre latérale. */
export const SECTIONS = [
  {
    titre: 'Pilotage',
    liens: [
      { chemin: '/mes-missions', libelle: 'Mes missions',    Icone: ClipboardList, roles: ['chauffeur'] },
      { chemin: '/',             libelle: 'Tableau de bord', Icone: LayoutDashboard },
      { chemin: '/missions',     libelle: 'Missions',        Icone: MapPin },
      { chemin: '/planning',     libelle: 'Planning',        Icone: Calendar },
    ],
  },
  {
    titre: 'Flotte',
    liens: [
      { chemin: '/vehicules',    libelle: 'Véhicules',    Icone: Truck,     alerte: 'vehicules' },
      { chemin: '/chauffeurs',   libelle: 'Chauffeurs',   Icone: Users },
      { chemin: '/documents',    libelle: 'Documents',    Icone: FileCheck, alerte: 'documents' },
      { chemin: '/maintenances', libelle: 'Maintenances', Icone: Wrench,    alerte: 'maintenances' },
    ],
  },
  {
    titre: 'Finances',
    liens: [
      { chemin: '/carburant', libelle: 'Carburant', Icone: Fuel },
      { chemin: '/depenses',  libelle: 'Dépenses',  Icone: Receipt },
      { chemin: '/paie',      libelle: 'Paie',      Icone: Wallet, roles: GESTION },
    ],
  },
  {
    titre: 'Gestion',
    liens: [
      { chemin: '/clients',      libelle: 'Clients',      Icone: Building2 },
      { chemin: '/rapports',     libelle: 'Rapports',     Icone: FileText },
      { chemin: '/parametres',   libelle: 'Paramètres',   Icone: SlidersHorizontal, roles: GESTION },
      { chemin: '/utilisateurs', libelle: 'Utilisateurs', Icone: UserCog,           roles: ['admin'] },
    ],
  },
];

/** Sections et liens visibles pour un rôle (sections vides retirées). */
export const sectionsPour = (role) => SECTIONS
  .map((s) => ({ ...s, liens: s.liens.filter((l) => !l.roles || l.roles.includes(role)) }))
  .filter((s) => s.liens.length > 0);

/** Section et lien correspondant à un chemin (fil d'Ariane de la barre du haut). */
export function emplacement(chemin) {
  for (const section of SECTIONS) {
    const lien = section.liens.find((l) => l.chemin === chemin);
    if (lien) return { section: section.titre, page: lien.libelle };
  }
  return null;
}
