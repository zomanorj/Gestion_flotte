"""
Règles métier testées sans base de données.

Les fonctions pures sont appelées directement ; les services sont testés avec des
repositories simulés (monkeypatch), ce que permet la séparation en couches.
"""
import asyncio

import pytest

from app.exceptions import AccesRefuse, Conflit, Introuvable
from app.services import chauffeurs, documents, exploitation, missions, notifications, paie, tableau_de_bord, vehicules
from app.services.parametres import Parametres

BAREME = Parametres.par_defaut()

ADMIN = {"id": 1, "role": "admin"}
GESTIONNAIRE = {"id": 2, "role": "gestionnaire"}
CHAUFFEUR = {"id": 3, "role": "chauffeur"}


def executer(coro):
    return asyncio.run(coro)


class TestPaie:
    def test_sans_mission(self):
        assert paie.calculer_remuneration(800000, 50000, [], BAREME) == {
            "nb_missions": 0, "total_km": 0, "salaire_base": 800000, "total_primes": 0,
            "km_bonus": 0, "total_brut": 800000, "cnaps": 8000, "net_a_payer": 792000,
        }

    @pytest.mark.parametrize("distances,bonus", [
        ([500], 0),             # le seuil lui-même ne donne rien
        ([999], 0),             # tranche entamée : pas de bonus
        ([1000], 20000),        # une tranche complète au-delà de 500 km
        ([700, 700], 20000),    # 1 400 km
        ([1500], 40000),
    ])
    def test_bonus_kilometrique(self, distances, bonus):
        assert paie.calculer_remuneration(800000, 50000, distances, BAREME)["km_bonus"] == bonus

    def test_valeurs_par_defaut_si_non_renseignees(self):
        calcul = paie.calculer_remuneration(None, None, [100], BAREME)
        assert (calcul["salaire_base"], calcul["total_primes"]) == (800000, 50000)

    def test_bareme_modifie(self):
        bareme = Parametres(**{**BAREME.__dict__, "seuil_bonus_km": 1000, "tranche_bonus_km": 250,
                               "bonus_par_tranche": 10000, "taux_cnaps": 2.5})
        calcul = paie.calculer_remuneration(800000, 50000, [1600], bareme)
        assert calcul["km_bonus"] == 20000            # 600 km au-delà de 1 000 : 2 tranches de 250
        assert calcul["cnaps"] == round(870000 * 0.025)

    def test_cnaps_arrondi(self):
        assert paie.calculer_remuneration(812345, 0, [], BAREME)["cnaps"] == 8123

    def test_masse_salariale_en_deux_requetes(self, monkeypatch):
        """Ancien comportement : 2 requêtes par chauffeur. Désormais 2 au total."""
        appels = []

        async def tous_pour_paie():
            appels.append("chauffeurs")
            return [{"id": i, "nom": f"N{i}", "prenom": "P", "salaire_base": 800000, "prime_mission": 50000}
                    for i in range(1, 51)]

        async def distances_terminees_du_mois(annee, mois):
            appels.append("missions")
            return {1: [700.0, 700.0], 2: [100.0]}

        async def actuels():
            return BAREME

        monkeypatch.setattr(paie.depot_chauffeurs, "tous_pour_paie", tous_pour_paie)
        monkeypatch.setattr(paie.depot_missions, "distances_terminees_du_mois", distances_terminees_du_mois)
        monkeypatch.setattr(paie.parametres, "actuels", actuels)

        resume = executer(paie.masse_salariale(2026, 10))
        assert appels == ["chauffeurs", "missions"]
        assert len(resume["fiches"]) == 50
        assert resume["fiches"][0]["net_a_payer"] == 910800
        assert resume["nb_missions"] == 3

    def test_bulletin_d_un_autre_chauffeur_refuse(self, monkeypatch):
        async def proprietaire(id):
            return 99

        monkeypatch.setattr(paie.depot_chauffeurs, "proprietaire", proprietaire)
        with pytest.raises(AccesRefuse):
            executer(paie.bulletin_pdf(5, 2026, 10, CHAUFFEUR))


