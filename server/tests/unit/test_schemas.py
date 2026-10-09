"""Schémas Pydantic : conversion des valeurs de formulaire, règles de validation, messages d'erreur."""
from datetime import datetime

import pytest
from pydantic import ValidationError

from app.erreurs import message_validation
from app.schemas.comptes import UtilisateurCreation, UtilisateurMiseAJour
from app.schemas.flotte import MissionCreation, VehiculeCreation, VehiculeMiseAJour
from app.schemas.operations import DocumentSaisie, MaintenanceMiseAJour, PleinSaisie
from app.schemas.pilotage import ChangementVitesse, SalaireSaisie

MISSION = {"titre": "T", "vehicule_id": 1, "chauffeur_id": 2, "lieu_depart": "A", "lieu_destination": "B",
           "date_depart": "2031-01-01T08:00", "date_retour_prevue": "2031-01-02T08:00"}


def _messages(modele, donnees) -> list[str]:
    with pytest.raises(ValidationError) as exc:
        modele(**donnees)
    return [message_validation(e) for e in exc.value.errors()]


class TestValeursDeFormulaire:
    def test_champs_vides_et_nombres_en_texte(self):
        v = VehiculeCreation(immatriculation=" mad-1 ", marque="Volvo", modele="FH", annee="2021",
                             kilometrage="", consommation_litre_km="", date_prochain_ct="", tonnage="12.5")
        assert v.immatriculation == "mad-1"
        # Consommation laissée vide : le service applique le paramètre « consommation par défaut »
        assert (v.annee, v.kilometrage, v.consommation_litre_km) == (2021, 0, None)
        assert v.date_prochain_ct is None and v.tonnage == 12.5

    @pytest.mark.parametrize("valeur,attendu", [
        ("2031-01-01", datetime(2031, 1, 1)),
        ("2031-01-01T08:30", datetime(2031, 1, 1, 8, 30)),
        ("2031-01-01 08:30:15", datetime(2031, 1, 1, 8, 30, 15)),
        ("2031-01-01T08:30:00Z", datetime(2031, 1, 1, 8, 30)),
    ])
    def test_formats_de_date_heure(self, valeur, attendu):
        m = MissionCreation(**{**MISSION, "date_depart": valeur, "date_retour_prevue": "2031-02-01"})
        assert m.date_depart == attendu and m.date_depart.tzinfo is None

    def test_client_facultatif(self):
        assert MissionCreation(**MISSION, client_id="").client_id is None


class TestMisesAJourPartielles:
    def test_seuls_les_champs_envoyes(self):
        assert VehiculeMiseAJour(kilometrage="1200").champs_fournis() == {"kilometrage": 1200}

    def test_champ_facultatif_vide_efface(self):
        assert VehiculeMiseAJour(date_prochain_ct="").champs_fournis() == {"date_prochain_ct": None}

    def test_colonne_obligatoire_vide_refusee(self):
        assert _messages(VehiculeMiseAJour, {"marque": ""}) == ["Champ obligatoire manquant : marque"]

    def test_maintenance_sans_statut_le_conserve(self):
        assert "statut" not in MaintenanceMiseAJour(type="vidange", priorite="haute").champs_fournis()


class TestMessagesFrancais:
    def test_champ_manquant(self):
        assert "Champ obligatoire manquant : titre" in _messages(MissionCreation, {**MISSION, "titre": None})

    def test_valeur_d_enum(self):
        [msg] = _messages(VehiculeCreation, {"immatriculation": "A", "marque": "a", "modele": "b", "annee": 2020,
                                             "statut": "vole"})
        assert msg.startswith("Valeur invalide pour statut. Valeurs acceptées : ")
        assert "'en_panne'" in msg

    def test_nombre(self):
        assert _messages(PleinSaisie, {"vehicule_id": 1, "date_plein": "2026-01-01", "litres": "abc",
                                       "prix_litre": 5}) == ["litres doit être un nombre"]

    def test_borne(self):
        [msg] = _messages(PleinSaisie, {"vehicule_id": 1, "date_plein": "2026-01-01", "litres": 0, "prix_litre": 5})
        assert msg == "litres doit être supérieur à 0"

    def test_date(self):
        assert _messages(MissionCreation, {**MISSION, "date_depart": "demain"}) == ["Date invalide pour date_depart"]

    def test_longueur(self):
        [msg] = _messages(VehiculeCreation, {"immatriculation": "X" * 21, "marque": "a", "modele": "b", "annee": 2020})
        assert msg == "immatriculation : 20 caractères maximum"

    def test_regle_metier_ecrite_dans_le_schema(self):
        assert _messages(MissionCreation, {**MISSION, "date_retour_prevue": "2030-01-01"}) == [
            "La date de retour prévue doit être postérieure à la date de départ"]
        assert _messages(DocumentSaisie, {"vehicule_id": 1, "type": "assurance", "date_emission": "2026-06-01",
                                          "date_expiration": "2026-01-01"}) == [
            "La date d'expiration doit être postérieure à la date d'émission"]


class TestComptes:
    def test_email_normalise(self):
        u = UtilisateurCreation(nom="A", email="  Jean@Flotte.MG ", password="motdepasse", role="chauffeur")
        assert u.email == "jean@flotte.mg"

    @pytest.mark.parametrize("email", ["pasunemail", "a@b", "@flotte.mg", "a b@flotte.mg"])
    def test_email_invalide(self, email):
        assert _messages(UtilisateurCreation, {"nom": "A", "email": email, "password": "motdepasse",
                                               "role": "chauffeur"}) == ["Adresse email invalide"]

    def test_mot_de_passe_trop_long_pour_bcrypt(self):
        [msg] = _messages(UtilisateurCreation, {"nom": "A", "email": "a@b.mg", "password": "é" * 40, "role": "admin"})
        assert "72 octets" in msg

    def test_is_active_accepte_0_et_1(self):
        assert UtilisateurMiseAJour(is_active=0).is_active is False
        assert UtilisateurMiseAJour(is_active="1").is_active is True


def test_vitesse_limitee_aux_valeurs_proposees():
    assert ChangementVitesse(multiplicateur="30").multiplicateur == 30
    with pytest.raises(ValidationError):
        ChangementVitesse(multiplicateur=7)


def test_salaire_au_moins_un_champ():
    assert _messages(SalaireSaisie, {}) == ["Au moins salaire_base ou prime_mission requis"]
    assert SalaireSaisie(prime_mission="60000").champs_fournis() == {"prime_mission": 60000}
