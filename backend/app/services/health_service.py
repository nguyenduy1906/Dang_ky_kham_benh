from backend.app.config.database import get_db_connection
from backend.app.repositories.health_repository import ping


def check_health():
    with get_db_connection() as db:
        ping(db)
    return {"status": "ok", "database": "postgresql"}
