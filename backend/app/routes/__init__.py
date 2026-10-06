from flask import Blueprint, jsonify
from backend.app.db.database import get_db_connection

health_routes = Blueprint('health', __name__)


@health_routes.get('/health')
def health():
    """Kiểm tra backend và kết nối PostgreSQL.
    ---
    tags:
      - Hệ thống
    responses:
      200:
        description: Backend kết nối PostgreSQL thành công.
        schema:
          type: object
          required: [status, database]
          properties:
            status:
              type: string
              example: ok
            database:
              type: string
              example: postgresql
      500:
        description: Lỗi xử lý hoặc kết nối database.
    """
    with get_db_connection() as db:
        db.execute('SELECT 1').fetchone()
    return jsonify(status='ok', database='postgresql')
