"""Create the Flask backend after database initialization and seed."""
from flask import Flask
from backend.app.db.database import get_db_connection
from backend.app.routes import health_routes


def create_app():
    with get_db_connection() as db:
        if not db.execute("SELECT to_regclass('role') AS table_name").fetchone()['table_name']:
            raise RuntimeError('Run python -m backend.app.db.init_db first')
        if not db.execute('SELECT 1 FROM role LIMIT 1').fetchone():
            raise RuntimeError('Run python -m backend.app.db.seed_db first')
    app = Flask(__name__)
    app.register_blueprint(health_routes)
    return app


if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=5000, debug=False)
