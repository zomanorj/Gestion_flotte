# Service notifications — création en base + émission Socket.io, vérification périodique des alertes
from datetime import datetime, timezone

from .. import db
from ..socket import sio


async def creer_notification(type: str, titre: str, message: str, vehicule_id: int | None = None) -> dict | None:
    """Crée une notification en base ET l'émet via Socket.io ('notification:nouvelle')."""
    try:
        new_id = await db.execute(
            "INSERT INTO notifications (type, titre, message, vehicule_id) VALUES (%s, %s, %s, %s)",
            [type, titre, message, vehicule_id],
        )
        notif = {
            "id": new_id, "type": type, "titre": titre, "message": message, "vehicule_id": vehicule_id,
            "est_lue": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await sio.emit("notification:nouvelle", notif)
        return notif
    except Exception as err:
        print("Erreur creer_notification :", err)
        return None


async def verifier_alertes_periodiques() -> None:
    """Vérifie les documents et maintenances expirant bientôt et crée des notifications (1 fois/jour max)."""
    try:
        # Documents expirant dans 30 jours ou déjà expirés (pas encore notifiés aujourd'hui)
        docs = await db.query("""
            SELECT d.id, d.type, d.date_expiration, v.immatriculation,
                   DATEDIFF(d.date_expiration, CURDATE()) AS jours
            FROM documents d
            JOIN vehicules v ON v.id = d.vehicule_id
            WHERE d.date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.vehicule_id = d.vehicule_id
                  AND n.type = 'document_expiration'
                  AND DATE(n.created_at) = CURDATE()
                  AND n.titre LIKE CONCAT('%', d.type, '%')
              )
        """)

        for doc in docs:
            jours = int(doc["jours"])
            msg = (f"Document expiré depuis {abs(jours)} jour(s)" if jours < 0
                   else f"Document expire dans {jours} jour(s)")
            await creer_notification("document_expiration", f"{doc['type']} — {doc['immatriculation']}", msg)

        # Maintenances urgentes non résolues
        maints = await db.query("""
            SELECT m.id, m.type, m.date_prevue, v.immatriculation
            FROM maintenances_planifiees m
            JOIN vehicules v ON v.id = m.vehicule_id
            WHERE m.priorite IN ('urgente','haute')
              AND m.statut NOT IN ('terminee','annulee')
              AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.type = 'maintenance_urgente'
                  AND DATE(n.created_at) = CURDATE()
                  AND n.titre LIKE CONCAT('%', v.immatriculation, '%')
              )
        """)

        for m in maints:
            avant = f" avant le {m['date_prevue'].strftime('%d/%m/%Y')}" if m["date_prevue"] else ""
            await creer_notification(
                "maintenance_urgente",
                f"Maintenance {m['type']} — {m['immatriculation']}",
                f"Maintenance urgente à traiter{avant}",
            )

        print(f"[Notifications] {len(docs)} docs + {len(maints)} maintenances vérifiés")
    except Exception as err:
        print("Erreur verifier_alertes_periodiques :", err)
