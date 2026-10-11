"""Database checks used during application startup."""


def role_table_exists(db):
    return db.execute("SELECT to_regclass('role') AS table_name").fetchone()['table_name']


def roles_seeded(db):
    return db.execute('SELECT 1 FROM role LIMIT 1').fetchone()
