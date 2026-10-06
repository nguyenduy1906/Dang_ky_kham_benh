"""Shared SQLite schema initialization and idempotent seed services."""
import re
import sqlite3
from backend.app.database.database import get_db_connection
from werkzeug.security import generate_password_hash

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS role (
    role_id INTEGER PRIMARY KEY,
    role_name text NOT NULL UNIQUE,
    description text,
    requires_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_approval IN (0,1)),
    CONSTRAINT role_name_allowed CHECK (role_name IN ('USER','DOCTOR','RECEPTIONIST','NURSE','ADMIN'))
) STRICT;

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES role(role_id),
    full_name text NOT NULL CHECK (trim(full_name) <> ''),
    phone text UNIQUE,
    email text UNIQUE,
    password_hash text,
    approval_status text NOT NULL DEFAULT 'PENDING'
        CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
    account_status text NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE','LOCKED')),
    email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    CONSTRAINT users_phone_nonempty CHECK (phone IS NULL OR trim(phone) <> ''),
    CONSTRAINT users_email_nonempty CHECK (email IS NULL OR trim(email) <> '')
) STRICT;

CREATE TABLE IF NOT EXISTS auth_token (
    token_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    token_type text NOT NULL CHECK (token_type IN ('RESET_PASSWORD','VERIFY_EMAIL','OTP')),
    token_hash text NOT NULL CHECK (trim(token_hash) <> ''),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    CONSTRAINT auth_token_expiry CHECK (expires_at > created_at),
    CONSTRAINT auth_token_used_time CHECK (used_at IS NULL OR used_at >= created_at)
) STRICT;

