# Règles métier : notifications et vérification périodique des alertes
#
# Destinataires :
#   user_id renseigné → cet utilisateur uniquement ;
#   user_id NULL      → l'équipe de gestion (rôles admin et gestionnaire).
# L'état lu / supprimé est propre à chaque utilisateur : marquer ou supprimer une notification
# n'affecte jamais les autres destinataires.
from ..auth import ROLES_GESTION
from ..exceptions import Introuvable
from ..repositories import comptes as depot
from ..socket import sio
from ..temps import maintenant

DUREE_CONSERVATION_JOURS = 90
NOMBRE_AFFICHE = 50


def message_expiration(jours: int) -> str:
    if jours < 0:
        return f"Document expiré depuis {abs(jours)} jour(s)"
    return f"Document expire dans {jours} jour(s)"


async def creer_notification(type: str, titre: str, message: str, vehicule_id: int | None = None,
                             user_id: int | None = None) -> dict | None:
    """Enregistre la notification et l'émet en temps réel ('notification:nouvelle') à ses destinataires."""
    try:
        nouvel_id = await depot.creer_notification(
            {"type": type, "titre": titre, "message": message, "vehicule_id": vehicule_id, "user_id": user_id}
        )
        notification = {
            "id": nouvel_id, "type": type, "titre": titre, "message": message,
            "vehicule_id": vehicule_id, "est_lue": False,
            "created_at": maintenant().isoformat(timespec="seconds"),
        }
        destinataires = [f"user:{user_id}"] if user_id else [f"role:{r}" for r in ROLES_GESTION]
        await sio.emit("notification:nouvelle", notification, to=destinataires)
        return notification
    except Exception as err:
        # Une alerte qui échoue ne doit pas interrompre l'opération qui l'a déclenchée
        print("Erreur creer_notification :", err)
        return None


async def lister(user: dict, non_lues_seulement: bool) -> dict:
    lignes = await depot.notifications_de(user["id"], user["role"], non_lues_seulement, NOMBRE_AFFICHE)
    return {
        "notifications": [{**n, "est_lue": bool(n["est_lue"])} for n in lignes],
        "non_lues": await depot.nombre_non_lues(user["id"], user["role"]),
    }


async def _verifier_visible(id: int, user: dict) -> None:
    if not await depot.notification_visible(id, user["id"], user["role"]):
        raise Introuvable("Notification introuvable")


async def marquer_lue(id: int, user: dict) -> None:
    await _verifier_visible(id, user)
    await depot.definir_etat(id, user["id"], lue=True, supprimee=False)


async def masquer(id: int, user: dict) -> None:
    """Masque la notification pour cet utilisateur uniquement."""
    await _verifier_visible(id, user)
    await depot.definir_etat(id, user["id"], lue=True, supprimee=True)


async def tout_marquer_lu(user: dict) -> None:
    await depot.tout_marquer_lu(user["id"], user["role"])


async def verifier_alertes_periodiques() -> None:
    """Crée les notifications d'alertes (une fois par jour et par élément au maximum), puis purge."""
    try:
        documents = await depot.documents_a_notifier()
        for doc in documents:
            await creer_notification("document_expiration", f"{doc['type']} — {doc['immatriculation']}",
                                     message_expiration(int(doc["jours"])), vehicule_id=doc["vehicule_id"])

        maintenances = await depot.maintenances_a_notifier()
        for m in maintenances:
            avant = f" avant le {m['date_prevue'].strftime('%d/%m/%Y')}" if m["date_prevue"] else ""
            await creer_notification("maintenance_urgente", f"Maintenance {m['type']} — {m['immatriculation']}",
                                     f"Maintenance urgente à traiter{avant}", vehicule_id=m["vehicule_id"])

        await depot.purger_notifications(DUREE_CONSERVATION_JOURS)
        print(f"[Notifications] {len(documents)} docs + {len(maintenances)} maintenances notifiés")
    except Exception as err:
        print("Erreur verifier_alertes_periodiques :", err)
