"""Validate database readiness before starting Flask."""
from backend.app.config.database import get_db_connection
from backend.app.repositories.startup_repository import role_table_exists, roles_seeded


def check_database_ready():
    with get_db_connection() as db:
        if not role_table_exists(db):
            raise RuntimeError('Run python -m backend.app.utils.init_db first')
        if not roles_seeded(db):
            raise RuntimeError('Run python -m backend.app.utils.seed_db first')
