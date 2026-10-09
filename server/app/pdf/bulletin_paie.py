# Rendu PDF du bulletin de paie
from ..temps import aujourdhui
from .base import MOIS_FR, Pdf, date_fr, montant_fr, tronquer


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
