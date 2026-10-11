"""Record status changes and their notifications in the caller's transaction."""
from backend.app.repositories import encounter_log_repository
from backend.app.services.notification_service import notify_status


def add_status(db, encounter_id, old_status, new_status, actor_id, note=None):
    log_id = encounter_log_repository.add_status(db, encounter_id, old_status, new_status, actor_id, note)
    notify_status(db, encounter_id, log_id, new_status, note)
