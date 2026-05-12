// Contrôleur missions — création, suivi et workflow de statuts
const db = require('../config/db');

// Prix du carburant en Ariary par litre (données marché Madagascar 2024)
const PRIX_LITRE_ARIARY = 5200;

/**
 * GET /api/missions
 * Retourne toutes les missions avec infos véhicule et chauffeur.
 * Query params : ?statut=en_cours&debut=2024-01-01&fin=2024-12-31
 */
const getAll = async (req, res) => {
  try {
    const { statut, debut, fin } = req.query;
    let query = `
      SELECT
        m.*,
        v.immatriculation, v.marque, v.modele,
        c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom, c.telephone AS chauffeur_tel
      FROM missions m
      JOIN vehicules  v ON m.vehicule_id  = v.id
      JOIN chauffeurs c ON m.chauffeur_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (statut) {
      query += ' AND m.statut = ?';
      params.push(statut);
    }

    if (debut) {
      query += ' AND m.date_depart >= ?';
      params.push(debut);
    }

    if (fin) {
      query += ' AND m.date_depart <= ?';
      params.push(fin + ' 23:59:59');
    }

    query += ' ORDER BY m.date_depart DESC';
    const [rows] = await db.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error('Erreur getAll missions :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * POST /api/missions
 * Crée une nouvelle mission.
 * Vérifie la disponibilité du véhicule et du chauffeur avant de créer.
 */
const create = async (req, res) => {
  try {
    const {
      titre, vehicule_id, chauffeur_id,
      lieu_depart, lieu_destination, distance_km,
      date_depart, date_retour_prevue, notes, poids_charge
    } = req.body;

    if (!titre || !vehicule_id || !chauffeur_id || !lieu_depart || !lieu_destination || !date_depart || !date_retour_prevue) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    // Vérification de la disponibilité du véhicule
    const [vehicule] = await db.query(
      'SELECT id, statut FROM vehicules WHERE id = ?', [vehicule_id]
    );
    if (vehicule.length === 0) {
      return res.status(404).json({ message: 'Camion introuvable' });
    }
    if (vehicule[0].statut !== 'disponible') {
      return res.status(409).json({ message: `Le camion n'est pas disponible (statut : ${vehicule[0].statut})` });
    }

    // Vérification de la disponibilité du chauffeur
    const [chauffeur] = await db.query(
      'SELECT id, statut FROM chauffeurs WHERE id = ?', [chauffeur_id]
    );
    if (chauffeur.length === 0) {
      return res.status(404).json({ message: 'Chauffeur introuvable' });
    }
    if (chauffeur[0].statut !== 'disponible') {
      return res.status(409).json({ message: `Le chauffeur n'est pas disponible (statut : ${chauffeur[0].statut})` });
    }

    const [result] = await db.query(
      `INSERT INTO missions
        (titre, vehicule_id, chauffeur_id, lieu_depart, lieu_destination,
         distance_km, date_depart, date_retour_prevue, notes, poids_charge, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planifiee')`,
      [titre, vehicule_id, chauffeur_id, lieu_depart, lieu_destination,
       distance_km || 0, date_depart, date_retour_prevue,
       notes || null, poids_charge || null]
    );

    // Notifier via Socket.io les autres clients connectés
    if (req.io) {
      req.io.emit('mission:nouvelle', { id: result.insertId, titre });
    }

    const [nouvelle] = await db.query(
      `SELECT m.*, v.immatriculation, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
       FROM missions m
       JOIN vehicules v ON m.vehicule_id = v.id
       JOIN chauffeurs c ON m.chauffeur_id = c.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(nouvelle[0]);

  } catch (err) {
    console.error('Erreur create mission :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * PUT /api/missions/:id/statut
 * Met à jour le statut d'une mission et synchronise véhicule + chauffeur.
 * Calcule le coût carburant lors de la clôture.
 */
const updateStatut = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    const statutsValides = ['en_cours', 'terminee', 'annulee'];
    if (!statut || !statutsValides.includes(statut)) {
      return res.status(400).json({ message: `Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}` });
    }

    // Récupération de la mission avec les IDs liés
    const [missions] = await db.query(
      'SELECT * FROM missions WHERE id = ?', [id]
    );
    if (missions.length === 0) {
      return res.status(404).json({ message: 'Mission introuvable' });
    }

    const mission = missions[0];

    // Construction de la mise à jour selon le nouveau statut
    let updateMission = 'UPDATE missions SET statut = ?';
    const paramsMission = [statut];

    let statutVehicule  = null;
    let statutChauffeur = null;

    if (statut === 'en_cours') {
      statutVehicule  = 'en_mission';
      statutChauffeur = 'en_mission';

    } else if (statut === 'terminee') {
      statutVehicule  = 'disponible';
      statutChauffeur = 'disponible';

      // Calcul du coût carburant : distance × consommation × prix/litre
      const [vehicule] = await db.query(
        'SELECT consommation_litre_km FROM vehicules WHERE id = ?',
        [mission.vehicule_id]
      );
      const consommation = vehicule[0]?.consommation_litre_km || 0.08;
      const coutCarburant = parseFloat(
        (mission.distance_km * consommation * PRIX_LITRE_ARIARY).toFixed(2)
      );

      updateMission += ', date_retour_reelle = NOW(), cout_carburant = ?';
      paramsMission.push(coutCarburant);

    } else if (statut === 'annulee') {
      statutVehicule  = 'disponible';
      statutChauffeur = 'disponible';
    }

    paramsMission.push(id);
    await db.query(updateMission + ' WHERE id = ?', paramsMission);

    // Mise à jour du statut du véhicule et du chauffeur si nécessaire
    if (statutVehicule) {
      await db.query('UPDATE vehicules SET statut = ? WHERE id = ?',
        [statutVehicule, mission.vehicule_id]);
    }
    if (statutChauffeur) {
      await db.query('UPDATE chauffeurs SET statut = ? WHERE id = ?',
        [statutChauffeur, mission.chauffeur_id]);
    }

    // Événement temps réel
    if (req.io) {
      req.io.emit('mission:statut', { id: parseInt(id), statut });
    }

    const [mise_a_jour] = await db.query(
      `SELECT m.*, v.immatriculation, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
       FROM missions m
       JOIN vehicules v ON m.vehicule_id = v.id
       JOIN chauffeurs c ON m.chauffeur_id = c.id
       WHERE m.id = ?`,
      [id]
    );

    return res.json(mise_a_jour[0]);

  } catch (err) {
    console.error('Erreur updateStatut mission :', err);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

/**
 * DELETE /api/missions/:id
 * Supprime une mission quel que soit son statut.
 * Si la mission est en cours : remet camion + chauffeur à "disponible"
 * et arrête la simulation Socket.io si elle est active.
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [missions] = await db.query('SELECT * FROM missions WHERE id = ?', [id]);
    if (missions.length === 0) {
      return res.status(404).json({ message: 'Mission introuvable' });
    }

    const mission = missions[0];

    // Si la mission est en cours, remet les ressources disponibles
    if (mission.statut === 'en_cours') {
      await db.query("UPDATE vehicules  SET statut = 'disponible' WHERE id = ?", [mission.vehicule_id]);
      await db.query("UPDATE chauffeurs SET statut = 'disponible' WHERE id = ?", [mission.chauffeur_id]);

      // Arrête la simulation Socket.io si elle est active
      const { arreterSimulation } = require('../services/simulationService');
      arreterSimulation(String(id));
    }

    await db.query('DELETE FROM missions WHERE id = ?', [id]);
    return res.json({ message: 'Mission supprimée' });

  } catch (err) {
    console.error('Erreur remove mission :', err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getAll, create, updateStatut, remove };
