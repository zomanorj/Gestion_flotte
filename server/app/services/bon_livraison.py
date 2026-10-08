# Service de génération du bon de livraison PDF
from ..temps import aujourdhui
from .pdf import Pdf, date_fr

BLEU  = "#1e3a5f"
GRIS  = "#6b7280"
LIGNE = "#e5e7eb"
NOIR  = "#111827"


def generer_bon_livraison(mission: dict) -> bytes:
    """Bon de livraison A4 : infos mission, trajet, camion, chauffeur, client et zone de signatures."""
    pdf = Pdf()
    largeur, hauteur = pdf.largeur, pdf.hauteur

    # ── En-tête ──────────────────────────────────────────────────────────
    pdf.rect(0, 0, largeur, 90, remplir=BLEU)
    pdf.texte("BON DE LIVRAISON", 50, 25, taille=22, gras=True, couleur="#ffffff")
    pdf.texte(f"N° BL-{mission['id']:05d}", 50, 52, taille=11, couleur="#ffffff")
    pdf.texte(f"Émis le {date_fr(aujourdhui())}", 0, 52, couleur="#ffffff", largeur=largeur - 50, align="right")
    pdf.texte("FlotteCamion — Gestion de flotte Madagascar", 50, 70, taille=9, couleur="#c7d0dc")

    # ── Corps (mise en page en flux, y = curseur courant) ──────────────────
    y = 110

    def section_titre(texte: str):
        nonlocal y
        y += 6
        pdf.texte(texte.upper(), 50, y, taille=9, gras=True, couleur=BLEU, espacement=1)
        y += 11
        pdf.ligne(50, y + 2, 545, y + 2, BLEU)
        y += 6

    def ligne(label: str, valeur):
        nonlocal y
        pdf.texte(label, 50, y, gras=True, couleur=GRIS)
        pdf.texte(valeur or "—", 215, y)
        y += 15

    section_titre("Informations mission")
    ligne("Référence mission :", mission["titre"])
    ligne("Date de départ :", date_fr(mission["date_depart"]))
    ligne("Retour prévu :", date_fr(mission["date_retour_prevue"]))
    if mission.get("poids_charge"):
        ligne("Poids chargé :", f"{mission['poids_charge']:g} tonnes")

    section_titre("Trajet")
    ligne("Lieu de départ :", mission["lieu_depart"])
    ligne("Destination :", mission["lieu_destination"])
    ligne("Distance :", f"{(mission['distance_km'] or 0):g} km")

    section_titre("Véhicule")
    ligne("Immatriculation :", mission["immatriculation"])
    ligne("Marque / Modèle :", f"{mission['marque']} {mission['modele']}")

    section_titre("Chauffeur")
    ligne("Nom complet :", f"{mission['chauffeur_prenom']} {mission['chauffeur_nom']}")
    if mission.get("numero_permis"):
        ligne("N° Permis :", mission["numero_permis"])

    if mission.get("client_nom"):
        section_titre("Client")
        ligne("Client :", mission["client_nom"])
        if mission.get("client_contact"):
            ligne("Contact :", mission["client_contact"])
        if mission.get("client_tel"):
            ligne("Téléphone :", mission["client_tel"])

    section_titre("Marchandises transportées")
    for ligne_notes in (mission.get("notes") or "Non spécifiées").splitlines() or [""]:
        pdf.texte(ligne_notes, 50, y)
        y += 13

    # ── Zone signatures ──
    y_sign = max(y + 24, 580)
    pdf.ligne(50, y_sign, 545, y_sign, LIGNE, 0.5)

    pdf.texte("Signature expéditeur", 50, y_sign + 15, gras=True, couleur=GRIS, largeur=200, align="center")
    pdf.texte("Signature destinataire", 295, y_sign + 15, gras=True, couleur=GRIS, largeur=200, align="center")
    for x in (50, 295):
        pdf.texte("Nom : _______________________", x, y_sign + 35, taille=9, couleur="#9ca3af")
        pdf.texte("Date : ____/____/________", x, y_sign + 55, taille=9, couleur="#9ca3af")
        pdf.rect(x, y_sign + 70, 200, 60, contour=LIGNE, epaisseur=0.5)

    # ── Pied de page ──
    pdf.texte("FlotteCamion — Système de gestion de flotte — Madagascar",
              50, hauteur - 30, taille=8, couleur="#9ca3af", largeur=largeur - 100, align="center")

    return pdf.terminer()
