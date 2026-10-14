"""Seed base roles, optionally demo data or an initial administrator."""
import argparse
import getpass
import os
import psycopg
from backend.app.core.errors import AppError
from backend.app.db.db_service import seed_database

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--demo', action='store_true')
    parser.add_argument('--admin', action='store_true', help='Prompt for admin credentials or use ADMIN_* environment')
    args = parser.parse_args()
    options = {}
    if args.admin:
        options = {
            'admin_email': os.environ.get('ADMIN_EMAIL') or input('Admin email: '),
            'admin_name': os.environ.get('ADMIN_NAME') or input('Admin full name: '),
            'admin_password': os.environ.get('ADMIN_PASSWORD') or getpass.getpass('Admin password (12-128 characters, letters and digits): '),
        }
    try:
        seed_database(demo=args.demo, **options)
        print('Seed completed. Existing records and passwords preserved.')
    except (OSError, psycopg.Error, RuntimeError, ValueError, AppError) as error:
        parser.exit(1, ascii(str(error)) + '\n')
