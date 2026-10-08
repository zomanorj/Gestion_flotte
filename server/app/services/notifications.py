# Service notifications — création en base + émission Socket.io, vérification périodique des alertes
#
# Destinataires :
#   user_id renseigné → cet utilisateur uniquement ;
#   user_id NULL      → l'équipe de gestion (rôles admin et gestionnaire).
# L'état lu / supprimé est propre à chaque utilisateur (table notification_etats) :
# marquer ou supprimer une notification n'affecte jamais les autres destinataires.
from .. import db
from ..auth import ROLES_GESTION
from ..socket import sio
from ..temps import maintenant

DUREE_CONSERVATION_JOURS = 90

# Condition SQL de visibilité ; paramètres : (user_id, role)
VISIBLE_PAR = "(n.user_id = %s OR (n.user_id IS NULL AND %s IN ('admin', 'gestionnaire')))"


async def creer_notification(
    type: str, titre: str, message: str, vehicule_id: int | None = None, user_id: int | None = None
) -> dict | None:
    """Crée une notification en base ET l'émet via Socket.io ('notification:nouvelle') aux destinataires."""
    try:
        new_id = await db.execute(
            "INSERT INTO notifications (type, titre, message, vehicule_id, user_id) VALUES (%s, %s, %s, %s, %s)",
            [type, titre, message, vehicule_id, user_id],
        )
        notif = {
            "id": new_id, "type": type, "titre": titre, "message": message,
            "vehicule_id": vehicule_id, "est_lue": False,
            "created_at": maintenant().isoformat(timespec="seconds"),
        }
        destinataires = [f"user:{user_id}"] if user_id else [f"role:{r}" for r in ROLES_GESTION]
        await sio.emit("notification:nouvelle", notif, to=destinataires)
        return notif
    except Exception as err:
        print("Erreur creer_notification :", err)
        return None


async def verifier_alertes_periodiques() -> None:
    """Crée les notifications d'alertes (1 fois par jour et par élément au maximum)."""
    try:
        # Documents expirant dans 30 jours ou déjà expirés (pas encore notifiés aujourd'hui)
        docs = await db.query("""
            SELECT d.id, d.type, d.vehicule_id, d.date_expiration, v.immatriculation,
                   DATEDIFF(d.date_expiration, CURDATE()) AS jours
            FROM documents d
            JOIN vehicules v ON v.id = d.vehicule_id
            WHERE d.date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.vehicule_id = d.vehicule_id
                  AND n.type = 'document_expiration'
                  AND DATE(n.created_at) = CURDATE()
                  AND n.titre LIKE CONCAT(d.type, ' %')
              )
        """)

        for doc in docs:
            jours = int(doc["jours"])
            msg = (f"Document expiré depuis {abs(jours)} jour(s)" if jours < 0
                   else f"Document expire dans {jours} jour(s)")
            await creer_notification(
                "document_expiration", f"{doc['type']} — {doc['immatriculation']}", msg,
                vehicule_id=doc["vehicule_id"],
            )

        # Maintenances urgentes non résolues
        maints = await db.query("""
            SELECT m.id, m.type, m.vehicule_id, m.date_prevue, v.immatriculation
            FROM maintenances_planifiees m
            JOIN vehicules v ON v.id = m.vehicule_id
            WHERE m.priorite IN ('urgente','haute')
              AND m.statut NOT IN ('terminee','annulee')
              AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.type = 'maintenance_urgente'
                  AND n.vehicule_id = m.vehicule_id
                  AND DATE(n.created_at) = CURDATE()
                  AND n.titre = CONCAT('Maintenance ', m.type, ' — ', v.immatriculation)
              )
        """)

        for m in maints:
            avant = f" avant le {m['date_prevue'].strftime('%d/%m/%Y')}" if m["date_prevue"] else ""
            await creer_notification(
                "maintenance_urgente",
                f"Maintenance {m['type']} — {m['immatriculation']}",
                f"Maintenance urgente à traiter{avant}",
                vehicule_id=m["vehicule_id"],
            )

        # Purge : les notifications anciennes (et leurs états, par cascade) ne servent plus
        await db.execute(
            "DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL %s DAY)",
            [DUREE_CONSERVATION_JOURS],
        )

        print(f"[Notifications] {len(docs)} docs + {len(maints)} maintenances notifiés")
    except Exception as err:
        print("Erreur verifier_alertes_periodiques :", err)
