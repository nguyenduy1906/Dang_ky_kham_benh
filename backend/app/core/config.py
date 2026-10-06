"""PostgreSQL connection settings and project database resources."""
import os
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[3]
DATABASE_DIR = PROJECT_DIR / 'database'


def postgres_options():
    return dict(host=os.environ.get('DB_HOST', 'localhost'),
                port=int(os.environ.get('DB_PORT', '5433')),
                dbname=os.environ.get('DB_NAME', 'dat_lich_kham_benh'),
                user=os.environ.get('DB_USER', 'clinic'),
                password=os.environ.get('DB_PASSWORD', ''),
                connect_timeout=10, options='-c timezone=UTC')
