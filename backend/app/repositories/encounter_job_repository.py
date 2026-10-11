"""SQL queries using the connection supplied by the service."""


def lock_system_worker(db):
    return db.execute('SELECT pg_advisory_xact_lock(78124002)')


def get_system_worker(db, SYSTEM_WORKER_EMAIL):
    return db.execute('SELECT u.*,r.role_name FROM users u JOIN role r ON r.role_id=u.role_id WHERE email=%s', (SYSTEM_WORKER_EMAIL,)).fetchone()


def create_system_worker(db, email, password_hash):
    return db.execute("INSERT INTO users (role_id,full_name,email,password_hash,account_status,approval_status) SELECT role_id,'SYSTEM: encounter expiry worker',%s,%s,'LOCKED','APPROVED' FROM role WHERE role_name='ADMIN' RETURNING user_id", (email, password_hash)).fetchone()


def lock_expired_schedules(db, current_time):
    return db.execute("SELECT s.* FROM work_schedule s WHERE EXISTS (SELECT 1 FROM encounter e WHERE e.schedule_id=s.schedule_id AND e.encounter_status='HOLDING' AND e.hold_expires_at<=%s) ORDER BY s.schedule_id LIMIT 100 FOR UPDATE OF s SKIP LOCKED", (current_time,)).fetchall()


def lock_expired_holds(db, current_time, schedule):
    return db.execute("SELECT * FROM encounter WHERE schedule_id=%s AND encounter_status='HOLDING' AND hold_expires_at<=%s ORDER BY encounter_id FOR UPDATE", (schedule['schedule_id'], current_time)).fetchall()
