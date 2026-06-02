// Service de calcul de la paie mensuelle des chauffeurs
const db = require('../config/db');

/**
 * Calcule la fiche de paie d'un chauffeur pour un mois donné.
 * @param {number} chauffeurId
 * @param {number} annee
 * @param {number} mois  (1–12)
 * @returns {Object} fiche de paie détaillée
 */
const calculerFichePaie = async (chauffeurId, annee, mois) => {
  // Informations du chauffeur
  const [chauffeurs] = await db.query(
    `SELECT id, nom, prenom, telephone, numero_permis, categorie_permis,
            salaire_base, prime_mission
     FROM chauffeurs WHERE id = ?`,
    [chauffeurId]
  );
  if (chauffeurs.length === 0) throw new Error('Chauffeur introuvable');
  const chauffeur = chauffeurs[0];

  // Missions terminées du mois
  const [missions] = await db.query(
    `SELECT m.id, m.titre, m.lieu_depart, m.lieu_destination,
            m.distance_km, m.cout_carburant, m.poids_charge,
            m.date_depart, m.date_retour_reelle,
            v.immatriculation, v.marque,
            ms.prime_mission AS prime_saisie, ms.bonus, ms.statut AS statut_paiement
     FROM missions m
     JOIN vehicules v ON m.vehicule_id = v.id
     LEFT JOIN mission_salaires ms ON ms.mission_id = m.id AND ms.chauffeur_id = ?
     WHERE m.chauffeur_id = ?
       AND m.statut = 'terminee'
       AND YEAR(m.date_retour_reelle)  = ?
       AND MONTH(m.date_retour_reelle) = ?
     ORDER BY m.date_depart ASC`,
    [chauffeurId, chauffeurId, annee, mois]
  );

  const salaire_base   = parseFloat(chauffeur.salaire_base  || 800000);
  const prime_mission  = parseFloat(chauffeur.prime_mission || 50000);
  const nb_missions    = missions.length;
  const total_km       = missions.reduce((s, m) => s + parseFloat(m.distance_km || 0), 0);
  const total_primes   = nb_missions * prime_mission;

  // Bonus kilométrage : +20 000 Ar par tranche de 500 km au-delà de 500 km totaux
  const km_bonus       = total_km > 500 ? Math.floor((total_km - 500) / 500) * 20000 : 0;
  const total_brut     = salaire_base + total_primes + km_bonus;
  const cnaps          = Math.round(total_brut * 0.01);  // CNAPS 1% part salariale (simplifié)
  const net_a_payer    = total_brut - cnaps;

  return {
    chauffeur: {
      id:             chauffeur.id,
      nom:            chauffeur.nom,
      prenom:         chauffeur.prenom,
      telephone:      chauffeur.telephone,
      numero_permis:  chauffeur.numero_permis,
      categorie_permis: chauffeur.categorie_permis,
      salaire_base,
      prime_mission
    },
    periode: { annee: parseInt(annee), mois: parseInt(mois) },
    missions,
    calcul: {
      nb_missions,
      total_km:     Math.round(total_km),
      salaire_base,
      total_primes,
      km_bonus,
      total_brut,
      cnaps,
      net_a_payer
    }
  };
};

/**
 * Résumé de la paie mensuelle pour tous les chauffeurs actifs.
 */
const resumeMensuel = async (annee, mois) => {
  const [chauffeurs] = await db.query(
    `SELECT id, nom, prenom, salaire_base, prime_mission
     FROM chauffeurs ORDER BY nom ASC`
  );

  const fiches = await Promise.all(
    chauffeurs.map(c => calculerFichePaie(c.id, annee, mois).catch(() => null))
  );

  return fiches.filter(Boolean).map(f => ({
    chauffeur_id:   f.chauffeur.id,
    nom:            f.chauffeur.nom,
    prenom:         f.chauffeur.prenom,
    nb_missions:    f.calcul.nb_missions,
    total_km:       f.calcul.total_km,
    salaire_base:   f.calcul.salaire_base,
    total_primes:   f.calcul.total_primes,
    km_bonus:       f.calcul.km_bonus,
    net_a_payer:    f.calcul.net_a_payer
  }));
};

module.exports = { calculerFichePaie, resumeMensuel };
