#!/bin/bash
# Initialisation de la base au premier démarrage du conteneur MySQL (docker compose).
# Les scripts doivent s'exécuter dans cet ordre, d'où ce script plutôt qu'un tri alphabétique.
set -e

for f in schema migrate_modules migrate_maintenances migrate_clients migrate_v2 migrate_phase3; do
  echo "[init] $f.sql"
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < "/sql/$f.sql"
done

# Données de démonstration : uniquement en local (SEED_DEMO=1), jamais en production
if [ "${SEED_DEMO:-0}" = "1" ]; then
  echo "[init] seed_demo.sql"
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < /sql/seed_demo.sql
fi
