import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from backend.tests import test_postgres
from backend.app.core.security import create_access_token
from backend.app.db.database import get_db_connection
from backend.app.main import create_app
from backend.app.models import user_model
from backend.app.services import nurse_assignment_service


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Set RUN_POSTGRES_TESTS=1 with PostgreSQL available')
class NurseAssignmentTests(unittest.TestCase):
    drop_schema = test_postgres.PostgresTests.drop_schema

    def setUp(self):
        test_postgres.PostgresTests.setUp(self)
        sample = (Path(__file__).resolve().parents[2] / 'database/sample_data.sql').read_text(encoding='utf-8')
        with get_db_connection() as db:
            db.execute(sample.replace('BEGIN;', '', 1).replace('COMMIT;', '', 1))
            db.execute('DELETE FROM nurse_assignment')
            self.actors = {}
            for role in ('ADMIN', 'NURSE', 'USER'):
                row = db.execute('SELECT user_id FROM users u JOIN role r ON r.role_id=u.role_id '
                                 'WHERE r.role_name=%s ORDER BY user_id LIMIT 1', (role,)).fetchone()
                self.actors[role] = user_model.get_user_by_id(db, row['user_id'])
            self.schedule_id = db.execute('SELECT schedule_id FROM work_schedule LIMIT 1').fetchone()['schedule_id']
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
            other_user = user_model.get_user_by_id(db, other['user_id'])
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