class TestMissions:
    @pytest.mark.parametrize("distance,conso,attendu", [
        (200, 0.3, 312000),      # 200 km × 0,3 L/km × 5 200 Ar
        (0, 0.3, 0),
        (None, 0.3, 0),
        (100, None, 156000),     # consommation par défaut du paramètre : 0,30 L/km
    ])
    def test_cout_carburant(self, distance, conso, attendu):
        assert missions.cout_carburant(distance, conso, BAREME.prix_litre_gasoil,
                                       BAREME.consommation_par_defaut) == pytest.approx(attendu)

    def test_cout_carburant_suit_le_prix(self):
        assert missions.cout_carburant(100, 0.3, 6000, 0.3) == pytest.approx(180000)

    def test_evenement_planning(self):
        evenement = missions.evenement_planning({
            "id": 7, "titre": "Riz", "immatriculation": "MAD-1", "marque": "Volvo", "statut": "en_cours",
            "date_depart": "d", "date_retour_prevue": "f", "chauffeur_prenom": "Paul", "chauffeur_nom": "Rabe",
            "lieu_depart": "A", "lieu_destination": "B", "distance_km": 10, "poids_charge": None,
        })
        assert evenement["title"] == "MAD-1 — Riz"
        assert (evenement["color"], evenement["textColor"]) == ("#212529", "#ffffff")
        assert evenement["extendedProps"]["chauffeur"] == "Paul Rabe"


class TestChauffeurs:
    FICHE = {"id": 10, "user_id": 3, "nom": "Rabe", "salaire_base": 900000, "prime_mission": 60000}

    @pytest.mark.parametrize("user,visible", [(ADMIN, True), (GESTIONNAIRE, True), (CHAUFFEUR, True),
                                              ({"id": 4, "role": "chauffeur"}, False)])
    def test_visibilite_de_la_remuneration(self, user, visible):
        assert ("salaire_base" in chauffeurs.masquer_salaire(self.FICHE, user)) is visible

    def test_fiche_sans_compte_lie_jamais_visible_par_un_chauffeur(self):
        assert not chauffeurs.peut_voir_remuneration({"user_id": None}, {"id": None, "role": "chauffeur"})


class TestSuppressionsProtegees:
    @pytest.fixture
    def camion(self, monkeypatch):
        async def obtenir(id, *args, **kwargs):
            return {"id": id, "immatriculation": "MAD-9"} if id == 1 else None

        monkeypatch.setattr(vehicules.depot, "obtenir", obtenir)

        def avec_usage(nb, actives):
            async def nombre_par_ressource(colonne, id):
                return {"nb": nb, "actives": actives}
            monkeypatch.setattr(vehicules.depot_missions, "nombre_par_ressource", nombre_par_ressource)

        return avec_usage

    def test_camion_avec_missions_actives(self, camion):
        camion(nb=2, actives=1)
        with pytest.raises(Conflit, match="missions en cours ou planifiées"):
            executer(vehicules.supprimer(1))

    def test_camion_avec_historique(self, camion):
        camion(nb=4, actives=0)
        with pytest.raises(Conflit, match="historique de 4 mission"):
            executer(vehicules.supprimer(1))

    def test_camion_inconnu(self, camion):
        with pytest.raises(Introuvable):
            executer(vehicules.supprimer(2))


class TestDocuments:
    @pytest.mark.parametrize("nom,attendu", [
        ("assurance.pdf", "documents/doc_4_1000_assurance.pdf"),
        ("Carte Grise 2026.PDF", "documents/doc_4_1000_Carte_Grise_2026.pdf"),
        ("../../etc/passwd.png", "documents/doc_4_1000_passwd.png"),
        ("ééé.jpg", "documents/doc_4_1000____.jpg"),
    ])
    def test_cle_de_stockage_sure(self, nom, attendu):
        assert documents.cle_de_stockage(4, nom, 1000) == attendu

    def test_enrichir(self):
        assert documents.enrichir({"jours_restants": -2}, 30)["statut"] == "expire"
        assert documents.enrichir({"jours_restants": 40}, 30)["statut"] == "valide"


def test_maintenances_depassee_en_booleen():
    assert exploitation.avec_depassee([{"depassee": 1}, {"depassee": 0}]) == [{"depassee": True},
                                                                               {"depassee": False}]


def test_cout_du_plein():
    assert exploitation.cout_du_plein(40, 5200.5) == 208020


@pytest.mark.parametrize("jours,message", [(-3, "Document expiré depuis 3 jour(s)"),
                                           (0, "Document expire dans 0 jour(s)")])
def test_message_d_expiration(jours, message):
    assert notifications.message_expiration(jours) == message


def test_semaines_numerotees():
    assert tableau_de_bord.semaines_numerotees([{"count": 2}, {"count": 5}]) == [
        {"semaine": "Sem 1", "count": 2}, {"semaine": "Sem 2", "count": 5}]
