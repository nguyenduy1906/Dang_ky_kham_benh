"""PostgreSQL connections commit on success and roll back on failure."""
from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from backend.app.core.config import postgres_options


@contextmanager
def get_db_connection():
    with psycopg.connect(**postgres_options(), row_factory=dict_row) as db:
        yield db
