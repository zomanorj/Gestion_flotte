# Routes camions — CRUD et alertes de maintenance
from fastapi import APIRouter, Request

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..utils import Pagination, corps, ou_none

router = APIRouter()


@router.get("", dependencies=[Connecte])
async def get_all(request: Request, statut: str | None = None, search: str | None = None):
    """Tous les véhicules avec filtres optionnels : ?statut=disponible&search=toyota"""
    where, params = " WHERE 1=1", []
    if statut:
        where += " AND statut = %s"
        params.append(statut)
    if search:
        where += " AND (immatriculation LIKE %s OR marque LIKE %s OR modele LIKE %s)"
        params += [f"%{search}%"] * 3

    query = "SELECT * FROM vehicules" + where + " ORDER BY created_at DESC"

    pg = Pagination(request)
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM vehicules" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(rows, count["total"])

    return await db.query(query, params)


@router.get("/alertes", dependencies=[Connecte])
async def get_alertes():
    """
    Véhicules nécessitant une attention :
    - CT à moins de 30 jours
    - Kilométrage > 10 000 km depuis la dernière vidange
    """
    return await db.query("""
        SELECT
          v.*,
          DATEDIFF(v.date_prochain_ct, CURDATE()) AS jours_avant_ct,
          (v.kilometrage - IFNULL(
            (SELECT m.kilometrage_au_moment
             FROM maintenances m
             WHERE m.vehicule_id = v.id AND m.type = 'Vidange'
             ORDER BY m.date_maintenance DESC LIMIT 1), 0
          )) AS km_depuis_vidange
        FROM vehicules v
        WHERE
          (v.date_prochain_ct IS NOT NULL AND v.date_prochain_ct <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
          OR
          (v.kilometrage - IFNULL(
            (SELECT m2.kilometrage_au_moment
             FROM maintenances m2
             WHERE m2.vehicule_id = v.id AND m2.type = 'Vidange'
             ORDER BY m2.date_maintenance DESC LIMIT 1), 0
          ) > 10000)
        ORDER BY v.date_prochain_ct ASC
    """)


@router.get("/{id}", dependencies=[Connecte])
async def get_by_id(id: int):
    """Un véhicule avec ses 5 dernières missions et ses maintenances."""
    vehicule = await db.query_one("SELECT * FROM vehicules WHERE id = %s", [id])
    if not vehicule:
        raise ErreurApi(404, "Véhicule introuvable")

    missions = await db.query("""
        SELECT m.*, c.nom AS chauffeur_nom, c.prenom AS chauffeur_prenom
        FROM missions m
        JOIN chauffeurs c ON m.chauffeur_id = c.id
        WHERE m.vehicule_id = %s
        ORDER BY m.date_depart DESC
        LIMIT 5
    """, [id])

    maintenances = await db.query(
        "SELECT * FROM maintenances WHERE vehicule_id = %s ORDER BY date_maintenance DESC", [id]
    )
    return {**vehicule, "missions": missions, "maintenances": maintenances}


@router.post("", status_code=201, dependencies=[Gestionnaire])
async def create(request: Request):
    """Crée un nouveau camion. Vérifie l'unicité de l'immatriculation."""
    b = await corps(request)
    if not b.get("immatriculation") or not b.get("marque") or not b.get("modele") or not b.get("annee"):
        raise ErreurApi(400, "Champs obligatoires manquants")

    if await db.query("SELECT id FROM vehicules WHERE immatriculation = %s", [b["immatriculation"]]):
        raise ErreurApi(409, "Cette immatriculation existe déjà")

    new_id = await db.execute(
        """INSERT INTO vehicules
             (immatriculation, marque, modele, annee, kilometrage, consommation_litre_km,
              statut, date_derniere_vidange, date_prochain_ct,
              tonnage, type_camion, numero_chassis)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        [
            b["immatriculation"].upper(), b["marque"], b["modele"], b["annee"],
            b.get("kilometrage") or 0,
            b.get("consommation_litre_km") or 0.30,
            b.get("statut") or "disponible",
            ou_none(b.get("date_derniere_vidange")),
            ou_none(b.get("date_prochain_ct")),
            ou_none(b.get("tonnage")),
            b.get("type_camion") or "porteur",
            ou_none(b.get("numero_chassis")),
        ],
    )
    return await db.query_one("SELECT * FROM vehicules WHERE id = %s", [new_id])


@router.put("/{id}", dependencies=[Gestionnaire])
async def update(id: int, request: Request):
    """Met à jour les champs fournis d'un camion (inclut tonnage, type et châssis)."""
    b = await corps(request)
    if not await db.query("SELECT id FROM vehicules WHERE id = %s", [id]):
        raise ErreurApi(404, "Camion introuvable")

    immat = b.get("immatriculation")
    await db.execute(
        """UPDATE vehicules SET
             immatriculation       = COALESCE(%s, immatriculation),
             marque                = COALESCE(%s, marque),
             modele                = COALESCE(%s, modele),
             annee                 = COALESCE(%s, annee),
             kilometrage           = COALESCE(%s, kilometrage),
             consommation_litre_km = COALESCE(%s, consommation_litre_km),
             statut                = COALESCE(%s, statut),
             date_derniere_vidange = COALESCE(%s, date_derniere_vidange),
             date_prochain_ct      = COALESCE(%s, date_prochain_ct),
             tonnage               = COALESCE(%s, tonnage),
             type_camion           = COALESCE(%s, type_camion),
             numero_chassis        = COALESCE(%s, numero_chassis)
           WHERE id = %s""",
        [
            immat.upper() if immat else None,
            *(ou_none(b.get(k)) for k in (
                "marque", "modele", "annee", "kilometrage", "consommation_litre_km", "statut",
                "date_derniere_vidange", "date_prochain_ct", "tonnage", "type_camion", "numero_chassis",
            )),
            id,
        ],
    )
    return await db.query_one("SELECT * FROM vehicules WHERE id = %s", [id])


@router.delete("/{id}", dependencies=[Admin])
async def remove(id: int):
    """
    Supprime un camion uniquement s'il n'a aucune mission (active ou historique) :
    l'historique de transport doit être conservé.
    """
    existant = await db.query_one("SELECT id, immatriculation FROM vehicules WHERE id = %s", [id])
    if not existant:
        raise ErreurApi(404, "Camion introuvable")

    stats = await db.query_one(
        """SELECT COUNT(*) AS nb, SUM(statut IN ('planifiee','en_cours')) AS actives
           FROM missions WHERE vehicule_id = %s""",
        [id],
    )
    immat = existant["immatriculation"]
    if (stats["actives"] or 0) > 0:
        raise ErreurApi(409, f"Impossible de supprimer : le camion {immat} a des missions en cours ou planifiées")
    if stats["nb"] > 0:
        raise ErreurApi(
            409,
            f"Impossible de supprimer : le camion {immat} a un historique de {stats['nb']} mission(s). "
            "Modifiez son statut à la place.",
        )

    await db.execute("DELETE FROM vehicules WHERE id = %s", [id])
    return {"message": "Camion supprimé avec succès"}
