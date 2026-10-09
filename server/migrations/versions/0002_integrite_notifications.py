"""Intégrité : clés étrangères des notifications, index en double sur les documents.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-09

- notifications.user_id et notifications.vehicule_id n'avaient pas de clé étrangère : des
  notifications pouvaient viser un compte ou un véhicule supprimé. Les orphelines existantes
  sont nettoyées avant d'ajouter les contraintes.
- documents.date_expiration était indexée deux fois (idx_documents_exp et
  idx_documents_expiration) : l'un des deux est supprimé.
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Notification personnelle d'un compte disparu : plus personne ne peut la lire
    op.execute("DELETE FROM notifications WHERE user_id IS NOT NULL "
               "AND user_id NOT IN (SELECT id FROM users)")
    # Véhicule disparu : la notification reste lisible, sans lien vers le véhicule
    op.execute("UPDATE notifications SET vehicule_id = NULL WHERE vehicule_id IS NOT NULL "
               "AND vehicule_id NOT IN (SELECT id FROM vehicules)")

    op.execute("ALTER TABLE notifications "
               "ADD CONSTRAINT fk_notification_user FOREIGN KEY (user_id) "
               "REFERENCES users (id) ON DELETE CASCADE")
    op.execute("ALTER TABLE notifications "
               "ADD CONSTRAINT fk_notification_vehicule FOREIGN KEY (vehicule_id) "
               "REFERENCES vehicules (id) ON DELETE SET NULL")

    op.execute("DROP INDEX idx_documents_exp ON documents")


def downgrade() -> None:
    op.execute("CREATE INDEX idx_documents_exp ON documents (date_expiration)")
    op.execute("ALTER TABLE notifications DROP FOREIGN KEY fk_notification_vehicule")
    op.execute("ALTER TABLE notifications DROP FOREIGN KEY fk_notification_user")
    # MySQL a créé un index pour chaque clé étrangère ; idx_notifications_user_date couvre déjà user_id
    op.execute("DROP INDEX fk_notification_vehicule ON notifications")
