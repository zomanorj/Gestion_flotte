"""Paramètres métier modifiables par l'administrateur, et leur historique.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-09

Les définitions (libellé, unité, valeur par défaut, bornes) sont dans le code
(app/services/parametres.py) : la table ne contient que les valeurs modifiées. Une base neuve
fonctionne donc sans aucune ligne ici. Chaque modification est tracée dans
parametres_historique (les paramètres de paie influent directement sur les salaires).
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE parametres (
          cle         VARCHAR(50)  NOT NULL,
          valeur      VARCHAR(255) NOT NULL,
          modifie_par INT          NULL,
          modifie_le  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (cle),
          CONSTRAINT fk_parametre_user FOREIGN KEY (modifie_par) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    op.execute("""
        CREATE TABLE parametres_historique (
          id              INT          NOT NULL AUTO_INCREMENT,
          cle             VARCHAR(50)  NOT NULL,
          ancienne_valeur VARCHAR(255) NULL COMMENT 'NULL : la valeur par défaut était en vigueur',
          nouvelle_valeur VARCHAR(255) NULL COMMENT 'NULL : retour à la valeur par défaut',
          modifie_par     INT          NULL,
          modifie_le      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_parametres_historique_date (modifie_le),
          CONSTRAINT fk_parametre_historique_user FOREIGN KEY (modifie_par) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)


def downgrade() -> None:
    op.execute("DROP TABLE parametres_historique")
    op.execute("DROP TABLE parametres")
