"""Staff frontend contracts against real PostgreSQL in an isolated schema."""
import io
import os
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from PIL import Image
from backend.tests import test_encounter_workflow
from backend.app.db.database import get_db_connection


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Requires PostgreSQL')
class StaffFrontendTests(unittest.TestCase):
    setUp = test_encounter_workflow.EncounterWorkflowTests.setUp
    drop_schema = test_encounter_workflow.EncounterWorkflowTests.drop_schema
    fixture = test_encounter_workflow.EncounterWorkflowTests.fixture

    def login(self, role):
        with get_db_connection() as db:
            user = db.execute('SELECT u.email FROM users u JOIN role r USING(role_id) '
                              'WHERE r.role_name=%s AND u.deleted_at IS NULL '
                              'ORDER BY u.user_id LIMIT 1', (role,)).fetchone()
        response = self.client.post('/auth/login', json={
            'identifier': user['email'], 'password': 'Demo-password-123!'})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['user']['role_name'], role)
        return {'Authorization': 'Bearer ' + response.json['access_token']}

    def test_login_exact_role_permissions_and_revoked_nurse_scope(self):
        headers = {role: self.login(role) for role in ('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'USER')}
        for role, auth in headers.items():
            self.assertEqual(self.client.get('/me', headers=auth).json['user']['role_name'], role)
            self.assertEqual(self.client.get('/doctor/profile', headers=auth).status_code,
                             200 if role == 'DOCTOR' else 403)
            self.assertEqual(self.client.get('/nurse/assignments', headers=auth).status_code,
                             200 if role == 'NURSE' else 403)
        nurse = headers['NURSE']
        self.assertEqual(self.client.get('/encounters', headers=nurse).json['total'], 0)
        assignment = self.client.post('/admin/nurse-assignments', headers=headers['ADMIN'], json={
            'nurse_id': self.actors['NURSE']['user_id'], 'schedule_id': 1})
        self.assertEqual(assignment.status_code, 201, assignment.json)
        self.assertEqual(self.client.get('/encounters/1', headers=nurse).status_code, 200)
        self.assertEqual(self.client.get('/encounters/2', headers=nurse).status_code, 404)
        self.assertEqual(self.client.get('/encounters/1/medical-record', headers=headers['RECEPTIONIST']).status_code, 403)
        for role in ('NURSE', 'RECEPTIONIST', 'USER'):
            self.assertEqual(self.client.put('/doctor/encounters/1/medical-record', headers=headers[role],
                                            json={'diagnosis': 'Forbidden'}).status_code, 403)
        self.client.post(f'/admin/nurse-assignments/{assignment.json["assignment"]["assignment_id"]}/revoke',
                         headers=headers['ADMIN'])
        self.assertEqual(self.client.get('/encounters/1', headers=nurse).status_code, 404)
        self.assertEqual(self.client.get('/patients/1', headers=nurse).status_code, 404)
        with get_db_connection() as db:
            db.execute("UPDATE users SET account_status='LOCKED' WHERE user_id=%s",
                       (self.actors['NURSE']['user_id'],))
        self.assertEqual(self.client.get('/me', headers=nurse).status_code, 401)

    def test_reception_patient_reuse_walkin_doctor_record_and_nurse_read(self):
        self.fixture()
        reception, doctor, nurse, admin = [self.login(role) for role in ('RECEPTIONIST', 'DOCTOR', 'NURSE', 'ADMIN')]
        profile = {'full_name': 'Người bệnh kiểm thử', 'phone': '0931234567', 'dob': '1990-05-20'}
        invalid = self.client.post('/patients', headers=reception, json={**profile, 'dob': None})
        self.assertEqual(invalid.status_code, 400)
        created = self.client.post('/patients', headers=reception, json=profile)
        self.assertEqual(created.status_code, 201, created.json)
        patient_id = created.json['patient']['patient_id']
        reused = self.client.post('/patients', headers=reception, json=profile)
        self.assertEqual(reused.status_code, 200, reused.json)
        self.assertTrue(reused.json['patient_reused'])
        self.assertEqual(reused.json['patient']['patient_id'], patient_id)
        visit = self.client.post('/staff/encounters/walk-in', headers=reception,
                                 json={'patient_id': patient_id, 'doctor_profile_id': 1, 'symptoms': 'Kiểm thử'})
        self.assertEqual(visit.status_code, 201, visit.json)
        encounter = visit.json['encounter']
        self.assertEqual(encounter['encounter_status'], 'CHECKED_IN')
        self.assertTrue(encounter['ticket_code'].startswith('PK_'))
        eid = encounter['encounter_id']
        self.client.post('/admin/nurse-assignments', headers=admin,
                         json={'nurse_id': self.actors['NURSE']['user_id'], 'schedule_id': encounter['schedule_id']})
        self.now = datetime(2035, 1, 1, 3, 0, tzinfo=timezone.utc)
        self.assertEqual(self.client.post(f'/doctor/encounters/{eid}/start', headers=doctor).status_code, 200)
        saved = self.client.put(f'/doctor/encounters/{eid}/medical-record', headers=doctor,
                                json={'diagnosis': 'Chẩn đoán kiểm thử', 'expected_version': 0})
        self.assertEqual(saved.status_code, 200, saved.json)
        record = saved.json['medical_record']
        rx_url = f'/doctor/medical-records/{record["record_id"]}/prescription-items'
        rx = self.client.put(rx_url, headers=doctor, json={'items': [
            {'medication_name': 'Thuốc kiểm thử', 'quantity': 2}], 'expected_version': record['version']})
        self.assertEqual(rx.status_code, 200, rx.json)
        self.assertEqual(self.client.post(f'/doctor/encounters/{eid}/complete', headers=doctor).status_code, 200)
        amendment = {'diagnosis': 'Bổ sung kiểm thử', 'expected_version': rx.json['record_version']}
        self.assertEqual(self.client.put(f'/doctor/encounters/{eid}/medical-record', headers=doctor,
                                        json=amendment).status_code, 409)
        self.assertEqual(self.client.put(f'/doctor/encounters/{eid}/medical-record', headers=doctor,
                                        json={**amendment, 'reason': 'Đã có kết quả bổ sung'}).status_code, 200)
        visible = self.client.get(f'/encounters/{eid}/medical-record', headers=nurse)
        self.assertEqual(visible.status_code, 200, visible.json)
        self.assertEqual(visible.json['medical_record']['diagnosis'], amendment['diagnosis'])
        items = self.client.get(f'/medical-records/{record["record_id"]}/prescription-items', headers=nurse)
        self.assertEqual(items.status_code, 200)
        self.assertEqual(items.json['items'][0]['quantity'], 2)
        self.assertEqual(self.client.get(f'/encounters/{eid}/medical-record', headers=reception).status_code, 403)
        self.assertEqual(self.client.post('/staff/encounters/walk-in', headers=nurse,
                                         json={'patient_id': patient_id, 'doctor_profile_id': 1}).status_code, 403)

    def test_shared_account_profile_and_uploaded_doctor_avatar(self):
        for role in ('DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMIN'):
            headers = self.login(role)
            name = f'Hồ sơ {role}'
            saved = self.client.patch('/me', headers=headers, json={'full_name': name})
            self.assertEqual(saved.status_code, 200, saved.json)
            self.assertEqual(self.client.get('/me', headers=headers).json['user']['full_name'], name)
        doctor = self.login('DOCTOR')
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'UPLOAD_DIR': directory}):
            picture = io.BytesIO()
            Image.new('RGB', (20, 30), 'white').save(picture, format='PNG')
            picture.seek(0)
            uploaded = self.client.post('/doctor/profile/avatar', headers=doctor,
                                        data={'file': (picture, 'portrait.png')})
            self.assertEqual(uploaded.status_code, 200, uploaded.json)
            url = uploaded.json['doctor']['avatar_url']
            self.assertTrue(url.startswith('/uploads/avatars/'))
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.mimetype, 'image/png')
            response.close()
            self.assertEqual(self.client.get('/doctor/profile', headers=doctor).json['doctor']['avatar_url'], url)


if __name__ == '__main__':
    unittest.main()
