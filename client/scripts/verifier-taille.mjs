// Budget de taille du premier chargement : ce que le navigateur télécharge avant d'afficher la
// page de connexion (scripts et styles référencés par dist/index.html, compressés en gzip).
// Échoue si le budget est dépassé : un import direct d'une grosse bibliothèque dans une page
// chargée au démarrage (au lieu d'un import() différé) est ainsi détecté dès la CI.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// 160 Ko : ~152 Ko mesurés après le passage à React Router 7 et la mise à jour d'axios
const BUDGET_KO = 160;
const dist = new URL('../dist/', import.meta.url).pathname;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const fichiers = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
if (!fichiers.length) {
  console.error('Aucun fichier trouvé dans dist/index.html : lancer `npm run build` avant.');
  process.exit(1);
}

let total = 0;
for (const fichier of fichiers) {
  const taille = gzipSync(readFileSync(join(dist, fichier))).length;
  total += taille;
  console.log(`  ${(taille / 1024).toFixed(1).padStart(7)} Ko  ${fichier}`);
}
const totalKo = total / 1024;
console.log(`Premier chargement : ${totalKo.toFixed(1)} Ko compressés (budget : ${BUDGET_KO} Ko)`);
if (totalKo > BUDGET_KO) {
  console.error('Budget dépassé : une bibliothèque lourde est-elle importée directement au lieu de import() ?');
  process.exit(1);
}
