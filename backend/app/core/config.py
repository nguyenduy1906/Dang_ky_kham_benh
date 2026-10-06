"""Stable paths; relative DB_PATH values are relative to this backend folder."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]


def resolve_db_path(value=None):
    path = Path(value if value is not None else os.environ.get('DB_PATH', 'data/medical_booking.db')).expanduser()
    return (path if path.is_absolute() else BASE_DIR / path).resolve()


DB_PATH = resolve_db_path()
