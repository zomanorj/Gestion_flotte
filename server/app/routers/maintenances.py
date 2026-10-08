# Routes maintenances planifiées — suivi et alertes
from fastapi import APIRouter, Request

from .. import db
from ..auth import Admin, Connecte, Gestionnaire
from ..erreurs import ErreurApi
from ..temps import aujourdhui
from ..utils import Pagination, corps, ou_none

router = APIRouter()

SELECT_MAINTENANCE = """
    SELECT mp.*, v.immatriculation, v.marque
    FROM maintenances_planifiees mp JOIN vehicules v ON mp.vehicule_id = v.id
    WHERE mp.id = %s
"""


def avec_depassee(rows: list[dict]) -> list[dict]:
    return [{**r, "depassee": bool(r["depassee"])} for r in rows]


@router.get("/alertes", dependencies=[Connecte])
async def get_alertes():
    """
    Maintenances urgentes :
    - date_prevue dans les 7 prochains jours ou dépassée
    - OU priorite = 'urgente'
    - OU kilométrage véhicule >= kilometrage_declencheur
    """
    rows = await db.query("""
        SELECT mp.*, v.immatriculation, v.marque, v.modele, v.kilometrage,
          (mp.date_prevue < CURDATE()) AS depassee
        FROM maintenances_planifiees mp
        JOIN vehicules v ON mp.vehicule_id = v.id
        WHERE mp.statut NOT IN ('terminee','annulee')
          AND (
            mp.date_prevue <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            OR mp.priorite = 'urgente'
            OR (mp.kilometrage_declencheur IS NOT NULL AND v.kilometrage >= mp.kilometrage_declencheur)
          )
        ORDER BY mp.priorite DESC, mp.date_prevue ASC
    """)
    return avec_depassee(rows)


@router.get("", dependencies=[Connecte])
async def get_all(
    request: Request,
    statut: str | None = None,
    priorite: str | None = None,
    vehicule_id: str | None = None,
):
    """
    Toutes les maintenances avec infos véhicule. Filtres : ?statut=&priorite=&vehicule_id=
    Ajoute le flag "depassee" si date_prevue < aujourd'hui et statut != terminee/annulee.
    """
    where, params = " WHERE 1=1", []
    for colonne, valeur in (("mp.statut", statut), ("mp.priorite", priorite), ("mp.vehicule_id", vehicule_id)):
        if valeur:
            where += f" AND {colonne} = %s"
            params.append(valeur)

    query = """
        SELECT mp.*, v.immatriculation, v.marque, v.modele, v.kilometrage,
          (mp.date_prevue < CURDATE() AND mp.statut NOT IN ('terminee','annulee')) AS depassee
        FROM maintenances_planifiees mp
        JOIN vehicules v ON mp.vehicule_id = v.id
    """ + where + " ORDER BY mp.date_prevue ASC"

    pg = Pagination(request)
    if pg.actif:
        count = await db.query_one("SELECT COUNT(*) AS total FROM maintenances_planifiees mp" + where, params)
        rows = await db.query(query + " LIMIT %s OFFSET %s", params + [pg.limit, pg.offset])
        return pg.reponse(avec_depassee(rows), count["total"])

    return avec_depassee(await db.query(query, params))


@router.post("", status_code=201, dependencies=[Gestionnaire])
async def create(request: Request):
    """Planifie une nouvelle maintenance."""
    b = await corps(request)
    if not b.get("vehicule_id") or not b.get("type"):
        raise ErreurApi(400, "vehicule_id et type sont obligatoires")

    new_id = await db.execute(
        """INSERT INTO maintenances_planifiees
             (vehicule_id, type, description, kilometrage_declencheur,
              date_prevue, cout_estime, garage, priorite)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        [
            b["vehicule_id"], b["type"], ou_none(b.get("description")),
            ou_none(b.get("kilometrage_declencheur")), ou_none(b.get("date_prevue")),
            ou_none(b.get("cout_estime")), ou_none(b.get("garage")), b.get("priorite") or "normale",
        ],
    )
    return await db.query_one(SELECT_MAINTENANCE, [new_id])


@router.put("/{id}", dependencies=[Gestionnaire])
async def update(id: int, request: Request):
    """Met à jour une maintenance planifiée."""
    b = await corps(request)
    if not await db.query("SELECT id FROM maintenances_planifiees WHERE id = %s", [id]):
        raise ErreurApi(404, "Maintenance introuvable")

    await db.execute(
        """UPDATE maintenances_planifiees
           SET vehicule_id=%s, type=%s, description=%s, kilometrage_declencheur=%s,
               date_prevue=%s, cout_estime=%s, garage=%s, statut=%s, priorite=%s, notes=%s
           WHERE id=%s""",
        [
            b.get("vehicule_id"), b.get("type"), ou_none(b.get("description")),
            ou_none(b.get("kilometrage_declencheur")), ou_none(b.get("date_prevue")),
            ou_none(b.get("cout_estime")), ou_none(b.get("garage")),
            b.get("statut") or "planifiee", b.get("priorite") or "normale", ou_none(b.get("notes")), id,
        ],
    )
    return await db.query_one(SELECT_MAINTENANCE, [id])


@router.put("/{id}/terminer", dependencies=[Gestionnaire])
async def terminer(id: int, request: Request):
    """Clôture une maintenance avec date réelle, coût réel et notes."""
    b = await corps(request)
    if not await db.query("SELECT id FROM maintenances_planifiees WHERE id = %s", [id]):
        raise ErreurApi(404, "Maintenance introuvable")

    await db.execute(
        """UPDATE maintenances_planifiees
           SET statut='terminee', date_realisee=%s, cout_reel=%s, notes=%s
           WHERE id=%s""",
        [b.get("date_realisee") or aujourdhui().isoformat(), ou_none(b.get("cout_reel")), ou_none(b.get("notes")), id],
    )
    return await db.query_one(SELECT_MAINTENANCE, [id])


@router.delete("/{id}", dependencies=[Admin])
async def remove(id: int):
    if not await db.query("SELECT id FROM maintenances_planifiees WHERE id = %s", [id]):
        raise ErreurApi(404, "Maintenance introuvable")

    await db.execute("DELETE FROM maintenances_planifiees WHERE id = %s", [id])
    return {"message": "Maintenance supprimée"}
