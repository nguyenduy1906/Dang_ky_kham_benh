"""PostgreSQL schema initialization and idempotent seed services."""
import secrets
from werkzeug.security import generate_password_hash
from backend.app.core.config import DATABASE_DIR
from backend.app.schemas import auth_schema
from backend.app.db.database import get_db_connection


def init_database():
    with get_db_connection() as db:
        db.execute('SELECT pg_advisory_xact_lock(78124001)')
        db.execute((DATABASE_DIR / 'init_db.sql').read_text(encoding='utf-8'))


ROLES = (
    ('USER', 'Người dùng đặt lịch và quản lý hồ sơ bệnh nhân', 0),
    ('DOCTOR', 'Bác sĩ', 1), ('RECEPTIONIST', 'Lễ tân', 1),
    ('NURSE', 'Điều dưỡng', 1), ('ADMIN', 'Quản trị viên', 1),
)


def seed_database(*, demo=False, admin_email=None, admin_password=None, admin_name=None):
    if admin_email is not None:
        admin_email = auth_schema.normalize_email(auth_schema.text_field(
            {'email': admin_email}, 'email', required=True, max_len=254))
        admin_name = auth_schema.text_field({'full_name': admin_name}, 'full_name', required=True, max_len=150)
        admin_password = auth_schema.check_password(admin_password)
        if len(admin_password) < 12:
            raise ValueError('Use an admin password of at least 12 characters')
    with get_db_connection() as db:
        db.execute('SELECT pg_advisory_xact_lock(78124001)')
        initialized = db.execute("SELECT to_regclass('role') AS table_name").fetchone()['table_name']
        if not initialized:
            raise RuntimeError('Run init_db.py before seed_db.py')
        for row in ROLES:
            db.execute('''INSERT INTO role(role_name,description,requires_approval)
                          VALUES (%s,%s,%s) ON CONFLICT(role_name) DO NOTHING''', row)
        # No business configuration defaults invented beyond those specified in ERD.
        if admin_email:
            existing = db.execute('SELECT user_id FROM users WHERE lower(email)=%s', (admin_email,)).fetchone()
            if not existing:
                role = db.execute('SELECT role_id FROM role WHERE role_name=%s', ('ADMIN',)).fetchone()
                db.execute('''INSERT INTO users(role_id,full_name,email,password_hash,approval_status)
                              VALUES (%s,%s,%s,%s,%s)''',
                           (role['role_id'],admin_name.strip(),admin_email,
                            generate_password_hash(admin_password),'APPROVED'))
        if demo:
            # A demo news article exercises two linked tables without fake patient records.
            email = 'demo.author@example.test'
            author = db.execute('SELECT user_id FROM users WHERE email=%s', (email,)).fetchone()
            if author is None:
                role = db.execute('SELECT role_id FROM role WHERE role_name=%s', ('USER',)).fetchone()
                cursor = db.execute('''INSERT INTO users(role_id,full_name,email,password_hash,account_status,approval_status)
                    VALUES (%s,%s,%s,%s,%s,%s) RETURNING user_id''',
                    (role['role_id'],'Tác giả DEMO',email,
                     generate_password_hash(secrets.token_urlsafe(48)),'LOCKED','APPROVED'))
                author_id = cursor.fetchone()['user_id']
            else:
                author_id = author['user_id']
            db.execute('''INSERT INTO article(author_id,title,slug,category,content,is_active)
                          VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(slug) DO NOTHING''',
                       (author_id,'Bài viết DEMO','demo-huong-dan-dat-lich','DEMO',
                        'Dữ liệu minh họa cho dự án đặt lịch khám bệnh.',0))
