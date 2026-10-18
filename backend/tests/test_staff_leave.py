"""Real PostgreSQL tests in disposable schemas; no project data is modified."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta, date
from pathlib import Path
from unittest.mock import patch

from backend.tests import test_postgres
from backend.app.core.security import create_access_token
from backend.app.core.errors import AppError
from backend.app.db.database import get_db_connection
from backend.app.models import auth_model
from backend.app.main import create_app
from backend.app.services import staff_leave_service as service, schedule_service
from backend.app.schemas import staff_leave_schema as schema
from backend.app.utils.date import today_vn


class LeaveValidationTests(unittest.TestCase):
    def test_invalid_input_and_weekends(self):
        with patch.object(schema, 'today_vn', return_value=date(2030, 1, 1)):
            valid = {'from_date': '2030-01-07', 'reason': 'Việc gia đình'}
            self.assertEqual(schema.validate_create(valid)['period'], 'FULL_DAY')
            for data in (None, {}, {**valid, 'from_date': 'invalid'}, {**valid, 'period': 'OTHER'},
                         {**valid, 'user_id': 3}, {**valid, 'status': 'APPROVED'},
                         {**valid, 'reason': ' '}, {**valid, 'to_date': '2029-12-31'},
                         {**valid, 'to_date': '2030-03-01'}, {**valid, 'from_date': '2030-01-05'}):
                with self.subTest(data=data), self.assertRaises(AppError):
                    schema.validate_create(data)
            for data in ({'decision': 'APPROVED'}, {'decision': 'OTHER', 'note': 'x'},
                         {'decision': 'APPROVED', 'note': 'x', 'reviewed_by_id': 1}):
                with self.assertRaises(AppError):
                    schema.validate_review(data)


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Requires disposable PostgreSQL')
class StaffLeaveTests(unittest.TestCase):
    drop_schema = test_postgres.PostgresTests.drop_schema

    def setUp(self):
        test_postgres.PostgresTests.setUp(self)
        sample = (Path(__file__).resolve().parents[2] / 'database/sample_data.sql').read_text(encoding='utf-8')
        with get_db_connection() as db:
            db.execute(sample.replace('BEGIN;', '', 1).replace('COMMIT;', '', 1))
            self.assertEqual(db.execute('SELECT COUNT(*) n FROM staff_leave_request').fetchone()['n'], 5)
            db.execute("DELETE FROM notification WHERE reference_type='STAFF_LEAVE_REQUEST'")
            db.execute('DELETE FROM staff_leave_request')
            self.actors = {}
            for role in ('ADMIN', 'NURSE', 'DOCTOR', 'RECEPTIONIST', 'USER'):
                uid = db.execute('SELECT u.user_id FROM users u JOIN role r USING(role_id) WHERE r.role_name=%s ORDER BY u.user_id LIMIT 1', (role,)).fetchone()['user_id']
                self.actors[role] = auth_model.get_user_by_id(db, uid)
        self.day = today_vn() - timedelta(days=today_vn().weekday()) + timedelta(days=14)
        self.secret = patch.dict(os.environ, {'SECRET_KEY': 'staff-leave-test-only'})
        self.secret.start()
        self.addCleanup(self.secret.stop)
        self.client = create_app().test_client()

    def headers(self, role):
        return {'Authorization': 'Bearer ' + create_access_token(self.actors[role])}

    def payload(self, **values):
        return {'from_date': self.day.isoformat(), 'period': 'MORNING', 'reason': 'Việc gia đình', **values}

    def create(self, role='NURSE', **values):
        result = self.client.post('/staff/leave-requests', headers=self.headers(role), json=self.payload(**values))
        self.assertEqual(result.status_code, 201, result.json)
        return result.json['leave_request']['request_id']

    def review(self, request_id, decision='APPROVED'):
        return self.client.post(f'/admin/leave-requests/{request_id}/review', headers=self.headers('ADMIN'),
                                json={'decision': decision, 'note': 'Đã kiểm tra bố trí nhân sự'})

    def schedule(self, afternoon=False):
        with get_db_connection() as db:
            return db.execute('''SELECT s.* FROM work_schedule s JOIN doctor_profile d USING(doctor_profile_id)
                WHERE d.user_id=%s AND work_date=%s AND start_time=%s''',
                (self.actors['DOCTOR']['user_id'], self.day, '13:30' if afternoon else '08:00')).fetchone()

    def test_default_calendar_all_roles_permissions_and_privacy(self):
        query = f'?from_date={self.day}&to_date={self.day + timedelta(days=6)}'
        for role in service.STAFF_ROLES:
            result = self.client.get('/staff/work-schedules' + query, headers=self.headers(role))
            self.assertEqual(result.status_code, 200, result.json)
            self.assertEqual(result.json['default_weekdays'], [1, 2, 3, 4, 5])
            expected = [1, 1, 1, 1, 1, 0, 0] if role == 'NURSE' else [2, 2, 2, 2, 2, 0, 0]
            self.assertEqual([len(d['shifts']) for d in result.json['items']], expected)
        self.assertEqual(self.client.get('/staff/work-schedules').status_code, 401)
        self.assertEqual(self.client.get('/staff/work-schedules', headers=self.headers('USER')).status_code, 403)
        self.assertEqual(self.client.get('/admin/staff/3/work-schedules', headers=self.headers('NURSE')).status_code, 403)
        result = self.client.get('/admin/staff/3/work-schedules' + query, headers=self.headers('ADMIN'))
        self.assertEqual(result.status_code, 200)
        request_id = self.create()
        self.assertEqual(self.client.get(f'/staff/leave-requests/{request_id}', headers=self.headers('DOCTOR')).status_code, 404)
        self.assertEqual(self.client.post(f'/staff/leave-requests/{request_id}/cancel', headers=self.headers('DOCTOR')).status_code, 404)
        self.assertEqual(self.client.get('/staff/leave-requests?user_id=3', headers=self.headers('DOCTOR')).json['total'], 0)
        self.assertEqual(self.client.post('/staff/leave-requests', headers=self.headers('NURSE'), json=self.payload(user_id=6)).status_code, 400)
        self.assertEqual(self.client.post('/staff/leave-requests', headers=self.headers('ADMIN'), json=self.payload()).status_code, 403)
        self.assertEqual(self.client.post(f'/admin/leave-requests/{request_id}/review', headers=self.headers('NURSE'), json={'decision': 'APPROVED', 'note': 'x'}).status_code, 403)
        paths = self.client.get('/apispec_1.json').json['paths']
        self.assertIn('post', paths['/staff/leave-requests'])
        self.assertIn('/admin/leave-requests/{request_id}/review', paths)

    def test_pending_rejection_cancellation_and_notifications(self):
        request_id = self.create()
        query = f'?from_date={self.day}&to_date={self.day}'
        calendar = self.client.get('/staff/work-schedules' + query, headers=self.headers('NURSE')).json
        self.assertEqual(calendar['items'][0]['shifts'][0]['status'], 'WORKING')
        self.assertTrue(calendar['items'][0]['shifts'][0]['pending_leave'])
        result = self.review(request_id, 'REJECTED')
        self.assertEqual(result.status_code, 200, result.json)
        self.assertEqual(result.json['leave_request']['reviewed_by_id'], self.actors['ADMIN']['user_id'])
        self.assertEqual(self.review(request_id, 'REJECTED').status_code, 200)
        self.assertEqual(self.review(request_id).status_code, 409)
        another = self.create()
        url = f'/staff/leave-requests/{another}/cancel'
        for _ in range(2):
            self.assertEqual(self.client.post(url, headers=self.headers('NURSE')).status_code, 200)
        self.assertEqual(self.review(another).status_code, 409)
        notifications = self.client.get('/notifications', headers=self.headers('NURSE')).json['items']
        self.assertEqual(sum(n['reference_id'] == request_id and n['reference_type'] == 'STAFF_LEAVE_REQUEST' for n in notifications), 1)
        listed = self.client.get('/admin/leave-requests?status=REJECTED&page_size=1', headers=self.headers('ADMIN')).json
        self.assertEqual(listed['total'], 1)
        self.assertEqual(len(listed['items']), 1)

    def test_doctor_approval_blocks_booking_and_preserves_existing_encounters(self):
        morning, afternoon = self.schedule(), self.schedule(True)
        with get_db_connection() as db:
            before = dict(db.execute('SELECT * FROM encounter WHERE encounter_id=1').fetchone())
            db.execute('UPDATE encounter SET schedule_id=%s,doctor_profile_id=%s WHERE encounter_id=1',
                       (morning['schedule_id'], morning['doctor_profile_id']))
            before = dict(db.execute('SELECT * FROM encounter WHERE encounter_id=1').fetchone())
            old_quota = morning['booked_count']
        request_id = self.create('DOCTOR')
        self.assertEqual(self.schedule()['schedule_status'], 'OPEN')
        result = self.review(request_id)
        self.assertEqual(result.status_code, 200, result.json)
        self.assertIn(morning['schedule_id'], result.json['leave_request']['effects']['unavailable_schedule_ids'])
        self.assertEqual(self.schedule()['schedule_status'], 'UNAVAILABLE')
        self.assertEqual(self.schedule(True)['schedule_status'], 'OPEN')
        with get_db_connection() as db:
            self.assertEqual(dict(db.execute('SELECT * FROM encounter WHERE encounter_id=1').fetchone()), before)
            self.assertEqual(db.execute('SELECT booked_count FROM work_schedule WHERE schedule_id=%s', (morning['schedule_id'],)).fetchone()['booked_count'], old_quota)
        self.assertEqual(self.review(request_id).json, result.json)
        public = self.client.get(f"/doctors/{morning['doctor_profile_id']}/schedules?from_date={self.day}&to_date={self.day}").json
        self.assertEqual(next(s for s in public['items'] if s['schedule_id'] == morning['schedule_id'])['slots'], [])
        with self.assertRaises(AppError) as raised:
            schedule_service.create_schedule({'doctor_profile_id': morning['doctor_profile_id'], 'room_id': morning['room_id'],
                'work_date': self.day, 'start_time': morning['start_time'], 'end_time': morning['end_time'], 'max_quota': 5})
        self.assertEqual(raised.exception.code, 'STAFF_ON_LEAVE')

    def test_approved_leave_prevents_moving_existing_work_into_absence(self):
        request_id = self.create('DOCTOR', period='FULL_DAY')
        self.assertEqual(self.review(request_id).status_code, 200)
        with get_db_connection() as db:
            other = db.execute('''SELECT s.* FROM work_schedule s JOIN doctor_profile d USING(doctor_profile_id)
                WHERE d.user_id=%s AND work_date=%s AND start_time='08:00' ''',
                (self.actors['DOCTOR']['user_id'], self.day + timedelta(days=1))).fetchone()
        with self.assertRaises(AppError) as raised:
            schedule_service.update_schedule(other['schedule_id'], {'work_date': self.day})
        self.assertEqual(raised.exception.code, 'STAFF_ON_LEAVE')

    def test_nurse_approval_revokes_only_matching_assignment_and_blocks_reassignment(self):
        morning, afternoon = self.schedule(), self.schedule(True)
        with get_db_connection() as db:
            db.execute('DELETE FROM nurse_assignment WHERE nurse_id=%s AND schedule_id IN (%s,%s)',
                       (self.actors['NURSE']['user_id'], morning['schedule_id'], afternoon['schedule_id']))
        for s in (morning, afternoon):
            schedule_service.create_assignment(self.actors['ADMIN'], {'nurse_id': self.actors['NURSE']['user_id'], 'schedule_id': s['schedule_id'], 'note': 'Hỗ trợ'})
        request_id = self.create()
        result = self.review(request_id)
        self.assertEqual(result.status_code, 200, result.json)
        self.assertEqual(len(result.json['leave_request']['effects']['revoked_assignment_ids']), 1)
        calendar = self.client.get(f'/staff/work-schedules?from_date={self.day}&to_date={self.day}', headers=self.headers('NURSE')).json
        self.assertEqual([s['status'] for s in calendar['items'][0]['shifts']], ['ON_LEAVE', 'WORKING'])
        with get_db_connection() as db:
            self.assertIsNotNone(db.execute('SELECT revoked_at FROM nurse_assignment WHERE nurse_id=%s AND schedule_id=%s', (self.actors['NURSE']['user_id'], morning['schedule_id'])).fetchone()['revoked_at'])
            self.assertIsNone(db.execute('SELECT revoked_at FROM nurse_assignment WHERE nurse_id=%s AND schedule_id=%s', (self.actors['NURSE']['user_id'], afternoon['schedule_id'])).fetchone()['revoked_at'])
        with self.assertRaises(AppError) as raised:
            schedule_service.create_assignment(self.actors['ADMIN'], {'nurse_id': self.actors['NURSE']['user_id'], 'schedule_id': morning['schedule_id'], 'note': ''})
        self.assertEqual(raised.exception.code, 'STAFF_ON_LEAVE')

    def test_receptionist_leave_and_legacy_doctor_endpoint_wait_for_admin(self):
        request_id = self.create('RECEPTIONIST', period='FULL_DAY')
        before = self.schedule()
        self.assertEqual(self.review(request_id).status_code, 200)
        self.assertEqual(self.schedule(), before)
        result = self.client.post(f"/doctor/schedules/{before['schedule_id']}/unavailability", headers=self.headers('DOCTOR'), json={'reason': 'Việc cá nhân'})
        self.assertEqual(result.status_code, 200, result.json)
        self.assertEqual(result.json['leave_request']['status'], 'PENDING')
        self.assertEqual(self.schedule()['schedule_status'], 'OPEN')

    def test_rescheduling_cannot_move_assigned_nurse_into_approved_leave(self):
        request_id = self.create('NURSE')
        self.assertEqual(self.review(request_id).status_code, 200)
        with get_db_connection() as db:
            other = db.execute('''SELECT s.* FROM work_schedule s JOIN doctor_profile d USING(doctor_profile_id)
                WHERE d.user_id=%s AND work_date=%s AND start_time='08:00' ''',
                (self.actors['DOCTOR']['user_id'], self.day + timedelta(days=1))).fetchone()
        # The morning-only seed already assigns this nurse to the following day.
        with self.assertRaises(AppError) as raised:
            schedule_service.update_schedule(other['schedule_id'], {'work_date': self.day})
        self.assertEqual(raised.exception.code, 'STAFF_ON_LEAVE')

    def test_overlaps_half_days_weekend_intersection_and_parallel_creation(self):
        def create_once(_):
            try:
                service.create(self.actors['NURSE'], schema.validate_create(self.payload()))
                return 201
            except AppError as error:
                return error.status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(sorted(executor.map(create_once, range(2))), [201, 409])
        self.create(period='AFTERNOON')
        self.assertEqual(self.client.post('/staff/leave-requests', headers=self.headers('NURSE'), json=self.payload(period='FULL_DAY')).status_code, 409)
        # Fri–Sun and Sat–Mon overlap only on non-working weekend days.
        self.create('RECEPTIONIST', from_date=(self.day + timedelta(days=4)).isoformat(), to_date=(self.day + timedelta(days=6)).isoformat())
        self.create('RECEPTIONIST', from_date=(self.day + timedelta(days=5)).isoformat(), to_date=(self.day + timedelta(days=7)).isoformat())

    def test_parallel_reviews_and_transaction_rollback(self):
        request_id = self.create('DOCTOR')
        def decide(decision):
            try:
                service.review(self.actors['ADMIN'], request_id, {'decision': decision, 'note': 'Test concurrency'})
                return 200
            except AppError as error:
                return error.status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(sorted(executor.map(decide, ('APPROVED', 'REJECTED'))), [200, 409])
        other = self.create('DOCTOR', period='AFTERNOON')
        with patch.object(service.model, 'notify', side_effect=RuntimeError('notification failed')):
            with self.assertRaises(RuntimeError):
                service.review(self.actors['ADMIN'], other, {'decision': 'APPROVED', 'note': 'Test rollback'})
        self.assertEqual(self.schedule(True)['schedule_status'], 'OPEN')
        self.assertEqual(self.client.get(f'/staff/leave-requests/{other}', headers=self.headers('DOCTOR')).json['leave_request']['status'], 'PENDING')

    def test_no_retroactive_approval_or_inactive_employee(self):
        request_id = self.create('DOCTOR')
        with patch.object(service, '_future', side_effect=AppError(409, 'LEAVE_ALREADY_STARTED', 'past')):
            self.assertEqual(self.review(request_id).status_code, 409)
        with get_db_connection() as db:
            db.execute("UPDATE users SET account_status='LOCKED' WHERE user_id=%s", (self.actors['DOCTOR']['user_id'],))
        self.assertEqual(self.review(request_id).status_code, 404)

    def test_calendar_only_approved_absence_changes_working_status(self):
        request_id = self.create('RECEPTIONIST', period='AFTERNOON')
        self.assertEqual(self.review(request_id).status_code, 200)
        url = f'/staff/work-schedules?from_date={self.day}&to_date={self.day}'
        shifts = self.client.get(url, headers=self.headers('RECEPTIONIST')).json['items'][0]['shifts']
        self.assertEqual([s['status'] for s in shifts], ['WORKING', 'ON_LEAVE'])
        self.assertEqual(self.client.post(f'/staff/leave-requests/{request_id}/cancel', headers=self.headers('RECEPTIONIST')).status_code, 409)
        # Actual time check, not only date validation.
        with self.assertRaises(AppError) as raised:
            service._future({'from_date': today_vn() - timedelta(days=7), 'period': 'FULL_DAY'})
        self.assertEqual(raised.exception.code, 'LEAVE_ALREADY_STARTED')
