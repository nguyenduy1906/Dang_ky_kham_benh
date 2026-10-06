from flask import Blueprint, current_app, jsonify
from backend.app.database.database import get_db_connection

health_routes = Blueprint('health', __name__)


@health_routes.get('/health')
def health():
    with get_db_connection(current_app.config['DB_PATH']) as db:
        db.execute('SELECT 1').fetchone()
    return jsonify(status='ok', database='sqlite')
