"""Create PostgreSQL tables without seeding or overwriting records."""
import argparse
import psycopg
from backend.app.db.db_service import init_database

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    try:
        init_database()
        print('Database initialized; existing records preserved.')
    except (OSError, psycopg.Error, RuntimeError, ValueError) as error:
        parser.exit(1, ascii(str(error)) + '\n')
