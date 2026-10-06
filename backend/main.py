"""Initialize and seed explicitly before running this Flask entrypoint."""
from flask import Flask
from backend.app.core.config import resolve_db_path
from backend.app.database.database import get_db_connection
from backend.app.routes import health_routes


def create_app(db_path=None):
    target = resolve_db_path(db_path)
    if not target.is_file():
        raise RuntimeError('Run python -m backend.app.database.init_db and python -m backend.app.database.seed_db first')
    with get_db_connection(target) as db:
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='role'").fetchone():
            raise RuntimeError('Run init_db.py to initialize the database first')
        if not db.execute('SELECT 1 FROM role LIMIT 1').fetchone():
            raise RuntimeError('Run seed_db.py first')
    app = Flask(__name__)
    app.config['DB_PATH'] = target
    app.register_blueprint(health_routes)
    return app


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=5000, debug=False)
