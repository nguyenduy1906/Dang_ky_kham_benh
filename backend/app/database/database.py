"""All database consumers use this context manager, not raw global connections."""
import sqlite3
from contextlib import contextmanager
from backend.app.core.config import resolve_db_path


@contextmanager
def get_db_connection(path=None, *, create=False):
    target = resolve_db_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    uri = target.as_uri() + ('?mode=rwc' if create else '?mode=rw')
    db = sqlite3.connect(uri, uri=True, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()
