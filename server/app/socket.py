# Serveur Socket.io partagé (compatible socket.io-client v4)
import os

import socketio

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=os.getenv("CLIENT_URL", "http://localhost:5173"),
)


@sio.event
async def connect(sid, _environ):
    print(f"[Socket] Client connecté : {sid}")


@sio.event
async def disconnect(sid):
    print(f"[Socket] Client déconnecté : {sid}")
