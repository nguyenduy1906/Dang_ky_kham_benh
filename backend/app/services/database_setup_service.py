from backend.app.repositories import database_setup_repository as queries
"""PostgreSQL schema initialization and idempotent seed services."""
import secrets
from werkzeug.security import generate_password_hash
from backend.app.config.database import get_db_connection


def init_database():
    with get_db_connection() as db:
        queries.lock_initialization(db)
        queries.run_schema(db)


ROLES = (
    ('USER', 'Người dùng đặt lịch và quản lý hồ sơ bệnh nhân', 0),
    ('DOCTOR', 'Bác sĩ', 1), ('RECEPTIONIST', 'Lễ tân', 1),
    ('NURSE', 'Điều dưỡng', 1), ('ADMIN', 'Quản trị viên', 1),
)


def seed_database(*, demo=False, admin_email=None, admin_password=None, admin_name=None):
    if admin_email is not None:
        admin_email = admin_email.strip().lower()
        if '@' not in admin_email or not admin_name or not admin_name.strip():
            raise ValueError('Admin email and full name are required')
        if not admin_password or len(admin_password) < 12:
            raise ValueError('Use an admin password of at least 12 characters')
    with get_db_connection() as db:
        queries.lock_seed(db)
        initialized = queries.find_role_table(db).fetchone()['table_name']
        if not initialized:
            raise RuntimeError('Run init_db.py before seed_db.py')
        for row in ROLES:
            queries.insert_role(db, row)
        # No business configuration defaults invented beyond those specified in ERD.
        if admin_email:
            existing = queries.find_admin(db, (admin_email,)).fetchone()
            if not existing:
                role = queries.get_admin_role(db, ('ADMIN',)).fetchone()
                queries.insert_admin(db, (role['role_id'], admin_name.strip(), admin_email, generate_password_hash(admin_password), 'APPROVED'))
        if demo:
            # A demo news article exercises two linked tables without fake patient records.
            email = 'demo.author@example.test'
            author = queries.find_demo_author(db, (email,)).fetchone()
            if author is None:
                role = queries.get_demo_role(db, ('USER',)).fetchone()
                cursor = queries.insert_demo_author(db, (role['role_id'], 'Tác giả DEMO', email, generate_password_hash(secrets.token_urlsafe(48)), 'LOCKED', 'APPROVED'))
                author_id = cursor.fetchone()['user_id']
            else:
                author_id = author['user_id']
            queries.insert_demo_article(db, (author_id, 'Bài viết DEMO', 'demo-huong-dan-dat-lich', 'DEMO', 'Dữ liệu minh họa cho dự án đặt lịch khám bệnh.', 0))
