"""Create missing tables in the database, without seeding demo or overwriting data."""
import argparse
import sqlite3
from backend.app.core.config import resolve_db_path
from backend.app.database.db_service import init_database


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', help='Override DB_PATH; relative to backend')
    args = parser.parse_args()
    try:
        init_database(args.db)
        print('Database initialized; existing records preserved.')
        print(ascii(str(resolve_db_path(args.db))))
    except (OSError, sqlite3.Error, RuntimeError, ValueError) as error:
        parser.exit(1, ascii(str(error)) + '\n')
