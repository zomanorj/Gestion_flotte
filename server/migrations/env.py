# Environnement Alembic
#
# Les migrations sont écrites en SQL (op.execute) : le projet n'utilise pas de modèles
# SQLAlchemy, l'autogénération n'est donc pas utilisée.
#
# Deux façons d'arriver ici :
# - au démarrage de l'API (app/migrations.py), qui transmet sa connexion dans
#   config.attributes["connection"] (elle détient le verrou de migration) ;
# - en ligne de commande (`alembic upgrade head`, `alembic history`…), qui ouvre sa propre
#   connexion avec les mêmes variables d'environnement que l'API.
from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from app.migrations import url_base_de_donnees


def _executer(connexion) -> None:
    context.configure(connection=connexion, target_metadata=None, compare_type=False)
    with context.begin_transaction():
        context.run_migrations()


def executer_en_ligne() -> None:
    connexion = context.config.attributes.get("connection")
    if connexion is not None:
        _executer(connexion)
        return
    moteur = create_engine(url_base_de_donnees(), poolclass=NullPool)
    with moteur.connect() as connexion:
        _executer(connexion)


if context.is_offline_mode():
    context.configure(url=url_base_de_donnees(), literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    executer_en_ligne()
