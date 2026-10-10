import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from backend.tests import test_encounter_reads
from backend.app.db.database import get_db_connection
from backend.app.services import encounter_service as service, payment_service
from backend.app.utils.worker import expire_holds, enqueue_reminders
from backend.app.models import user_model
from backend.app.core.security import create_access_token
from backend.app.core.constants import SYSTEM_WORKER_EMAIL
from backend.app.core.errors import AppError


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Requires disposable PostgreSQL')
class EncounterWorkflowTests(unittest.TestCase):
    setUp = test_encounter_reads.EncounterReadTests.setUp
    drop_schema = test_encounter_reads.EncounterReadTests.drop_schema
    headers = test_encounter_reads.EncounterReadTests.headers

    def fixture(self):
        # Đặt trước ca 10:00 Asia/Saigon 7 giờ, đáp ứng hạn online 5 giờ.
        self.now = datetime(2034, 12, 31, 20, 0, tzinfo=timezone.utc)
        with get_db_connection() as db:
            db.execute("UPDATE work_schedule SET work_date='2035-01-01',start_time='10:00',end_time='12:00',"
                       "max_quota=10,booked_count=0,last_queue_number=0,schedule_status='OPEN' WHERE schedule_id=1")
            db.execute("UPDATE work_schedule SET work_date='2035-01-01',start_time='10:00',end_time='12:00',"
                       "max_quota=10,booked_count=0,last_queue_number=0,schedule_status='OPEN' WHERE schedule_id=2")
            db.execute('UPDATE encounter SET schedule_id=10,queue_number=NULL WHERE schedule_id IN (1,2)')
            db.execute('UPDATE doctor_profile SET department_id=1,consultation_fee=100000,is_active=1 WHERE doctor_profile_id IN (1,2)')
            db.execute("UPDATE users SET account_status='ACTIVE',approval_status='APPROVED' WHERE user_id IN "
                       '(SELECT user_id FROM doctor_profile WHERE doctor_profile_id IN (1,2))')
            db.execute('UPDATE room SET is_active=1'); db.execute('UPDATE department SET is_active=1')
            db.execute('UPDATE patient SET user_id=%s,archived_at=NULL WHERE patient_id IN (1,2)', (self.actors['USER']['user_id'],))
        clock = patch.object(service, 'utc_now', side_effect=lambda: self.now)
        clock.start(); self.addCleanup(clock.stop)

    def book(self, patient=1):
        response = self.client.post('/encounters/online', headers=self.headers('USER'), json={'patient_id': patient, 'schedule_id': 1})
        self.assertEqual(response.status_code, 201, response.json)
        return response.json['encounter']['encounter_id']

    def pay(self, encounter_id):
        with get_db_connection() as db:
            db.execute("INSERT INTO payment(encounter_id,payment_type,amount,payment_method,transaction_status) "
                       "VALUES (%s,'DEPOSIT',100000,'CARD','SUCCESS')", (encounter_id,))
            return service.confirm_paid_online(db, encounter_id, self.actors['ADMIN']['user_id'])

    def test_payment_result_uses_send_email_and_is_idempotent(self):
        self.fixture()
        eid = self.book()
        headers = self.headers('USER')
        intent = self.client.post(f'/encounters/{eid}/payment-intents', headers=headers,
                                  json={'payment_method': 'CARD'})
        self.assertEqual(intent.status_code, 201, intent.json)
        payment_id = intent.json['payment']['payment_id']
        url = f'/demo/payments/{payment_id}/result'
        with patch.dict(os.environ, {'SEND_EMAIL': '1'}):
            for _ in range(2):
                response = self.client.post(url, headers=headers, json={'result': 'SUCCESS'})
                self.assertEqual(response.status_code, 200, response.json)
                self.assertEqual(response.json['encounter']['encounter_status'], 'CONFIRMED')
                self.assertEqual(response.json['encounter']['queue_number'], 1)
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT booked_count FROM work_schedule WHERE schedule_id=1').fetchone()['booked_count'], 1)
            self.assertEqual(db.execute("SELECT COUNT(*) n FROM payment WHERE encounter_id=%s AND transaction_status='SUCCESS'", (eid,)).fetchone()['n'], 1)
            self.assertEqual(db.execute("SELECT COUNT(*) n FROM encounter_status_log WHERE encounter_id=%s AND new_status='CONFIRMED'", (eid,)).fetchone()['n'], 1)

    def test_payment_result_disabled_without_send_email(self):
        for setting in (None, '0'):
            with self.subTest(setting=setting), patch.dict(os.environ):
                if setting is None:
                    os.environ.pop('SEND_EMAIL', None)
                else:
                    os.environ['SEND_EMAIL'] = setting
                response = self.client.post('/demo/payments/1/result', headers=self.headers('USER'),
                                            json={'result': 'SUCCESS'})
                self.assertEqual(response.status_code, 404, response.json)
                with self.assertRaises(AppError) as error:
                    payment_service.demo_result(self.actors['USER'], 1, 'SUCCESS')
                self.assertEqual(error.exception.status_code, 404)

    def test_medical_record_and_prescription_share_revision_history(self):
        self.fixture()
        eid = self.book()
        self.pay(eid)
        response = self.client.post(f'/staff/encounters/{eid}/check-in', headers=self.headers('ADMIN'))
        self.assertEqual(response.status_code, 200, response.json)
        self.now = datetime(2035, 1, 1, 3, 0, tzinfo=timezone.utc)
        with get_db_connection() as db:
            uid = db.execute('SELECT user_id FROM doctor_profile WHERE doctor_profile_id=1').fetchone()['user_id']
            doctor = user_model.get_user_by_id(db, uid)
        headers = {'Authorization': 'Bearer ' + create_access_token(doctor)}
        response = self.client.post(f'/doctor/encounters/{eid}/start', headers=headers)
        self.assertEqual(response.status_code, 200, response.json)
        record_url = f'/doctor/encounters/{eid}/medical-record'
        response = self.client.put(record_url, headers=headers, json={'diagnosis': 'Chẩn đoán ban đầu'})
        self.assertEqual(response.status_code, 200, response.json)
        record = response.json['medical_record']
        self.assertEqual(record['version'], 1)
        items_url = f'/doctor/medical-records/{record["record_id"]}/prescription-items'
        item = {'medication_name': 'Thuốc kiểm thử', 'quantity': 2}
        invalid = self.client.put(items_url, headers=headers, json={'items': [{**item, 'quantity': 0}]})
        self.assertEqual(invalid.status_code, 400, invalid.json)
        response = self.client.put(items_url, headers=headers, json={'items': [item], 'expected_version': 1})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['record_version'], 2)
        response = self.client.post(f'/doctor/encounters/{eid}/complete', headers=headers)
        self.assertEqual(response.status_code, 200, response.json)
        invalid = self.client.put(record_url, headers=headers, json={'diagnosis': 'Bổ sung', 'expected_version': 2})
        self.assertEqual(invalid.status_code, 409, invalid.json)
        response = self.client.put(record_url, headers=headers, json={
            'diagnosis': 'Bổ sung', 'expected_version': 2, 'reason': 'Cập nhật kết quả'})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['medical_record']['version'], 3)
        with get_db_connection() as db:
            stored = db.execute('SELECT * FROM medical_record WHERE encounter_id=%s', (eid,)).fetchone()
            self.assertEqual(len(stored['revision_history']), 3)
            latest = stored['revision_history'][-1]
            self.assertEqual(latest['before']['diagnosis'], 'Chẩn đoán ban đầu')
            self.assertEqual(latest['after']['diagnosis'], 'Bổ sung')
            self.assertEqual(latest['after']['prescription_items'][0]['quantity'], 2)
            self.assertEqual(db.execute('SELECT encounter_status FROM encounter WHERE encounter_id=%s', (eid,)).fetchone()['encounter_status'], 'COMPLETED')

    def test_worker_reminders_do_not_repeat(self):
        self.fixture()
        eid = self.book()
        self.pay(eid)
        self.assertEqual(enqueue_reminders(), 1)
        self.assertEqual(enqueue_reminders(), 0)
        with get_db_connection() as db:
            rows = db.execute("SELECT * FROM notification WHERE reference_id=%s AND notification_type='REMINDER'", (eid,)).fetchall()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['user_id'], self.actors['USER']['user_id'])

    def test_hold_walkin_priority_full_fee_and_idempotent_cancel(self):
        self.fixture(); eid = self.book()
        hold = self.client.get(f'/encounters/{eid}', headers=self.headers('USER')).json['encounter']
        self.assertEqual(hold['deposit_amount_snapshot'], 100000)
        self.assertIsNone(hold['queue_number'])
        walk = self.client.post('/staff/encounters/walk-in', headers=self.headers('ADMIN'), json={'patient_id': 2, 'doctor_profile_id': 1})
        self.assertEqual(walk.status_code, 201, walk.json)
        self.assertEqual(walk.json['encounter']['queue_number'], 1)
        self.assertTrue(self.pay(eid))
        online = self.client.get(f'/encounters/{eid}', headers=self.headers('USER')).json['encounter']
        self.assertEqual(online['queue_number'], 2)
        with get_db_connection() as db:
            self.assertTrue(service.confirm_paid_online(db, eid, self.actors['ADMIN']['user_id']))
        wid = walk.json['encounter']['encounter_id']
        for _ in range(2):
            self.assertEqual(self.client.post(f'/encounters/{wid}/cancel', headers=self.headers('ADMIN'), json={'reason': 'Không tiếp nhận được'}).status_code, 200)
        queue = self.client.get('/staff/queues?schedule_id=1', headers=self.headers('ADMIN')).json
        self.assertEqual(queue['total'], 1); self.assertEqual(queue['items'][0]['queue_number'], 2)
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT booked_count FROM work_schedule WHERE schedule_id=1').fetchone()['booked_count'], 1)
            self.assertEqual(db.execute("SELECT COUNT(*) n FROM encounter_status_log WHERE encounter_id=%s AND new_status='CANCELLED'", (wid,)).fetchone()['n'], 1)

    def test_expiry_and_late_payment_do_not_restore_quota(self):
        self.fixture(); eid = self.book(); self.now += timedelta(minutes=10)
        self.assertFalse(self.pay(eid))
        self.assertEqual(expire_holds(), 0)
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT encounter_status FROM encounter WHERE encounter_id=%s', (eid,)).fetchone()['encounter_status'], 'EXPIRED')
            self.assertEqual(db.execute('SELECT booked_count FROM work_schedule WHERE schedule_id=1').fetchone()['booked_count'], 0)
        eid = self.book(2); self.now += timedelta(minutes=10)
        self.assertEqual(expire_holds(), 1); self.assertEqual(expire_holds(), 0)
        with get_db_connection() as db:
            actor = db.execute('SELECT * FROM users WHERE email=%s', (SYSTEM_WORKER_EMAIL,)).fetchone()
            self.assertEqual(actor['account_status'], 'LOCKED')
            token = create_access_token(actor)
        self.assertEqual(self.client.get('/encounters', headers={'Authorization': 'Bearer ' + token}).status_code, 401)

    def test_checkin_boundary_start_and_no_show(self):
        self.fixture(); eid = self.book(); self.pay(eid)
        self.now = datetime(2035, 1, 1, 2, 30, tzinfo=timezone.utc)
        url = f'/staff/encounters/{eid}/check-in'
        self.assertEqual(self.client.post(url, headers=self.headers('USER')).status_code, 403)
        for _ in range(2): self.assertEqual(self.client.post(url, headers=self.headers('ADMIN')).status_code, 200)
        with get_db_connection() as db:
            uid = db.execute('SELECT user_id FROM doctor_profile WHERE doctor_profile_id=1').fetchone()['user_id']
            doctor = user_model.get_user_by_id(db, uid)
        headers = {'Authorization': 'Bearer ' + create_access_token(doctor)}
        start = f'/doctor/encounters/{eid}/start'
        self.assertEqual(self.client.post(start, headers=headers).status_code, 409)
        self.now += timedelta(minutes=30)
        for _ in range(2): self.assertEqual(self.client.post(start, headers=headers).status_code, 200)
        self.now = datetime(2034, 12, 31, 20, 0, tzinfo=timezone.utc)
        second = self.book(2); self.pay(second)
        self.now = datetime(2035, 1, 1, 2, 30, 1, tzinfo=timezone.utc)
        self.assertEqual(self.client.post(f'/staff/encounters/{second}/check-in', headers=self.headers('ADMIN')).status_code, 409)
        no_show = f'/staff/encounters/{second}/no-show'
        self.now = datetime(2035, 1, 1, 5, 15, tzinfo=timezone.utc)
        self.assertEqual(self.client.post(no_show, headers=self.headers('ADMIN')).status_code, 409)
        self.now += timedelta(seconds=1)
        for _ in range(2): self.assertEqual(self.client.post(no_show, headers=self.headers('ADMIN')).status_code, 200)

    def test_transfer_preserves_price_and_source_queue_counter(self):
        self.fixture(); eid = self.book(); self.pay(eid)
        options = self.client.get(f'/staff/encounters/{eid}/transfer-options', headers=self.headers('ADMIN'))
        self.assertEqual(options.status_code, 200)
        self.assertIn(2, [r['schedule_id'] for r in options.json['items']])
        moved = self.client.post(f'/staff/encounters/{eid}/transfer', headers=self.headers('ADMIN'), json={'schedule_id': 2, 'reason': 'Bác sĩ nghỉ'})
        self.assertEqual(moved.status_code, 200, moved.json)
        self.assertEqual(moved.json['encounter']['deposit_amount_snapshot'], 100000)
        self.assertEqual(self.client.get(f'/encounters/{eid}/transfer-history', headers=self.headers('USER')).json['total'], 1)
        second = self.book(2); self.pay(second)
        self.assertEqual(self.client.get(f'/encounters/{second}', headers=self.headers('USER')).json['encounter']['queue_number'], 2)
        with get_db_connection() as db:
            db.execute("UPDATE work_schedule SET schedule_status='UNAVAILABLE' WHERE schedule_id=1")
        affected = self.client.get('/staff/schedules/1/affected-encounters', headers=self.headers('ADMIN'))
        self.assertEqual(affected.status_code, 200); self.assertEqual(affected.json['total'], 1)

    def test_concurrent_last_slot_and_transaction_rollback(self):
        self.fixture()
        with get_db_connection() as db: db.execute('UPDATE work_schedule SET max_quota=1 WHERE schedule_id=1')
        def reserve(patient):
            with self.client.application.test_client() as client:
                return client.post('/encounters/online', headers=self.headers('USER'), json={'patient_id': patient, 'schedule_id': 1}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(reserve, (1,2))), [201,409])
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT booked_count FROM work_schedule WHERE schedule_id=1').fetchone()['booked_count'], 1)
        self.fixture()
        with patch('backend.app.models.encounter_model.add_status', side_effect=RuntimeError('test rollback')):
            with self.assertRaises(RuntimeError): service.create_online(self.actors['USER'], {'patient_id': 2, 'schedule_id': 2})
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT booked_count FROM work_schedule WHERE schedule_id=2').fetchone()['booked_count'], 0)
