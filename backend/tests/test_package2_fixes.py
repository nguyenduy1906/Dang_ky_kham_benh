import os
import unittest
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image

from backend.tests import test_nurse_assignment
from backend.app.core.security import create_access_token
from backend.app.core.utils import today_vn
from backend.app.db.database import get_db_connection
from backend.app.models import user_model


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Set RUN_POSTGRES_TESTS=1 with PostgreSQL available')
class Package2FixTests(unittest.TestCase):
    setUp = test_nurse_assignment.NurseAssignmentTests.setUp
    drop_schema = test_nurse_assignment.NurseAssignmentTests.drop_schema
    headers = test_nurse_assignment.NurseAssignmentTests.headers

    def test_nurse_scope_and_revoked_history(self):
        admin, nurse = self.headers('ADMIN'), self.headers('NURSE')
        nurse_id = self.actors['NURSE']['user_id']
        with get_db_connection() as db:
            # Một bệnh nhân có lượt khám trong hai ca, chỉ được xem ca được giao.
            db.execute('UPDATE encounter SET patient_id=1 WHERE encounter_id=2')
        path = '/admin/nurse-assignments'
        first = self.client.post(path, json={'nurse_id': nurse_id, 'schedule_id': 1}, headers=admin)
        self.assertEqual(first.status_code, 201)
        listing = self.client.get('/patients', headers=nurse)
        self.assertEqual(listing.json['total'], 1)
        self.assertEqual([p['patient_id'] for p in listing.json['items']], [1])
        self.assertEqual(self.client.get('/patients/1', headers=nurse).status_code, 200)
        history = self.client.get('/patients/1/encounters?page_size=1', headers=nurse)
        self.assertEqual(history.json['total'], 1)
        self.assertEqual([e['schedule_id'] for e in history.json['items']], [1])
        second = self.client.post(path, json={'nurse_id': nurse_id, 'schedule_id': 2}, headers=admin)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(self.client.get('/patients/1/encounters', headers=nurse).json['total'], 2)
        first_id = first.json['assignment']['assignment_id']
        self.assertEqual(self.client.post(f'{path}/{first_id}/revoke', headers=admin).status_code, 200)
        history = self.client.get('/patients/1/encounters', headers=nurse)
        self.assertEqual(history.json['total'], 1)
        self.assertEqual([e['schedule_id'] for e in history.json['items']], [2])
        second_id = second.json['assignment']['assignment_id']
        self.client.post(f'{path}/{second_id}/revoke', headers=admin)
        self.assertEqual(self.client.get('/patients', headers=nurse).json['total'], 0)
        for endpoint in ('/patients/1', '/patients/1/encounters'):
            response = self.client.get(endpoint, headers=nurse)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json['error']['code'], 'PATIENT_NOT_FOUND')
        self.assertEqual(self.client.get('/patients/1/encounters', headers=admin).json['total'], 2)
        self.assertEqual(self.client.get('/patients/1', headers=self.headers('USER')).status_code, 200)

    def test_public_schedules_filter_before_pagination(self):
        with get_db_connection() as db:
            for offset, status in enumerate(('CLOSED', 'OPEN', 'FULL'), 1):
                db.execute('INSERT INTO work_schedule (doctor_profile_id,room_id,work_date,start_time,end_time,max_quota,schedule_status) '
                           "VALUES (1,1,%s,'08:00','09:00',5,%s)", (today_vn() + timedelta(days=offset), status))
        response = self.client.get('/doctors/1/schedules?page_size=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 2)
        self.assertEqual([s['schedule_status'] for s in response.json['items']], ['OPEN'])
        second = self.client.get('/doctors/1/schedules?page_size=1&page=2')
        self.assertEqual(second.json['total'], 2)
        self.assertEqual([s['schedule_status'] for s in second.json['items']], ['FULL'])
        closed = self.client.get('/doctors/1/schedules?status=CLOSED')
        self.assertEqual(closed.json['total'], 0)
        self.assertEqual(closed.json['items'], [])
        admin = self.client.get('/admin/schedules?status=CLOSED', headers=self.headers('ADMIN'))
        self.assertGreaterEqual(admin.json['total'], 1)

    def test_avatar_decoding_and_no_side_effect_on_invalid_image(self):
        with get_db_connection() as db:
            actor_id = db.execute("SELECT user_id FROM doctor_profile WHERE doctor_profile_id=1").fetchone()['user_id']
            doctor = user_model.get_user_by_id(db, actor_id)
        headers = {'Authorization': 'Bearer ' + create_access_token(doctor)}
        with TemporaryDirectory() as directory, patch.dict(os.environ, {'UPLOAD_DIR': directory}):
            for fmt, ext in (('PNG', 'png'), ('JPEG', 'jpg'), ('WEBP', 'webp')):
                buffer = BytesIO()
                Image.new('RGB', (8, 8), 'red').save(buffer, format=fmt)
                valid_data = buffer.getvalue()
                response = self.client.post('/doctor/profile/avatar', headers=headers,
                                            data={'file': (BytesIO(valid_data), 'test.' + ext)})
                self.assertEqual(response.status_code, 200, response.json)
                self.assertTrue(response.json['doctor']['avatar_url'].endswith('.' + ext))
            old_url = response.json['doctor']['avatar_url']
            old_files = list(Path(directory, 'avatars').iterdir())
            broken = (b'\x89PNG\r\n\x1a\n', b'\xff\xd8\xff', b'RIFF1234WEBP', valid_data[:20])
            for data in broken:
                response = self.client.post('/doctor/profile/avatar', headers=headers,
                                            data={'file': (BytesIO(data), 'fake.png')})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json['error']['code'], 'INVALID_IMAGE')
                self.assertEqual(self.client.get('/doctor/profile', headers=headers).json['doctor']['avatar_url'], old_url)
                self.assertEqual(list(Path(directory, 'avatars').iterdir()), old_files)
            oversized = self.client.post('/doctor/profile/avatar', headers=headers,
                                          data={'file': (BytesIO(b'x' * (2 * 1024 * 1024 + 1)), 'big.png')})
            self.assertEqual(oversized.status_code, 400)
            self.assertEqual(oversized.json['error']['code'], 'FILE_TOO_LARGE')
