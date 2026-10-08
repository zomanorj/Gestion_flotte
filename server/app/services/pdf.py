# Petite surcouche ReportLab avec un repère "haut-gauche" (comme PDFKit) pour les PDF générés
from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

MOIS_FR = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
           "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]


def montant_fr(valeur: float) -> str:
    """Formate un montant à la française : 1 234 567 (espaces comme séparateur de milliers)."""
    return f"{round(valeur):,}".replace(",", " ")


def date_fr(d) -> str:
    return d.strftime("%d/%m/%Y") if d else "—"


def tronquer(texte: str, n: int) -> str:
    return texte[:n] + "…" if len(texte) > n else texte


class Pdf:
    """Canvas A4 où y est mesuré depuis le haut de la page (y = haut de la ligne de texte)."""

    def __init__(self):
        self.buffer = BytesIO()
        self.c = canvas.Canvas(self.buffer, pagesize=A4)
        self.largeur, self.hauteur = A4

    def _y(self, y: float) -> float:
        return self.hauteur - y

    def rect(self, x, y, w, h, remplir: str | None = None, contour: str | None = None, epaisseur: float = 1):
        if remplir:
            self.c.setFillColor(HexColor(remplir))
        if contour:
            self.c.setStrokeColor(HexColor(contour))
            self.c.setLineWidth(epaisseur)
        self.c.rect(x, self._y(y + h), w, h, fill=1 if remplir else 0, stroke=1 if contour else 0)

    def ligne(self, x1, y1, x2, y2, couleur: str, epaisseur: float = 1):
        self.c.setStrokeColor(HexColor(couleur))
        self.c.setLineWidth(epaisseur)
        self.c.line(x1, self._y(y1), x2, self._y(y2))

    def texte(self, texte: str, x, y, taille=10, gras=False, couleur="#111827",
              largeur: float | None = None, align="left", espacement: float = 0):
        """Écrit une ligne de texte ; `largeur` + `align` permettent le centrage / alignement à droite."""
        police = "Helvetica-Bold" if gras else "Helvetica"
        # Caractères hors WinAnsi (non disponibles dans les polices standard)
        texte = str(texte).replace("→", "->")
        self.c.setFont(police, taille)
        self.c.setFillColor(HexColor(couleur))
        base = self._y(y + taille * 0.8)
        if largeur is not None and align == "right":
            self.c.drawRightString(x + largeur, base, texte)
        elif largeur is not None and align == "center":
            self.c.drawCentredString(x + largeur / 2, base, texte)
        elif espacement:
            # L'espacement (Tc) persiste dans l'état graphique : on l'isole
            self.c.saveState()
            self.c.drawString(x, base, texte, charSpace=espacement)
            self.c.restoreState()
        else:
            self.c.drawString(x, base, texte)

    def terminer(self) -> bytes:
        self.c.showPage()
        self.c.save()
        return self.buffer.getvalue()
