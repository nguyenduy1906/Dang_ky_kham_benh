"""SQL operations for database initialization and seed."""
from backend.app.config.settings import DATABASE_DIR


def lock_initialization(db):
    return db.execute('SELECT pg_advisory_xact_lock(78124001)')


def run_schema(db):
    return db.execute((DATABASE_DIR / 'init_db.sql').read_text(encoding='utf-8'))


def lock_seed(db):
    return db.execute('SELECT pg_advisory_xact_lock(78124001)')


def find_role_table(db):
    return db.execute("SELECT to_regclass('role') AS table_name")


def insert_role(db, params):
    return db.execute('INSERT INTO role(role_name,description,requires_approval)\n                          VALUES (%s,%s,%s) ON CONFLICT(role_name) DO NOTHING', params)


def find_admin(db, params):
    return db.execute('SELECT user_id FROM users WHERE lower(email)=%s', params)


def get_admin_role(db, params):
    return db.execute('SELECT role_id FROM role WHERE role_name=%s', params)


def insert_admin(db, params):
    return db.execute('INSERT INTO users(role_id,full_name,email,password_hash,approval_status)\n                              VALUES (%s,%s,%s,%s,%s)', params)


def find_demo_author(db, params):
    return db.execute('SELECT user_id FROM users WHERE email=%s', params)


def get_demo_role(db, params):
    return db.execute('SELECT role_id FROM role WHERE role_name=%s', params)


def insert_demo_author(db, params):
    return db.execute('INSERT INTO users(role_id,full_name,email,password_hash,account_status,approval_status)\n                    VALUES (%s,%s,%s,%s,%s,%s) RETURNING user_id', params)


def insert_demo_article(db, params):
    return db.execute('INSERT INTO article(author_id,title,slug,category,content,is_active)\n                          VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(slug) DO NOTHING', params)
