"""Real PostgreSQL checks for phone accounts, family profiles and recovery."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from unittest.mock import patch

from backend.tests import test_nurse_assignment
from backend.app.core.security import create_access_token, verify_password
from backend.app.db.database import get_db_connection
from backend.app.models import auth_model
from backend.app.services import encounter_service


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Requires disposable PostgreSQL')
class PatientAccountTests(unittest.TestCase):
    setUp = test_nurse_assignment.NurseAssignmentTests.setUp
    drop_schema = test_nurse_assignment.NurseAssignmentTests.drop_schema
    headers = test_nurse_assignment.NurseAssignmentTests.headers

    def payload(self, **extra):
        return {'full_name': 'Người khám kiểm thử', 'phone': '0931234567', 'dob': '1990-05-20',
                'id_card': '001090123456', **extra}

    def actor_headers(self, uid):
        with get_db_connection() as db:
            actor = auth_model.get_user_by_id(db, uid)
        return {'Authorization': 'Bearer ' + create_access_token(actor)}

    def test_reception_creates_account_and_reuses_same_patient(self):
        with patch('backend.app.services.patient_service.secrets.token_urlsafe', return_value='Hidden-random-12345'):
            response = self.client.post('/patients', headers=self.headers('ADMIN'), json=self.payload())
        self.assertEqual(response.status_code, 201, response.json)
        self.assertTrue(response.json['account_created'])
        self.assertNotIn('Hidden-random-12345', response.get_data(as_text=True))
        patient = response.json['patient']
        with get_db_connection() as db:
            account = auth_model.get_user_by_id(db, patient['user_id'])
            self.assertEqual(account['phone'], self.payload()['phone'])
            self.assertEqual(account['role_name'], 'USER')
            self.assertTrue(verify_password(account['password_hash'], 'Hidden-random-12345'))
            original_hash = account['password_hash']
        repeated = self.client.post('/patients', headers=self.headers('ADMIN'), json=self.payload())
        self.assertEqual(repeated.status_code, 200, repeated.json)
        self.assertTrue(repeated.json['account_exists'])
        self.assertEqual(repeated.json['patient']['patient_id'], patient['patient_id'])
        with get_db_connection() as db:
            self.assertEqual(auth_model.get_user_by_id(db, patient['user_id'])['password_hash'], original_hash)

    def test_family_confirmation_and_separate_saved_profiles(self):
        phone = self.actors['USER']['phone']
        child = self.payload(full_name='Con thứ nhất', phone=phone, dob='2018-03-01',
                             id_card=None, relationship='CHILD')
        denied = self.client.post('/patients', headers=self.headers('USER'), json=child)
        self.assertEqual(denied.status_code, 409)
        self.assertEqual(denied.json['error']['code'], 'CONFIRM_SHARED_PHONE')
        first = self.client.post('/patients', headers=self.headers('USER'),
                                 json={**child, 'confirm_shared_phone': True})
        self.assertEqual(first.status_code, 201, first.json)
        self.assertEqual(first.json['patient']['user_id'], self.actors['USER']['user_id'])
        second = self.client.post('/patients', headers=self.headers('USER'),
                                  json={**child, 'full_name': 'Con thứ hai', 'dob': '2020-03-01',
                                        'confirm_shared_phone': True})
        self.assertEqual(second.status_code, 201, second.json)
        first_id, second_id = first.json['patient']['patient_id'], second.json['patient']['patient_id']
        self.assertNotEqual(first_id, second_id)
        saved = self.client.get('/patients', headers=self.headers('USER')).json['items']
        self.assertTrue({first_id, second_id}.issubset({p['patient_id'] for p in saved}))
        repeated = self.client.post('/patients', headers=self.headers('USER'),
                                    json={**child, 'confirm_shared_phone': True})
        self.assertEqual(repeated.status_code, 200, repeated.json)
        self.assertEqual(repeated.json['patient']['patient_id'], first_id)

    def test_phone_otp_reset_login_and_single_use_tokens(self):
        created = self.client.post('/patients', headers=self.headers('ADMIN'), json=self.payload())
        uid = created.json['patient']['user_id']
        phone = self.payload()['phone']
        with patch('backend.app.services.auth_service.mail.send_sms_otp') as sms:
            response = self.client.post('/auth/forgot-password', json={'identifier': '+84931234567'})
            self.assertEqual(response.status_code, 200)
            sent_phone, otp = sms.call_args.args
        self.assertEqual(sent_phone, phone)
        self.assertNotIn(otp, response.get_data(as_text=True))
        verified = self.client.post('/auth/verify-otp', json={'phone': phone, 'otp': otp})
        self.assertEqual(verified.status_code, 200, verified.json)
        self.assertEqual(self.client.post('/auth/verify-otp', json={'phone': phone, 'otp': otp}).status_code, 400)
        reset = {'reset_token': verified.json['reset_token'], 'new_password': 'Patient-new-pass-123'}
        self.assertEqual(self.client.post('/auth/reset-password', json=reset).status_code, 200)
        self.assertEqual(self.client.post('/auth/reset-password', json=reset).status_code, 400)
        login = self.client.post('/auth/login', json={'identifier': phone, 'password': reset['new_password']})
        self.assertEqual(login.status_code, 200, login.json)
        self.assertEqual(login.json['user']['user_id'], uid)
        history = self.client.get('/patients', headers={'Authorization': 'Bearer ' + login.json['access_token']})
        self.assertIn(created.json['patient']['patient_id'], [p['patient_id'] for p in history.json['items']])

    def test_recovery_unknown_locked_and_wrong_otp(self):
        known = self.actors['USER']['phone']
        with patch('backend.app.services.auth_service.mail.send_sms_otp') as sms:
            unknown = self.client.post('/auth/forgot-password', json={'phone': '0989999999'})
            self.assertFalse(sms.called)
            existing = self.client.post('/auth/forgot-password', json={'phone': known})
            self.assertEqual(unknown.json, existing.json)
            otp = sms.call_args.args[1]
        with get_db_connection() as db:
            db.execute("UPDATE auth_token SET expires_at=created_at+interval '1 second', "
                       "created_at=created_at-interval '1 minute' WHERE user_id=%s AND token_type='OTP'",
                       (self.actors['USER']['user_id'],))
            # Move both timestamps to ensure expiry while respecting CHECK constraints.
            db.execute("UPDATE auth_token SET expires_at=created_at+interval '1 second' "
                       "WHERE user_id=%s AND token_type='OTP'", (self.actors['USER']['user_id'],))
        self.assertEqual(self.client.post('/auth/verify-otp', json={'phone': known, 'otp': otp}).status_code, 400)
        with get_db_connection() as db:
            db.execute("UPDATE users SET account_status='LOCKED' WHERE user_id=%s", (self.actors['USER']['user_id'],))
        with patch('backend.app.services.auth_service.mail.send_sms_otp') as sms:
            self.client.post('/auth/forgot-password', json={'phone': known})
            self.assertFalse(sms.called)

    def test_distinct_phone_delegate_only_reads_own_bookings(self):
        self.client.post('/patients', headers=self.headers('ADMIN'), json=self.payload(relationship='PARENT'))
        created = self.client.post('/patients', headers=self.headers('USER'),
                                   json=self.payload(relationship='PARENT'))
        self.assertEqual(created.status_code, 200, created.json)
        patient = created.json['patient']
        self.assertNotEqual(patient['user_id'], self.actors['USER']['user_id'])
        recipient = self.actor_headers(patient['user_id'])
        with get_db_connection() as db:
            db.execute("UPDATE work_schedule SET work_date='2035-01-01',start_time='10:00',end_time='12:00',"
                       "max_quota=4,booked_count=0,schedule_status='OPEN' WHERE schedule_id=1")
            other_uid = db.execute("SELECT user_id FROM users WHERE user_id=5").fetchone()['user_id']
            db.execute('UPDATE encounter SET patient_id=%s,created_by_id=%s WHERE encounter_id=1',
                       (patient['patient_id'], other_uid))
        with patch.object(encounter_service, 'utc_now', return_value=datetime(2034, 12, 31, 20, tzinfo=timezone.utc)):
            booking = self.client.post('/encounters/online', headers=self.headers('USER'),
                                        json={'patient_id': patient['patient_id'], 'schedule_id': 1,
                                              'appointment_time': '10:00'})
        self.assertEqual(booking.status_code, 201, booking.json)
        eid = booking.json['encounter']['encounter_id']
        with get_db_connection() as db:
            db.execute("INSERT INTO medical_record(encounter_id,diagnosis,examined_at) VALUES (%s,'Test',now())", (eid,))
        for headers in (recipient, self.headers('USER')):
            self.assertEqual(self.client.get(f'/encounters/{eid}/medical-record', headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/encounters/1/medical-record', headers=self.headers('USER')).status_code, 404)
        self.assertEqual(self.client.get('/encounters/1/medical-record', headers=recipient).status_code, 200)
        history_path = f"/patients/{patient['patient_id']}/encounters"
        self.assertEqual(self.client.get(history_path, headers=self.headers('USER')).json['total'], 1)
        self.assertEqual(self.client.get(history_path, headers=recipient).json['total'], 2)
        saved = self.client.get('/patients', headers=self.headers('USER')).json['items']
        self.assertIn(patient['patient_id'], [p['patient_id'] for p in saved])
        self.assertEqual(self.client.patch(f"/patients/{patient['patient_id']}", headers=self.headers('USER'),
                                           json={'address': 'Do not replace'}).status_code, 403)

    def test_phone_lookup_only_returns_people_actually_booked_by_the_signed_in_user(self):
        headers = self.headers('USER')
        people = [self.payload(relationship='PARENT'), self.payload(full_name='Người thứ hai', id_card='001090123457', relationship='PARENT')]
        ids = []
        for fields in people:
            self.client.post('/patients', headers=self.headers('ADMIN'), json=fields)
            saved = self.client.post('/patients', headers=headers, json=fields)
            self.assertEqual(saved.status_code, 200, saved.json)
            ids.append(saved.json['patient']['patient_id'])
        query = {'phone': '+84 931.234.567', 'booked_by_me': 'true', 'include_archived': 'true', 'page_size': 1}
        self.assertEqual(self.client.get('/patients', headers=headers, query_string=query).json['total'], 0)
        with get_db_connection() as db:
            db.execute("UPDATE encounter SET patient_id=%s,created_by_id=%s,encounter_type='ONLINE' WHERE encounter_id=1",
                       (ids[0], self.actors['USER']['user_id']))
            recipient = auth_model.get_user_by_phone(db, people[0]['phone'])
            db.execute("UPDATE encounter SET patient_id=%s,created_by_id=%s,encounter_type='ONLINE' WHERE encounter_id=2",
                       (ids[1], recipient['user_id']))
        found = self.client.get('/patients', headers=headers, query_string=query)
        self.assertEqual(found.status_code, 200, found.json)
        self.assertEqual(found.json['total'], 1)
        self.assertEqual([item['patient_id'] for item in found.json['items']], [ids[0]])
        self.assertEqual(self.client.get('/patients', headers=headers, query_string={**query, 'phone': '0909999999'}).json['total'], 0)
        self.assertEqual(self.client.get('/patients', headers=headers, query_string={**query, 'phone': '123'}).status_code, 400)
        self.assertEqual(self.client.get('/patients', query_string=query).status_code, 401)
        self.assertEqual(self.client.get('/patients', headers=self.headers('ADMIN'), query_string=query).status_code, 403)
        self.assertEqual(self.client.get('/patients', headers=headers, query_string={**query, 'page': 2}).json['items'], [])
        with get_db_connection() as db:
            db.execute('UPDATE patient SET archived_at=now() WHERE patient_id=%s', (ids[0],))
        self.assertEqual(self.client.get('/patients', headers=headers, query_string=query).json['total'], 1)
        self.assertEqual(self.client.get('/patients', headers=headers, query_string={**query, 'include_archived': 'false'}).json['total'], 0)

    def test_saved_relative_matches_phone_and_name_without_overwriting_their_profile_or_account(self):
        created = self.client.post('/patients', headers=self.headers('ADMIN'), json=self.payload())
        self.assertEqual(created.status_code, 201, created.json)
        pid = created.json['patient']['patient_id']
        uid = created.json['patient']['user_id']
        with get_db_connection() as db:
            original_patient = dict(db.execute('SELECT * FROM patient WHERE patient_id=%s', (pid,)).fetchone())
            original_user = dict(auth_model.get_user_by_id(db, uid))
        entered = self.payload(full_name='  NGƯỜI   KHÁM KIỂM THỬ  ', phone='+84 931.234.567',
                               id_card='001090123457', dob='1991-02-03', address='Địa chỉ khai thêm',
                               gender='Khác', health_insurance='AB12345678', relationship='PARENT')
        saved = self.client.post('/patients', headers=self.headers('USER'), json=entered)
        self.assertEqual(saved.status_code, 200, saved.json)
        self.assertEqual(saved.json['patient']['patient_id'], pid)
        self.assertFalse(saved.json['account_created'])
        listed = self.client.get('/patients', headers=self.headers('USER')).json['items']
        self.assertEqual(sum(item['patient_id'] == pid for item in listed), 1)
        self.assertEqual(self.client.patch(f'/patients/{pid}', headers=self.headers('USER'),
                                           json={'address': entered['address']}).status_code, 403)
        with get_db_connection() as db:
            self.assertEqual(dict(db.execute('SELECT * FROM patient WHERE patient_id=%s', (pid,)).fetchone()), original_patient)
            self.assertEqual(dict(auth_model.get_user_by_id(db, uid)), original_user)

    def test_concurrent_creation_reuses_account_and_patient(self):
        def create():
            with self.client.application.test_client() as client:
                response = client.post('/patients', headers=self.headers('ADMIN'), json=self.payload())
                return response.status_code, response.json['patient']['patient_id']
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: create(), range(2)))
        self.assertEqual(sorted(status for status, _ in results), [200, 201])
        self.assertEqual(len({pid for _, pid in results}), 1)
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT count(*) n FROM users WHERE phone=%s',
                                        (self.payload()['phone'],)).fetchone()['n'], 1)

    def test_identity_mismatch_rolls_back_without_overwriting(self):
        first = self.client.post('/patients', headers=self.headers('ADMIN'), json=self.payload())
        conflict = self.client.post('/patients', headers=self.headers('ADMIN'),
                                    json=self.payload(phone='0981234567'))
        self.assertEqual(conflict.status_code, 409)
        with get_db_connection() as db:
            self.assertIsNone(auth_model.get_user_by_phone(db, '0981234567'))
            self.assertEqual(db.execute('SELECT phone FROM patient WHERE patient_id=%s',
                                        (first.json['patient']['patient_id'],)).fetchone()['phone'], self.payload()['phone'])

    def test_account_phone_change_preserves_family_links(self):
        child = self.client.post('/patients', headers=self.headers('USER'), json=self.payload(
            full_name='Con dùng số chung', phone=self.actors['USER']['phone'], id_card=None,
            relationship='CHILD', confirm_shared_phone=True))
        changed = self.client.patch('/me', headers=self.headers('USER'), json={'phone': '0985555555'})
        self.assertEqual(changed.status_code, 200, changed.json)
        profiles = self.client.get('/patients', headers=self.headers('USER')).json['items']
        own = [p for p in profiles if p['user_id'] == self.actors['USER']['user_id']]
        self.assertTrue(own)
        self.assertTrue(all(p['phone'] == '0985555555' for p in own))
        self.assertIn(child.json['patient']['patient_id'], [p['patient_id'] for p in own])

    def test_rebooking_family_member_writes_to_selected_profile_only(self):
        children = []
        for name, dob in (('Con Một', '2018-03-01'), ('Con Hai', '2020-03-01')):
            response = self.client.post('/patients', headers=self.headers('USER'), json=self.payload(
                full_name=name, dob=dob, phone=self.actors['USER']['phone'], id_card=None,
                relationship='CHILD', confirm_shared_phone=True))
            self.assertEqual(response.status_code, 201, response.json)
            children.append(response.json['patient']['patient_id'])
        with get_db_connection() as db:
            db.execute("UPDATE work_schedule SET work_date='2035-01-01',start_time='10:00',end_time='12:00',"
                       "max_quota=4,booked_count=0,schedule_status='OPEN' WHERE schedule_id=1")
        with patch.object(encounter_service, 'utc_now', return_value=datetime(2034, 12, 31, 20, tzinfo=timezone.utc)):
            booking = self.client.post('/encounters/online', headers=self.headers('USER'),
                json={'patient_id': children[1], 'schedule_id': 1, 'appointment_time': '10:00'})
        self.assertEqual(booking.status_code, 201, booking.json)
        eid = booking.json['encounter']['encounter_id']
        with get_db_connection() as db:
            db.execute("INSERT INTO medical_record(encounter_id,diagnosis,examined_at) VALUES (%s,'Con Hai',now())", (eid,))
        self.assertEqual(self.client.get(f'/patients/{children[0]}/encounters', headers=self.headers('USER')).json['total'], 0)
        history = self.client.get(f'/patients/{children[1]}/encounters', headers=self.headers('USER')).json
        self.assertEqual(history['total'], 1)
        self.assertEqual(history['items'][0]['encounter_id'], eid)
        record = self.client.get(f'/encounters/{eid}/medical-record', headers=self.headers('USER'))
        self.assertEqual(record.json['medical_record']['diagnosis'], 'Con Hai')

    def test_locked_account_and_invalid_identity_do_not_create_patient(self):
        with get_db_connection() as db:
            db.execute("UPDATE users SET account_status='LOCKED' WHERE user_id=5")
        locked = self.client.post('/patients', headers=self.headers('ADMIN'), json=self.payload(
            phone='0911000002', id_card=None))
        self.assertEqual(locked.status_code, 409, locked.json)
        for invalid in ({'phone': None}, {'id_card': None, 'dob': None}, {'confirm_shared_phone': 'true'}):
            response = self.client.post('/patients', headers=self.headers('ADMIN'), json=self.payload(**invalid))
            self.assertEqual(response.status_code, 400, response.json)
        with get_db_connection() as db:
            self.assertIsNone(auth_model.get_user_by_phone(db, self.payload()['phone']))

    def test_phone_sms_demo_does_not_leak_code_when_disabled(self):
        from backend.app.utils import mail
        with patch.dict(os.environ, {'SEND_SMS': '0'}), patch('builtins.print') as output:
            mail.send_sms_otp('0931234567', '123456')
        self.assertNotIn('123456', str(output.call_args))

    def test_walk_in_links_legacy_profile_without_losing_history(self):
        with get_db_connection() as db:
            db.execute('UPDATE patient SET user_id=NULL WHERE patient_id=3')
            db.execute('DELETE FROM patient_delegate WHERE patient_id=3')
            db.execute('UPDATE users SET phone=NULL WHERE user_id=16')
            db.execute("UPDATE work_schedule SET work_date='2035-01-01',start_time='10:00',end_time='12:00',"
                       "max_quota=4,booked_count=0,schedule_status='OPEN' WHERE schedule_id=1")
        with patch.object(encounter_service, 'utc_now', return_value=datetime(2035, 1, 1, 2, tzinfo=timezone.utc)):
            response = self.client.post('/staff/encounters/walk-in', headers=self.headers('ADMIN'),
                                        json={'patient_id': 3, 'doctor_profile_id': 1})
        self.assertEqual(response.status_code, 201, response.json)
        with get_db_connection() as db:
            profile = db.execute('SELECT * FROM patient WHERE patient_id=3').fetchone()
            account = auth_model.get_user_by_id(db, profile['user_id'])
            self.assertEqual(account['phone'], profile['phone'])
        history = self.client.get('/patients/3/encounters', headers=self.actor_headers(profile['user_id']))
        self.assertEqual(history.json['total'], 2)


if __name__ == '__main__':
    unittest.main()
