from flask import Blueprint, jsonify
from backend.app.db.database import get_db_connection

health_routes = Blueprint('health', __name__)


@health_routes.get('/health')
def health():
    with get_db_connection() as db:
        db.execute('SELECT 1').fetchone()
    return jsonify(status='ok', database='postgresql')
