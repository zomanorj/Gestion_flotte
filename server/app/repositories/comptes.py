# Accès aux données : utilisateurs et notifications
from .. import db
from ..db import Executeur
from . import base

# ── Utilisateurs ───────────────────────────────────────────────────────────────

_PUBLIC = "SELECT id, nom, email, role, is_active, created_at FROM users"


async def lister_utilisateurs() -> list[dict]:
    """Comptes avec la fiche chauffeur éventuellement liée."""
    return await db.query("""
        SELECT u.id, u.nom, u.email, u.role, u.is_active, u.created_at,
               c.id AS chauffeur_id, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM users u
        LEFT JOIN chauffeurs c ON c.user_id = u.id
        ORDER BY u.role ASC, u.nom ASC
    """)


async def utilisateur_public(id: int) -> dict | None:
    """Champs exposables du compte (ni hash ni version de token)."""
    return await db.query_one(_PUBLIC + " WHERE id = %s", [id])


async def utilisateur_complet(id: int, cx: Executeur = db, *, verrou: bool = False) -> dict | None:
    """Toutes les colonnes, hash compris : usage interne uniquement."""
    return await cx.query_one("SELECT * FROM users WHERE id = %s" + (" FOR UPDATE" if verrou else ""), [id])


async def utilisateur_par_email(email: str) -> dict | None:
    return await db.query_one("SELECT * FROM users WHERE email = %s", [email])


async def etat_session(id: int) -> dict | None:
    """Ce qu'il faut pour valider un token à chaque requête (lecture par clé primaire)."""
    return await db.query_one("SELECT id, nom, email, role, is_active, token_version FROM users WHERE id = %s", [id])


async def email_pris(email: str, sauf_id: int | None = None, cx: Executeur = db) -> bool:
    return await cx.query_one("SELECT id FROM users WHERE email = %s AND id <> %s", [email, sauf_id or 0]) is not None


async def creer_utilisateur(nom: str, email: str, password_hash: str, role: str) -> int:
    return await base.inserer("users", {"nom": nom, "email": email, "password_hash": password_hash, "role": role})


async def modifier_utilisateur(id: int, champs: dict, cx: Executeur = db) -> None:
    await base.modifier("users", id, champs, cx)


async def revoquer_tokens(id: int, cx: Executeur = db) -> None:
    """Invalide tous les tokens émis pour ce compte (voir app/auth.py)."""
    await cx.execute("UPDATE users SET token_version = token_version + 1 WHERE id = %s", [id])


async def admin_actif_existe() -> bool:
    return await db.query_one("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1") is not None


# ── Notifications ──────────────────────────────────────────────────────────────

# Visibilité : notification personnelle, ou destinée à la gestion (user_id NULL).
# Paramètres : (user_id, role)
VISIBLE_PAR = "(n.user_id = %s OR (n.user_id IS NULL AND %s IN ('admin', 'gestionnaire')))"

_POUR_UTILISATEUR = f"""
    FROM notifications n
    LEFT JOIN notification_etats e ON e.notification_id = n.id AND e.user_id = %s
    LEFT JOIN vehicules v ON v.id = n.vehicule_id
    WHERE {VISIBLE_PAR} AND COALESCE(e.supprimee, 0) = 0
"""


async def notifications_de(user_id: int, role: str, non_lues_seulement: bool, nombre: int = 50) -> list[dict]:
    """Notifications visibles par l'utilisateur, avec son propre état de lecture."""
    filtre = " AND COALESCE(e.est_lue, 0) = 0" if non_lues_seulement else ""
    return await db.query(
        "SELECT n.id, n.type, n.titre, n.message, n.vehicule_id, n.created_at, v.immatriculation,"
        " COALESCE(e.est_lue, 0) AS est_lue"
        + _POUR_UTILISATEUR + filtre + " ORDER BY est_lue ASC, n.created_at DESC LIMIT %s",
        [user_id, user_id, role, nombre],
    )


async def nombre_non_lues(user_id: int, role: str) -> int:
    ligne = await db.query_one(
        "SELECT COUNT(*) AS total" + _POUR_UTILISATEUR + " AND COALESCE(e.est_lue, 0) = 0", [user_id, user_id, role]
    )
    return int(ligne["total"])


async def notification_visible(id: int, user_id: int, role: str) -> bool:
    return await db.query_one(f"SELECT n.id FROM notifications n WHERE n.id = %s AND {VISIBLE_PAR}",
                              [id, user_id, role]) is not None


async def definir_etat(id: int, user_id: int, *, lue: bool, supprimee: bool) -> None:
    """Un état ne revient jamais en arrière (GREATEST) : une notification lue reste lue."""
    lue, supprimee = int(lue), int(supprimee)
    await db.execute(
        """INSERT INTO notification_etats (notification_id, user_id, est_lue, supprimee)
           VALUES (%s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE est_lue = GREATEST(est_lue, %s), supprimee = GREATEST(supprimee, %s)""",
        [id, user_id, lue, supprimee, lue, supprimee],
    )


async def tout_marquer_lu(user_id: int, role: str) -> None:
    await db.execute(
        f"""INSERT INTO notification_etats (notification_id, user_id, est_lue)
            SELECT n.id, %s, 1 FROM notifications n WHERE {VISIBLE_PAR}
            ON DUPLICATE KEY UPDATE est_lue = 1""",
        [user_id, user_id, role],
    )


async def creer_notification(champs: dict) -> int:
    return await base.inserer("notifications", champs)


async def documents_a_notifier(jours: int) -> list[dict]:
    """Documents expirés ou expirant sous `jours` jours, pas encore notifiés aujourd'hui."""
    return await db.query("""
        SELECT d.id, d.type, d.vehicule_id, d.date_expiration, v.immatriculation,
               DATEDIFF(d.date_expiration, CURDATE()) AS jours
        FROM documents d
        JOIN vehicules v ON v.id = d.vehicule_id
        WHERE d.date_expiration <= DATE_ADD(CURDATE(), INTERVAL %s DAY)
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.vehicule_id = d.vehicule_id
              AND n.type = 'document_expiration'
              AND DATE(n.created_at) = CURDATE()
              AND n.titre LIKE CONCAT(d.type, ' %%')
          )
    """, [jours])


async def maintenances_a_notifier() -> list[dict]:
    """Maintenances urgentes ou hautes non résolues, pas encore notifiées aujourd'hui."""
    return await db.query("""
        SELECT m.id, m.type, m.vehicule_id, m.date_prevue, v.immatriculation
        FROM maintenances_planifiees m
        JOIN vehicules v ON v.id = m.vehicule_id
        WHERE m.priorite IN ('urgente', 'haute')
          AND m.statut NOT IN ('terminee', 'annulee')
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.type = 'maintenance_urgente'
              AND n.vehicule_id = m.vehicule_id
              AND DATE(n.created_at) = CURDATE()
              AND n.titre = CONCAT('Maintenance ', m.type, ' — ', v.immatriculation)
          )
    """)


async def purger_notifications(jours: int) -> None:
    """Les notifications anciennes et leurs états (cascade) ne servent plus."""
    await db.execute("DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL %s DAY)", [jours])
