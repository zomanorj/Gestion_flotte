# Accès aux données : paramètres métier modifiés et leur historique
from .. import db
from ..db import Executeur


async def valeurs_modifiees() -> list[dict]:
    """Paramètres dont la valeur diffère du défaut, avec l'auteur de la dernière modification."""
    return await db.query("""
        SELECT p.cle, p.valeur, p.modifie_le, u.nom AS modifie_par_nom
        FROM parametres p
        LEFT JOIN users u ON u.id = p.modifie_par
    """)


async def valeurs_brutes(cx: Executeur = db, *, verrou: bool = False) -> dict[str, str]:
    lignes = await cx.query("SELECT cle, valeur FROM parametres" + (" FOR UPDATE" if verrou else ""))
    return {ligne["cle"]: ligne["valeur"] for ligne in lignes}


async def enregistrer(cle: str, valeur: str, user_id: int, cx: Executeur) -> None:
    await cx.execute(
        """INSERT INTO parametres (cle, valeur, modifie_par) VALUES (%s, %s, %s)
           ON DUPLICATE KEY UPDATE valeur = %s, modifie_par = %s""",
        [cle, valeur, user_id, valeur, user_id],
    )


async def supprimer(cle: str, cx: Executeur) -> None:
    await cx.execute("DELETE FROM parametres WHERE cle = %s", [cle])


async def tracer(cle: str, ancienne: str | None, nouvelle: str | None, user_id: int, cx: Executeur) -> None:
    await cx.execute(
        "INSERT INTO parametres_historique (cle, ancienne_valeur, nouvelle_valeur, modifie_par) "
        "VALUES (%s, %s, %s, %s)",
        [cle, ancienne, nouvelle, user_id],
    )


async def historique(nombre: int = 100) -> list[dict]:
    return await db.query("""
        SELECT h.id, h.cle, h.ancienne_valeur, h.nouvelle_valeur, h.modifie_le, u.nom AS modifie_par_nom
        FROM parametres_historique h
        LEFT JOIN users u ON u.id = h.modifie_par
        ORDER BY h.modifie_le DESC, h.id DESC
        LIMIT %s
    """, [nombre])
