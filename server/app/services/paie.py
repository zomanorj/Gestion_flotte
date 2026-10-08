# Service de calcul de la paie mensuelle des chauffeurs + bulletin PDF
import asyncio

from .. import db
from ..temps import aujourdhui
from .pdf import MOIS_FR, Pdf, date_fr, montant_fr, tronquer


class ChauffeurIntrouvable(Exception):
    pass


async def calculer_fiche_paie(chauffeur_id: int, annee: int, mois: int) -> dict:
    """Fiche de paie détaillée d'un chauffeur pour un mois donné (1–12)."""
    chauffeur = await db.query_one(
        """SELECT id, nom, prenom, telephone, numero_permis, categorie_permis,
                  salaire_base, prime_mission
           FROM chauffeurs WHERE id = %s""",
        [chauffeur_id],
    )
    if not chauffeur:
        raise ChauffeurIntrouvable("Chauffeur introuvable")

    # Missions terminées du mois
    missions = await db.query(
        """SELECT m.id, m.titre, m.lieu_depart, m.lieu_destination,
                  m.distance_km, m.cout_carburant, m.poids_charge,
                  m.date_depart, m.date_retour_reelle,
                  v.immatriculation, v.marque,
                  ms.prime_mission AS prime_saisie, ms.bonus, ms.statut AS statut_paiement
           FROM missions m
           JOIN vehicules v ON m.vehicule_id = v.id
           LEFT JOIN mission_salaires ms ON ms.mission_id = m.id AND ms.chauffeur_id = %s
           WHERE m.chauffeur_id = %s
             AND m.statut = 'terminee'
             AND YEAR(m.date_retour_reelle)  = %s
             AND MONTH(m.date_retour_reelle) = %s
           ORDER BY m.date_depart ASC""",
        [chauffeur_id, chauffeur_id, annee, mois],
    )

    salaire_base  = chauffeur["salaire_base"] or 800000
    prime_mission = chauffeur["prime_mission"] or 50000
    nb_missions   = len(missions)
    total_km      = sum(m["distance_km"] or 0 for m in missions)
    total_primes  = nb_missions * prime_mission

    # Bonus kilométrage : +20 000 Ar par tranche de 500 km au-delà de 500 km totaux
    km_bonus    = int((total_km - 500) // 500) * 20000 if total_km > 500 else 0
    total_brut  = salaire_base + total_primes + km_bonus
    cnaps       = round(total_brut * 0.01)  # CNAPS 1% part salariale (simplifié)
    net_a_payer = total_brut - cnaps

    return {
        "chauffeur": {
            "id":               chauffeur["id"],
            "nom":              chauffeur["nom"],
            "prenom":           chauffeur["prenom"],
            "telephone":        chauffeur["telephone"],
            "numero_permis":    chauffeur["numero_permis"],
            "categorie_permis": chauffeur["categorie_permis"],
            "salaire_base":     salaire_base,
            "prime_mission":    prime_mission,
        },
        "periode": {"annee": annee, "mois": mois},
        "missions": missions,
        "calcul": {
            "nb_missions":  nb_missions,
            "total_km":     round(total_km),
            "salaire_base": salaire_base,
            "total_primes": total_primes,
            "km_bonus":     km_bonus,
            "total_brut":   total_brut,
            "cnaps":        cnaps,
            "net_a_payer":  net_a_payer,
        },
    }


async def resume_mensuel(annee: int, mois: int) -> list[dict]:
    """Résumé de la paie mensuelle pour tous les chauffeurs."""
    chauffeurs = await db.query("SELECT id FROM chauffeurs ORDER BY nom ASC")
    fiches = await asyncio.gather(
        *(calculer_fiche_paie(c["id"], annee, mois) for c in chauffeurs), return_exceptions=True
    )
    return [
        {
            "chauffeur_id": f["chauffeur"]["id"],
            "nom":          f["chauffeur"]["nom"],
            "prenom":       f["chauffeur"]["prenom"],
            "nb_missions":  f["calcul"]["nb_missions"],
            "total_km":     f["calcul"]["total_km"],
            "salaire_base": f["calcul"]["salaire_base"],
            "total_primes": f["calcul"]["total_primes"],
            "km_bonus":     f["calcul"]["km_bonus"],
            "net_a_payer":  f["calcul"]["net_a_payer"],
        }
        for f in fiches
        if not isinstance(f, BaseException)
    ]


def generer_bulletin_pdf(fiche: dict) -> bytes:
    """Bulletin de paie A4 (même mise en page que l'ancienne version PDFKit)."""
    chauffeur, periode, missions, calcul = fiche["chauffeur"], fiche["periode"], fiche["missions"], fiche["calcul"]
    pdf = Pdf()

    # En-tête
    pdf.rect(50, 50, 495, 60, remplir="#1e3a8a")
    pdf.texte("BULLETIN DE PAIE", 70, 65, taille=18, gras=True, couleur="#ffffff")
    pdf.texte(f"Période : {MOIS_FR[periode['mois']]} {periode['annee']}", 70, 88, taille=11, couleur="#ffffff")

    # Infos chauffeur
    pdf.texte("Informations du chauffeur", 50, 135, taille=13, gras=True)
    pdf.ligne(50, 152, 545, 152, "#e5e7eb")

    col1, col2, y = 50, 300, 162
    gris = "#374151"
    pdf.texte("Nom complet :", col1, y, couleur=gris)
    pdf.texte(f"{chauffeur['prenom']} {chauffeur['nom']}", col1 + 110, y, gras=True, couleur=gris)
    pdf.texte("N° Permis :", col2, y, couleur=gris)
    pdf.texte(chauffeur["numero_permis"] or "—", col2 + 90, y, gras=True, couleur=gris)
    y += 20
    pdf.texte("Catégorie :", col1, y, couleur=gris)
    pdf.texte(chauffeur["categorie_permis"] or "—", col1 + 110, y, gras=True, couleur=gris)
    pdf.texte("Téléphone :", col2, y, couleur=gris)
    pdf.texte(chauffeur["telephone"] or "—", col2 + 90, y, gras=True, couleur=gris)

    # Tableau des missions
    y += 35
    pdf.texte("Missions effectuées", 50, y, taille=13, gras=True)
    y += 20
    pdf.ligne(50, y, 545, y, "#e5e7eb")
    y += 8

    pdf.rect(50, y, 495, 18, remplir="#f3f4f6")
    for libelle, x in (("Mission", 55), ("Trajet", 195), ("Distance", 360), ("Date retour", 430)):
        pdf.texte(libelle, x, y + 4, taille=9, gras=True, couleur=gris)
    y += 22

    for i, m in enumerate(missions):
        if i % 2 == 0:
            pdf.rect(50, y - 3, 495, 16, remplir="#f9fafb")
        trajet = f"{m['lieu_depart']} → {m['lieu_destination']}"
        pdf.texte(tronquer(m["titre"], 25), 55, y, taille=9, couleur=gris)
        pdf.texte(tronquer(trajet, 30), 195, y, taille=9, couleur=gris)
        pdf.texte(f"{round(m['distance_km'] or 0)} km", 360, y, taille=9, couleur=gris)
        pdf.texte(date_fr(m["date_retour_reelle"]), 430, y, taille=9, couleur=gris)
        y += 16

    if not missions:
        pdf.texte("Aucune mission terminée ce mois", 55, y, taille=9, couleur="#9ca3af")
        y += 16

    # Récapitulatif salarial
    y += 20
    pdf.texte("Récapitulatif salarial", 50, y, taille=13, gras=True)
    y += 20
    pdf.ligne(50, y, 545, y, "#e5e7eb")
    y += 10

    def ligne_salaire(label, montant, gras=False, couleur=gris):
        nonlocal y
        pdf.texte(label, 55, y, gras=gras, couleur=couleur)
        pdf.texte(f"{montant_fr(montant)} Ar", 400, y, gras=gras, couleur=couleur, largeur=140, align="right")
        y += 18

    prime_unitaire = calcul["total_primes"] / (calcul["nb_missions"] or 1)
    ligne_salaire("Salaire de base", calcul["salaire_base"])
    ligne_salaire(f"Primes missions ({calcul['nb_missions']} × {montant_fr(prime_unitaire)} Ar)", calcul["total_primes"])
    if calcul["km_bonus"] > 0:
        ligne_salaire(f"Bonus kilométrage ({calcul['total_km']} km)", calcul["km_bonus"])

    pdf.ligne(50, y, 545, y, "#d1d5db", 0.5)
    y += 6
    ligne_salaire("Total brut", calcul["total_brut"], gras=True)
    ligne_salaire("CNAPS salarié (1%)", -calcul["cnaps"], couleur="#dc2626")

    pdf.rect(50, y + 2, 495, 24, remplir="#1e3a8a")
    pdf.texte("NET À PAYER", 55, y + 7, taille=12, gras=True, couleur="#ffffff")
    pdf.texte(f"{montant_fr(calcul['net_a_payer'])} Ar", 400, y + 7, taille=12, gras=True,
              couleur="#ffffff", largeur=140, align="right")
    y += 40

    # Pied de page
    pdf.texte(f"Document généré le {date_fr(aujourdhui())} — CamionApp ERP Madagascar",
              50, y + 20, taille=8, couleur="#9ca3af", largeur=495, align="center")

    return pdf.terminer()
