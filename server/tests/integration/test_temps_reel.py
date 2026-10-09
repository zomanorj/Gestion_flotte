"""Socket.io : authentification, coupure des sessions révoquées, diffusion des événements de mission."""
import asyncio

import pytest
import socketio


def _token(headers: dict) -> str:
    return headers["Authorization"].removeprefix("Bearer ")


async def _connecter(serveur: str, token: str | None, delai: float = 5) -> socketio.AsyncClient:
    client = socketio.AsyncClient(reconnection=False)
    await client.connect(serveur, auth={"token": token} if token is not None else None, wait_timeout=delai)
    return client


async def _attendre(condition, delai: float = 10.0) -> bool:
    fin = asyncio.get_running_loop().time() + delai
    while asyncio.get_running_loop().time() < fin:
        if condition():
            return True
        await asyncio.sleep(0.1)
    return condition()


@pytest.mark.parametrize("token", [None, "", "token-invalide"])
def test_connexion_refusee_sans_token_valide(serveur, token):
    async def scenario():
        with pytest.raises(socketio.exceptions.ConnectionError):
            await _connecter(serveur, token, delai=1)

    asyncio.run(scenario())


def test_connexion_acceptee(serveur, chauffeur):
    async def scenario():
        client = await _connecter(serveur, _token(chauffeur))
        assert client.connected
        await client.disconnect()

    asyncio.run(scenario())


def test_desactivation_ferme_le_socket(serveur, api, admin, nouvel_utilisateur):
    u = nouvel_utilisateur()

    async def scenario():
        client = await _connecter(serveur, _token(u["headers"]))
        r = await asyncio.to_thread(api.delete, f"/users/{u['id']}", headers=admin)
        assert r.status_code == 200
        assert await _attendre(lambda: not client.connected, 5)
        with pytest.raises(socketio.exceptions.ConnectionError):
            await _connecter(serveur, _token(u["headers"]), delai=1)

    asyncio.run(scenario())


def test_compte_desactive_en_base_refuse_au_socket(serveur, nouvel_utilisateur, sql):
    u = nouvel_utilisateur()
    sql("UPDATE users SET is_active = 0 WHERE id = %s", [u["id"]])

    async def scenario():
        with pytest.raises(socketio.exceptions.ConnectionError):
            await _connecter(serveur, _token(u["headers"]), delai=1)

    asyncio.run(scenario())


def test_evenement_mission_nouvelle_diffuse(serveur, api, admin, chauffeur, vehicule, chauffeur_fiche):
    async def scenario():
        recus = []
        client = socketio.AsyncClient(reconnection=False)
        client.on("mission:nouvelle", lambda data: recus.append(data))
        await client.connect(serveur, auth={"token": _token(chauffeur)}, wait_timeout=5)
        r = await asyncio.to_thread(api.post, "/missions", headers=admin, json={
            "titre": "Diffusée", "vehicule_id": vehicule["id"], "chauffeur_id": chauffeur_fiche["id"],
            "lieu_depart": "Antananarivo", "lieu_destination": "Moramanga",
            "date_depart": "2034-01-01T08:00", "date_retour_prevue": "2034-01-02T08:00",
        })
        assert await _attendre(lambda: any(d["id"] == r.json()["id"] for d in recus), 5)
        await client.disconnect()

    asyncio.run(scenario())


def test_changement_de_statut_diffuse(serveur, api, admin, chauffeur, vehicule, chauffeur_fiche, creer_mission):
    """Démarrage d'une mission : les écrans ouverts ailleurs (listes, Mes missions) se mettent à jour."""
    mid = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2034-02-01T08:00", "2034-02-02T08:00").json()["id"]

    async def scenario():
        recus = []
        client = socketio.AsyncClient(reconnection=False)
        client.on("mission:statut", lambda data: recus.append(data))
        await client.connect(serveur, auth={"token": _token(chauffeur)}, wait_timeout=5)
        r = await asyncio.to_thread(api.put, f"/missions/{mid}/statut", headers=admin, json={"statut": "en_cours"})
        assert r.status_code == 200
        assert await _attendre(lambda: {"id": mid, "statut": "en_cours"} in recus, 5)
        await client.disconnect()

    asyncio.run(scenario())
