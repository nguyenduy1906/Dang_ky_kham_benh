"""PostgreSQL connections commit on success and roll back on failure."""
from contextlib import contextmanager
import psycopg
from flask import has_request_context, g
from psycopg.rows import dict_row
from backend.app.core.config import postgres_options


@contextmanager
def get_db_connection(*, isolation_level=None, read_only=None):
    with psycopg.connect(**postgres_options(), row_factory=dict_row) as db:
        if isolation_level is not None:
            db.isolation_level = isolation_level
        if read_only is not None:
            db.read_only = read_only
        actor = getattr(g, 'current_user', None) if has_request_context() else None
        if actor and actor.get('role_name') == 'ADMIN':
            db.execute("SELECT set_config('app.admin_id',%s,true),set_config('app.admin_name',%s,true)",
                       (str(actor['user_id']), actor.get('full_name') or 'Admin'))
        yield db
