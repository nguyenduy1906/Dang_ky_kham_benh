import os
import unittest
from datetime import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from backend.tests import test_postgres
from backend.app.core.security import create_access_token
from backend.app.db.database import get_db_connection
from backend.app.main import create_app
from backend.app.models import auth_model
from backend.app.services import schedule_service as nurse_assignment_service


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Set RUN_POSTGRES_TESTS=1 with PostgreSQL available')
class NurseAssignmentTests(unittest.TestCase):
    drop_schema = test_postgres.PostgresTests.drop_schema

    def setUp(self):
        test_postgres.PostgresTests.setUp(self)
        sample = (Path(__file__).resolve().parents[2] / 'database/sample_data.sql').read_text(encoding='utf-8')
        with get_db_connection() as db:
            db.execute(sample.replace('BEGIN;', '', 1).replace('COMMIT;', '', 1))
            # These permission/workflow fixtures intentionally exercise the original ten visits.
            # Rolling presentation scenarios are covered separately by test_business_codes.
            db.execute('DELETE FROM review WHERE record_id IN (SELECT record_id FROM medical_record WHERE encounter_id>10)')
            db.execute('DELETE FROM prescription_item WHERE record_id IN (SELECT record_id FROM medical_record WHERE encounter_id>10)')
            db.execute('DELETE FROM medical_record WHERE encounter_id>10')
            db.execute('DELETE FROM payment WHERE encounter_id>10')
            db.execute('DELETE FROM encounter_status_log WHERE encounter_id>10')
            db.execute('DELETE FROM encounter_transfer_log WHERE encounter_id>10')
            db.execute('DELETE FROM encounter WHERE encounter_id>10')
            db.execute('UPDATE work_schedule SET booked_count=0 WHERE schedule_id>10')
            db.execute('DELETE FROM nurse_assignment')
            self.actors = {}
            for role in ('ADMIN', 'NURSE', 'USER'):
                row = db.execute('SELECT user_id FROM users u JOIN role r ON r.role_id=u.role_id '
                                 'WHERE r.role_name=%s ORDER BY user_id LIMIT 1', (role,)).fetchone()
                self.actors[role] = auth_model.get_user_by_id(db, row['user_id'])
            self.schedule_id = db.execute('SELECT schedule_id FROM work_schedule ORDER BY schedule_id LIMIT 1').fetchone()['schedule_id']
        self.secret = patch.dict(os.environ, {'SECRET_KEY': 'nurse-assignment-test-only'})
        self.secret.start()
        self.addCleanup(self.secret.stop)
        self.client = create_app().test_client()

    def headers(self, role):
        return {'Authorization': 'Bearer ' + create_access_token(self.actors[role])}

    def payload(self):
        return {'nurse_id': self.actors['NURSE']['user_id'], 'schedule_id': self.schedule_id,
                'note': 'Hỗ trợ trong ca'}

    def test_assignment_lifecycle_and_permissions(self):
        path = '/admin/nurse-assignments'
        self.assertEqual(self.client.get(path).status_code, 401)
        for role in ('USER', 'NURSE'):
            self.assertEqual(self.client.post(path, json=self.payload(), headers=self.headers(role)).status_code, 403)
        admin = self.headers('ADMIN')
        for data in ({}, {**self.payload(), 'nurse_id': True}, {**self.payload(), 'assigned_by_id': 1}):
            self.assertEqual(self.client.post(path, json=data, headers=admin).status_code, 400)
        self.assertEqual(self.client.post(path, json={**self.payload(), 'nurse_id': self.actors['USER']['user_id']}, headers=admin).status_code, 400)
        self.assertEqual(self.client.post(path, json={**self.payload(), 'schedule_id': 999999}, headers=admin).status_code, 404)
        response = self.client.post(path, json=self.payload(), headers=admin)
        self.assertEqual(response.status_code, 201, response.json)
        assignment = response.json['assignment']
        self.assertEqual(assignment['assigned_by_id'], self.actors['ADMIN']['user_id'])
        self.assertEqual(self.client.post(path, json=self.payload(), headers=admin).status_code, 409)
        own = self.client.get('/nurse/assignments?nurse_id=999999', headers=self.headers('NURSE'))
        self.assertEqual(own.json['total'], 1)
        self.assertEqual(own.json['items'][0]['nurse_id'], self.actors['NURSE']['user_id'])
        self.assertEqual(self.client.get('/nurse/assignments', headers=admin).status_code, 403)
        revoke = f"{path}/{assignment['assignment_id']}/revoke"
        self.assertEqual(self.client.post(revoke, headers=self.headers('NURSE')).status_code, 403)
        revoked = self.client.post(revoke, headers=admin)
        self.assertEqual(revoked.status_code, 200)
        self.assertIsNotNone(revoked.json['assignment']['revoked_at'])
        self.assertEqual(revoked.json['assignment']['revoked_by_id'], self.actors['ADMIN']['user_id'])
        self.assertEqual(self.client.post(revoke, headers=admin).status_code, 409)
        self.assertEqual(self.client.post(path + '/999999/revoke', headers=admin).status_code, 404)
        self.assertEqual(self.client.get('/nurse/assignments', headers=self.headers('NURSE')).json['total'], 0)
        self.assertEqual(self.client.get(path + '?include_revoked=true', headers=admin).json['total'], 1)
        self.assertEqual(self.client.post(path, json=self.payload(), headers=admin).status_code, 201)
        self.assertEqual(self.client.get(path + '?include_revoked=true&page_size=1', headers=admin).json['total'], 2)
        # Tài khoản NURSE khác không thấy phân công của người trước.
        with get_db_connection() as db:
            other = db.execute('INSERT INTO users (role_id, full_name, password_hash, approval_status, account_status) '
                               "SELECT role_id, 'Other nurse', password_hash, approval_status, account_status "
                               'FROM users WHERE user_id=%s RETURNING user_id',
                               (self.actors['NURSE']['user_id'],)).fetchone()
            other_user = auth_model.get_user_by_id(db, other['user_id'])
        headers = {'Authorization': 'Bearer ' + create_access_token(other_user)}
        self.assertEqual(self.client.get('/nurse/assignments', headers=headers).json['total'], 0)
        # Swagger xuất được cả bốn API.
        spec = self.client.get('/apispec_1.json')
        self.assertEqual(spec.status_code, 200)
        self.assertIn('/nurse/assignments', spec.json['paths'])
        self.assertIn('post', spec.json['paths'][path])

    def test_concurrent_assignment_and_inactive_nurse(self):
        def create():
            try:
                nurse_assignment_service.create_assignment(self.actors['ADMIN'], self.payload())
                return 201
            except Exception as error:
                return getattr(error, 'status_code', 500)
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: create(), range(2)))
        self.assertEqual(sorted(results), [201, 409])
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) AS n FROM nurse_assignment').fetchone()['n'], 1)
            db.execute("UPDATE users SET account_status='LOCKED' WHERE user_id=%s",
                       (self.actors['NURSE']['user_id'],))
        response = self.client.post('/admin/nurse-assignments', json=self.payload(), headers=self.headers('ADMIN'))
        self.assertEqual(response.status_code, 400)

    def test_different_schedules_overlap_and_adjacent_boundary(self):
        with get_db_connection() as db:
            first = db.execute('SELECT * FROM work_schedule WHERE schedule_id=%s', (self.schedule_id,)).fetchone()
            ids = []
            for start, end in [('09:00','12:00'), ('11:30','13:00')]:
                ids.append(db.execute('''INSERT INTO work_schedule(doctor_profile_id,room_id,work_date,start_time,end_time,max_quota,slot_minutes)
                    VALUES (2,2,%s,%s,%s,7,30) RETURNING schedule_id''', (first['work_date'], start, end)).fetchone()['schedule_id'])
        nurse_assignment_service.create_assignment(self.actors['ADMIN'], self.payload())
        with self.assertRaises(Exception) as blocked:
            nurse_assignment_service.create_assignment(self.actors['ADMIN'], {**self.payload(), 'schedule_id': ids[0]})
        self.assertEqual(blocked.exception.code, 'NURSE_SCHEDULE_OVERLAP')
        nurse_assignment_service.create_assignment(self.actors['ADMIN'], {**self.payload(), 'schedule_id': ids[1]})

    def test_concurrent_different_overlapping_schedules(self):
        with get_db_connection() as db:
            row = db.execute('SELECT * FROM work_schedule WHERE schedule_id=%s', (self.schedule_id,)).fetchone()
            other = db.execute('''INSERT INTO work_schedule(doctor_profile_id,room_id,work_date,start_time,end_time,max_quota,slot_minutes)
                VALUES(2,2,%s,'08:00','11:30',7,30) RETURNING schedule_id''', (row['work_date'],)).fetchone()['schedule_id']
        def assign(schedule_id):
            try:
                nurse_assignment_service.create_assignment(self.actors['ADMIN'], {**self.payload(), 'schedule_id': schedule_id})
                return 201
            except Exception as error:
                return getattr(error, 'status_code', 500)
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(assign, [self.schedule_id, other])), [201,409])

    def test_editing_schedule_cannot_overlap_assigned_nurse(self):
        with get_db_connection() as db:
            ids = [db.execute('''INSERT INTO work_schedule(doctor_profile_id,room_id,work_date,start_time,end_time,max_quota,slot_minutes)
                VALUES(%s,%s,'2030-01-07',%s,%s,7,30) RETURNING schedule_id''', args).fetchone()['schedule_id']
                for args in [(1,1,'08:00','11:30'),(2,2,'13:30','17:00')]]
        for sid in ids:
            nurse_assignment_service.create_assignment(self.actors['ADMIN'], {**self.payload(), 'schedule_id': sid})
        with self.assertRaises(Exception) as blocked:
            nurse_assignment_service.update_schedule(ids[1], {'start_time': time(9), 'end_time': time(12)})
        self.assertEqual(blocked.exception.code, 'NURSE_SCHEDULE_OVERLAP')

    def test_nurse_weekend_calendar_uses_actual_assignment(self):
        with get_db_connection() as db:
            sid = db.execute('''INSERT INTO work_schedule(doctor_profile_id,room_id,work_date,start_time,end_time,max_quota,slot_minutes)
                VALUES(2,2,'2030-01-12','08:00','11:30',7,30) RETURNING schedule_id''').fetchone()['schedule_id']
        nurse_assignment_service.create_assignment(self.actors['ADMIN'], {**self.payload(), 'schedule_id': sid})
        result = self.client.get('/staff/work-schedules?from_date=2030-01-12&to_date=2030-01-13', headers=self.headers('NURSE'))
        self.assertEqual(result.status_code, 200)
        self.assertEqual([s['period'] for s in result.json['items'][0]['shifts']], ['MORNING'])
        self.assertEqual(result.json['items'][1]['shifts'], [])
