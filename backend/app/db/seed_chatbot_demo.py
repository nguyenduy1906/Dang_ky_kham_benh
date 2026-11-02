"""Add opt-in chatbot directory demo records without resetting existing data.

Preview: python -m backend.app.db.seed_chatbot_demo
Apply:   python -m backend.app.db.seed_chatbot_demo --apply
No patients, encounters, payments, schedules or existing passwords are modified.
"""
import argparse
import json
import secrets

from werkzeug.security import generate_password_hash
from backend.app.db.database import get_db_connection


DIRECTORY = (
    ('tieu-hoa', 'Tiêu hóa', 'Khám các vấn đề tiêu hóa; dữ liệu minh họa đồ án.', 300000),
    ('ho-hap', 'Hô hấp', 'Khám các vấn đề hô hấp; dữ liệu minh họa đồ án.', 300000),
    ('than-tiet-nieu', 'Thận - Tiết niệu', 'Khám các vấn đề thận và đường tiết niệu; dữ liệu minh họa đồ án.', 320000),
    ('noi-tiet', 'Nội tiết', 'Khám theo dõi các vấn đề nội tiết theo chỉ định; dữ liệu minh họa đồ án.', 320000),
    ('dinh-duong', 'Dinh dưỡng', 'Tư vấn dinh dưỡng theo đánh giá cá nhân; dữ liệu minh họa đồ án.', 250000),
)


def seed(apply=False):
    report = {'apply': apply, 'departments_added': 0, 'doctors_added': 0, 'items': []}
    with get_db_connection() as db:
        # Serialize this additive seeder so two launches cannot create duplicates.
        if apply:
            db.execute("SELECT pg_advisory_xact_lock(hashtext('chatbot-directory-demo-v1'))")
        role = db.execute("SELECT role_id FROM role WHERE role_name='DOCTOR'").fetchone()
        if not role:
            raise RuntimeError('Missing DOCTOR role; initialize the project first.')
        for slug, name, description, price in DIRECTORY:
            departments = db.execute('SELECT department_id,is_active FROM department WHERE lower(trim(name))=lower(%s)', (name,)).fetchall()
            if len(departments) > 1:
                raise RuntimeError('Duplicate specialty names; resolve them before seeding.')
            department = departments[0] if departments else None
            if department and not department['is_active']:
                report['items'].append({'department': name, 'status': 'inactive, skipped'})
                continue
            if not department:
                report['departments_added'] += 1
                if apply:
                    department = db.execute('INSERT INTO department(name,description,content_is_demo) VALUES (%s,%s,1) RETURNING department_id,is_active', (name, description)).fetchone()
            for index in (1, 2):
                email = f'chatbot-demo-{slug}-{index}@example.invalid'
                user = db.execute('SELECT user_id,role_id,deleted_at,account_status FROM users WHERE email=%s', (email,)).fetchone()
                if user and (user['role_id'] != role['role_id'] or user['deleted_at'] or user['account_status'] != 'ACTIVE'):
                    raise RuntimeError('A demo email belongs to an incompatible account; no existing account was changed.')
                profile = db.execute('SELECT doctor_profile_id,department_id FROM doctor_profile WHERE user_id=%s', (user['user_id'],)).fetchone() if user else None
                if profile:
                    if department and profile['department_id'] != department['department_id']:
                        raise RuntimeError('An existing demo doctor belongs to another specialty; no transfer was performed.')
                    continue
                report['doctors_added'] += 1
                if not apply:
                    continue
                if not user:
                    # Random password, intentionally not printed or shared. These
                    # accounts exist to display demo profiles, not to grant logins.
                    user = db.execute("INSERT INTO users(role_id,full_name,email,password_hash,approval_status) VALUES (%s,%s,%s,%s,'APPROVED') RETURNING user_id",
                                      (role['role_id'], f'Bác sĩ {name} {index:02d} (Demo)', email,
                                       generate_password_hash(secrets.token_urlsafe(48)))).fetchone()
                db.execute('INSERT INTO doctor_profile(user_id,department_id,specialization,introduction,consultation_fee) VALUES (%s,%s,%s,%s,%s)',
                           (user['user_id'], department['department_id'], name,
                            'Hồ sơ hư cấu để minh họa chatbot và danh mục đồ án, không đại diện bác sĩ thật. Phí khám là dữ liệu mẫu; chưa có lịch khám được tạo bởi công cụ này.', price))
            report['items'].append({'department': name, 'status': 'checked'})
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Commit additive demo records')
    args = parser.parse_args()
    print(json.dumps(seed(args.apply), ensure_ascii=True))
