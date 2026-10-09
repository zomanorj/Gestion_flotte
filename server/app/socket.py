# Serveur Socket.io partagé (compatible socket.io-client v4)
#
# Toute connexion doit présenter un JWT valide : io(url, { auth: { token } }).
# Chaque client rejoint des rooms qui permettent de cibler les émissions :
#   user:<id>   — un utilisateur précis (notifications personnelles, déconnexion forcée)
#   role:<role> — tous les utilisateurs d'un rôle (alertes réservées à la gestion)
import socketio

from .auth import utilisateur_depuis_token
from .config import config
from .exceptions import ErreurMetier

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=config().origines_client,
)


@sio.event
async def connect(sid, _environ, auth):
    token = auth.get("token") if isinstance(auth, dict) else None
    try:
        user = await utilisateur_depuis_token(token)
    except ErreurMetier as err:
        # Refus explicite : le client reçoit connect_error avec ce message
        raise socketio.exceptions.ConnectionRefusedError(err.message) from None

    await sio.save_session(sid, {"user": user})
    await sio.enter_room(sid, f"user:{user['id']}")
    await sio.enter_room(sid, f"role:{user['role']}")
    print(f"[Socket] Connexion {sid} (utilisateur {user['id']}, {user['role']})")


@sio.event
async def disconnect(sid, *_args):
    print(f"[Socket] Déconnexion {sid}")


async def deconnecter_utilisateur(user_id: int) -> None:
    """Ferme les sockets ouverts d'un utilisateur (compte désactivé, tokens révoqués)."""
    sids = [sid for sid, _ in sio.manager.get_participants("/", f"user:{user_id}")]
    for sid in sids:
        await sio.disconnect(sid)
