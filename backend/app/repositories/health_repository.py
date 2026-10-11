def ping(db):
    return db.execute("SELECT 1").fetchone()