CREATE TABLE IF NOT EXISTS patient (
    patient_id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    full_name text NOT NULL CHECK (trim(full_name) <> ''),
    dob TEXT,
    gender text,
    id_card text,
    address text,
    phone text,
    health_insurance text,
    relationship text CHECK (relationship IN ('SELF','PARENT','CHILD','SPOUSE','OTHER')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS department (
    department_id INTEGER PRIMARY KEY,
    name text NOT NULL CHECK (trim(name) <> ''),
    description text,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS doctor_profile (
    doctor_profile_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(user_id),
    department_id INTEGER NOT NULL REFERENCES department(department_id),
    academic_degree text,
    specialization text,
    experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
    introduction text,
    consultation_fee INTEGER NOT NULL DEFAULT 0 CHECK (consultation_fee >= 0),
    avatar_url text,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS room (
    room_id INTEGER PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES department(department_id),
    room_name text NOT NULL CHECK (trim(room_name) <> ''),
    description text,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS work_schedule (
    schedule_id INTEGER PRIMARY KEY,
    doctor_profile_id INTEGER NOT NULL REFERENCES doctor_profile(doctor_profile_id),
    room_id INTEGER NOT NULL REFERENCES room(room_id),
    work_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    max_quota integer NOT NULL CHECK (max_quota > 0),
    booked_count integer NOT NULL DEFAULT 0,
    schedule_status text NOT NULL DEFAULT 'OPEN'
        CHECK (schedule_status IN ('OPEN','FULL','CLOSED','UNAVAILABLE')),
    unavailable_reason text,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    CONSTRAINT schedule_time_order CHECK (end_time > start_time),
    CONSTRAINT schedule_quota CHECK (booked_count BETWEEN 0 AND max_quota),
    CONSTRAINT schedule_doctor_start_unique UNIQUE (doctor_profile_id, work_date, start_time),
    CONSTRAINT schedule_room_start_unique UNIQUE (room_id, work_date, start_time)
) STRICT;

CREATE TABLE IF NOT EXISTS visit (
    visit_id INTEGER PRIMARY KEY,
    visit_type text NOT NULL CHECK (visit_type IN ('ONLINE','WALK_IN')),
    patient_id INTEGER NOT NULL REFERENCES patient(patient_id),
    doctor_profile_id INTEGER NOT NULL REFERENCES doctor_profile(doctor_profile_id),
    schedule_id INTEGER REFERENCES work_schedule(schedule_id),
    room_id INTEGER REFERENCES room(room_id),
    created_by_id INTEGER REFERENCES users(user_id),
    symptoms text,
    visit_status text NOT NULL DEFAULT 'CONFIRMED'
        CHECK (visit_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','EXPIRED')),
    queue_number integer CHECK (queue_number > 0),
    estimated_exam_at TEXT,
    qr_code text,
    hold_expires_at TEXT,
    checked_in_at TEXT,
    cancelled_by_id INTEGER REFERENCES users(user_id),
    cancel_reason text,
    cancelled_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    CONSTRAINT visit_schedule_queue_unique UNIQUE (schedule_id, queue_number),
    CONSTRAINT visit_online_schedule CHECK (visit_type <> 'ONLINE' OR schedule_id IS NOT NULL),
    CONSTRAINT visit_hold_online_only CHECK (hold_expires_at IS NULL OR visit_type = 'ONLINE'),
    CONSTRAINT visit_holding_expiry CHECK (
        visit_status <> 'HOLDING' OR (visit_type = 'ONLINE' AND hold_expires_at IS NOT NULL)
    )
) STRICT;

CREATE TABLE IF NOT EXISTS visit_status_log (
    log_id INTEGER PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visit(visit_id),
    old_status text CHECK (old_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','EXPIRED')),
    new_status text NOT NULL CHECK (new_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','EXPIRED')),
    changed_by_id INTEGER NOT NULL REFERENCES users(user_id),
    note text,
    changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS visit_transfer_log (
    log_id INTEGER PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visit(visit_id),
    old_doctor_id INTEGER NOT NULL REFERENCES doctor_profile(doctor_profile_id),
    new_doctor_id INTEGER NOT NULL REFERENCES doctor_profile(doctor_profile_id),
    transferred_by_id INTEGER NOT NULL REFERENCES users(user_id),
    reason text,
    transferred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    CONSTRAINT transfer_different_doctor CHECK (old_doctor_id <> new_doctor_id)
) STRICT;

CREATE TABLE IF NOT EXISTS payment (
    payment_id INTEGER PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visit(visit_id),
    payment_type text NOT NULL CHECK (payment_type IN ('DEPOSIT','EXAM_FEE','REFUND')),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    payment_method text NOT NULL CHECK (payment_method IN ('CASH','BANK','EWALLET','CARD')),
    transaction_status text NOT NULL DEFAULT 'PENDING'
        CHECK (transaction_status IN ('PENDING','SUCCESS','FAILED','REFUNDED')),
    transaction_code text UNIQUE,
    paid_at TEXT,
    refunded_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS medical_record (
    record_id INTEGER PRIMARY KEY,
    visit_id INTEGER NOT NULL UNIQUE REFERENCES visit(visit_id),
    diagnosis text,
    treatment text,
    doctor_notes text,
    examined_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS prescription_item (
    item_id INTEGER PRIMARY KEY,
    record_id INTEGER NOT NULL REFERENCES medical_record(record_id),
    medication_name text NOT NULL CHECK (trim(medication_name) <> ''),
    dosage text,
    quantity integer NOT NULL CHECK (quantity > 0),
    instructions text
) STRICT;

CREATE TABLE IF NOT EXISTS review (
    review_id INTEGER PRIMARY KEY,
    record_id INTEGER NOT NULL UNIQUE REFERENCES medical_record(record_id),
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS notification (
    notification_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    notification_type text NOT NULL CHECK (trim(notification_type) <> ''),
    title text NOT NULL CHECK (trim(title) <> ''),
    content text NOT NULL,
    reference_type text,
    reference_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    CONSTRAINT notification_reference_pair CHECK (
        (reference_type IS NULL AND reference_id IS NULL) OR
        (reference_type IS NOT NULL AND trim(reference_type) <> '' AND reference_id IS NOT NULL)
    )
) STRICT;

CREATE TABLE IF NOT EXISTS article (
    article_id INTEGER PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users(user_id),
    title text NOT NULL CHECK (trim(title) <> ''),
    slug text NOT NULL UNIQUE CHECK (trim(slug) <> ''),
    category text,
    thumbnail_url text,
    content text NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS system_configuration (
    config_key text NOT NULL PRIMARY KEY CHECK (trim(config_key) <> ''),
    config_value text NOT NULL,
    description text,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
) STRICT;

-- Index cho FK va cac truy van theo lich, benh nhan, lich su, thong bao.
-- UNIQUE/PRIMARY KEY da tu tao index, khong tao lai index trung lap.
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_auth_token_lookup ON auth_token(token_hash, token_type);
CREATE INDEX IF NOT EXISTS idx_auth_token_user ON auth_token(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_token_expiry ON auth_token(expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_user ON patient(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_department ON doctor_profile(department_id);
CREATE INDEX IF NOT EXISTS idx_room_department ON room(department_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date_status ON work_schedule(work_date, schedule_status);
CREATE INDEX IF NOT EXISTS idx_visit_patient_created ON visit(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visit_doctor ON visit(doctor_profile_id);
CREATE INDEX IF NOT EXISTS idx_visit_room ON visit(room_id);
CREATE INDEX IF NOT EXISTS idx_visit_creator ON visit(created_by_id);
CREATE INDEX IF NOT EXISTS idx_visit_canceller ON visit(cancelled_by_id);
CREATE INDEX IF NOT EXISTS idx_visit_expiring ON visit(hold_expires_at) WHERE visit_status = 'HOLDING';
CREATE INDEX IF NOT EXISTS idx_visit_status_history ON visit_status_log(visit_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_visit_status_actor ON visit_status_log(changed_by_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history ON visit_transfer_log(visit_id, transferred_at);
CREATE INDEX IF NOT EXISTS idx_transfer_old_doctor ON visit_transfer_log(old_doctor_id);
CREATE INDEX IF NOT EXISTS idx_transfer_new_doctor ON visit_transfer_log(new_doctor_id);
CREATE INDEX IF NOT EXISTS idx_transfer_actor ON visit_transfer_log(transferred_by_id);
CREATE INDEX IF NOT EXISTS idx_payment_visit ON payment(visit_id);
CREATE INDEX IF NOT EXISTS idx_prescription_record ON prescription_item(record_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_created ON notification(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_author ON article(author_id);


CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE OF role_id, full_name, phone, email, password_hash, approval_status, account_status, email_verified, deleted_at, created_at ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_patient_updated_at
AFTER UPDATE OF user_id, full_name, dob, gender, id_card, address, phone, health_insurance, relationship, created_at ON patient
FOR EACH ROW
BEGIN
    UPDATE patient SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE patient_id = NEW.patient_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_department_updated_at
AFTER UPDATE OF name, description, is_active, created_at ON department
FOR EACH ROW
BEGIN
    UPDATE department SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE department_id = NEW.department_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_doctor_profile_updated_at
AFTER UPDATE OF user_id, department_id, academic_degree, specialization, experience_years, introduction, consultation_fee, avatar_url, is_active, created_at ON doctor_profile
FOR EACH ROW
BEGIN
    UPDATE doctor_profile SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE doctor_profile_id = NEW.doctor_profile_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_room_updated_at
AFTER UPDATE OF department_id, room_name, description, is_active, created_at ON room
FOR EACH ROW
BEGIN
    UPDATE room SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE room_id = NEW.room_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_work_schedule_updated_at
AFTER UPDATE OF doctor_profile_id, room_id, work_date, start_time, end_time, max_quota, booked_count, schedule_status, unavailable_reason, created_at ON work_schedule
FOR EACH ROW
BEGIN
    UPDATE work_schedule SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE schedule_id = NEW.schedule_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_visit_updated_at
AFTER UPDATE OF visit_type, patient_id, doctor_profile_id, schedule_id, room_id, created_by_id, symptoms, visit_status, queue_number, estimated_exam_at, qr_code, hold_expires_at, checked_in_at, cancelled_by_id, cancel_reason, cancelled_at, created_at ON visit
FOR EACH ROW
BEGIN
    UPDATE visit SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE visit_id = NEW.visit_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_updated_at
AFTER UPDATE OF visit_id, payment_type, amount, payment_method, transaction_status, transaction_code, paid_at, refunded_at, created_at ON payment
FOR EACH ROW
BEGIN
    UPDATE payment SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE payment_id = NEW.payment_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_medical_record_updated_at
AFTER UPDATE OF visit_id, diagnosis, treatment, doctor_notes, examined_at, created_at ON medical_record
FOR EACH ROW
BEGIN
    UPDATE medical_record SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE record_id = NEW.record_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_review_updated_at
AFTER UPDATE OF record_id, rating, comment, created_at ON review
FOR EACH ROW
BEGIN
    UPDATE review SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE review_id = NEW.review_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_article_updated_at
AFTER UPDATE OF author_id, title, slug, category, thumbnail_url, content, is_active, published_at, created_at ON article
FOR EACH ROW
BEGIN
    UPDATE article SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE article_id = NEW.article_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_system_configuration_updated_at
AFTER UPDATE OF config_value, description ON system_configuration
FOR EACH ROW
BEGIN
    UPDATE system_configuration SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE config_key = NEW.config_key;
END;
"""

def statements(script):
    buffer = ''
    for line in script.splitlines(keepends=True):
        buffer += line
        if sqlite3.complete_statement(buffer):
            yield buffer.strip()
            buffer = ''
    if buffer.strip():
        raise ValueError('Incomplete SQL statement in database setup')


def _normalized(sql):
    return re.sub(r"\s+", " ", sql.replace("IF NOT EXISTS ", "")).strip().rstrip(";")


def _check_existing_schema(db):
    # Validate old or partially initialized objects before adopting them.
    expected = sqlite3.connect(":memory:")
    try:
        for statement in statements(SCHEMA_SQL):
            expected.execute(statement)
        for kind, name, sql in expected.execute(
            "SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL"
        ):
            existing = db.execute(
                "SELECT sql FROM sqlite_master WHERE type=? AND name=?", (kind,name)
            ).fetchone()
            if existing is not None and _normalized(existing[0]) != _normalized(sql):
                raise RuntimeError(f"Existing {kind} {name} differs from the expected schema; update its structure explicitly")
    finally:
        expected.close()


def init_database(path=None):
    if sqlite3.sqlite_version_info < (3,37,0):
        raise RuntimeError("SQLite 3.37+ required")
    with get_db_connection(path, create=True) as db:
        db.execute("BEGIN IMMEDIATE")
        _check_existing_schema(db)
        for statement in statements(SCHEMA_SQL):
            db.execute(statement)
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise RuntimeError("Database contains invalid foreign keys")


ROLES = (
    ('USER', 'Người dùng đặt lịch và quản lý hồ sơ bệnh nhân', 0),
    ('DOCTOR', 'Bác sĩ', 1), ('RECEPTIONIST', 'Lễ tân', 1),
    ('NURSE', 'Điều dưỡng', 1), ('ADMIN', 'Quản trị viên', 1),
)


def seed_database(path=None, *, demo=False, admin_email=None, admin_password=None, admin_name=None):
    if admin_email is not None:
        admin_email = admin_email.strip().lower()
        if '@' not in admin_email or not admin_name or not admin_name.strip():
            raise ValueError('Admin email and full name are required')
        if not admin_password or len(admin_password) < 12:
            raise ValueError('Use an admin password of at least 12 characters')
    with get_db_connection(path) as db:
        db.execute('BEGIN IMMEDIATE')
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='role'").fetchone():
            raise RuntimeError('Run init_db.py before seed_db.py')
        for row in ROLES:
            db.execute('''INSERT INTO role(role_name,description,requires_approval)
                          VALUES (?,?,?) ON CONFLICT(role_name) DO NOTHING''', row)
        # No business configuration defaults invented beyond those specified in ERD.
        if admin_email:
            existing = db.execute('SELECT user_id FROM users WHERE lower(email)=?', (admin_email,)).fetchone()
            if not existing:
                role = db.execute('SELECT role_id FROM role WHERE role_name=?', ('ADMIN',)).fetchone()
                db.execute('''INSERT INTO users(role_id,full_name,email,password_hash,approval_status)
                              VALUES (?,?,?,?,?)''',
                           (role['role_id'],admin_name.strip(),admin_email,
                            generate_password_hash(admin_password),'APPROVED'))
        if demo:
            # A demo news article exercises two linked tables without fake patient records.
            email = 'demo.author@example.test'
            author = db.execute('SELECT user_id FROM users WHERE email=?', (email,)).fetchone()
            if author is None:
                role = db.execute('SELECT role_id FROM role WHERE role_name=?', ('USER',)).fetchone()
                author_id = db.execute('''INSERT INTO users(role_id,full_name,email,account_status,approval_status)
                    VALUES (?,?,?,?,?)''', (role['role_id'],'Tác giả DEMO',email,'LOCKED','APPROVED')).lastrowid
            else:
                author_id = author['user_id']
            db.execute('''INSERT INTO article(author_id,title,slug,category,content,is_active)
                          VALUES (?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING''',
                       (author_id,'Bài viết DEMO','demo-huong-dan-dat-lich','DEMO',
                        'Dữ liệu minh họa cho dự án đặt lịch khám bệnh.',0))
