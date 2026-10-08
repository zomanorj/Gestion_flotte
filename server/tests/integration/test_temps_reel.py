"""Socket.io : authentification, coupure des sessions révoquées, simulation de mission en direct."""
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


def test_simulation_de_mission(serveur, api, admin, vehicule, chauffeur_fiche, creer_mission):
    mission = creer_mission(vehicule["id"], chauffeur_fiche["id"], "2034-02-01T08:00", "2034-02-02T08:00").json()
    mid = mission["id"]

    async def scenario():
        recus: dict[str, list] = {}
        client = socketio.AsyncClient(reconnection=False)

        @client.on("*")
        async def tout(evenement, data):
            recus.setdefault(evenement, []).append(data)

        await client.connect(serveur, auth={"token": _token(admin)}, wait_timeout=5)

        r = await asyncio.to_thread(api.post, f"/simulation/demarrer/{mid}", headers=admin)
        assert r.status_code == 200
        assert r.json()["mission"]["camion"] == vehicule["immatriculation"]

        assert await _attendre(lambda: f"mission:{mid}:debut" in recus)
        debut = recus[f"mission:{mid}:debut"][0]
        assert debut["totalPoints"] == 51  # tracé de secours (OSRM désactivé en test)
        assert debut["multiplicateur"] == 30

        r = await asyncio.to_thread(api.post, f"/simulation/vitesse/{mid}", headers=admin, json={"multiplicateur": 60})
        assert r.json()["multiplicateur"] == 60
        assert await _attendre(lambda: f"mission:{mid}:position" in recus)
        assert await _attendre(lambda: "flotte:positions" in recus)

        actives = (await asyncio.to_thread(api.get, "/simulation/actives", headers=admin)).json()
        assert str(mid) in [a["missionId"] for a in actives]

        # Déjà en cours : un second démarrage est refusé
        r = await asyncio.to_thread(api.post, f"/simulation/demarrer/{mid}", headers=admin)
        assert r.status_code == 409

        # Annuler la mission arrête la simulation
        await asyncio.to_thread(api.put, f"/missions/{mid}/statut", headers=admin, json={"statut": "annulee"})
        actives = (await asyncio.to_thread(api.get, "/simulation/actives", headers=admin)).json()
        assert str(mid) not in [a["missionId"] for a in actives]
        await client.disconnect()

    asyncio.run(scenario())


def test_vitesse_simulation_inexistante(api, admin):
    assert api.post("/simulation/vitesse/999999", headers=admin, json={"multiplicateur": 5}).status_code == 404


def test_calcul_d_itineraire(api, admin):
    r = api.post("/simulation/route", headers=admin, json={"villeDepart": "Antananarivo", "villeArrivee": "Toamasina"})
    assert r.status_code == 200
    assert 210 < r.json()["distanceKm"] < 225  # ligne droite (OSRM désactivé en test)
    r = api.post("/simulation/route", headers=admin, json={"villeDepart": "Paris", "villeArrivee": "Toamasina"})
    assert r.status_code == 400
