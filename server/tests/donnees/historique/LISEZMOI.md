# Scripts SQL historiques (figés)

Scripts qui créaient la base avant le passage aux migrations versionnées (Alembic). Ils ne
servent plus à l'installation : ils sont conservés uniquement pour
`tests/integration/test_migrations.py`, qui construit une base « historique » avec eux, la
fait migrer par l'API, et vérifie qu'elle devient identique à une base créée par les
migrations. C'est la garantie que les bases de production existantes migrent correctement.

Ne pas les modifier.
