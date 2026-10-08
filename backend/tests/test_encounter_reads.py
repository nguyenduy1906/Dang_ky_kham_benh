import os
import unittest

from backend.tests import test_nurse_assignment
from backend.app.core.security import create_access_token
from backend.app.db.database import get_db_connection
from backend.app.models import user_model


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Set RUN_POSTGRES_TESTS=1 with PostgreSQL available')
class EncounterReadTests(unittest.TestCase):
    setUp = test_nurse_assignment.NurseAssignmentTests.setUp
    drop_schema = test_nurse_assignment.NurseAssignmentTests.drop_schema
    headers = test_nurse_assignment.NurseAssignmentTests.headers

    def test_reads_enforce_resource_permissions_and_pagination(self):
        self.assertEqual(self.client.get('/encounters').status_code, 401)
        owner = self.headers('USER')
        listing = self.client.get('/encounters?page_size=1', headers=owner)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json['total'], 1)
        self.assertEqual(listing.json['items'][0]['patient_id'], 1)
        self.assertEqual(self.client.get('/encounters/2', headers=owner).status_code, 404)
        self.assertEqual(self.client.get('/encounters/2/status-history', headers=owner).status_code, 404)
        self.assertEqual(self.client.get('/encounters/2/transfer-history', headers=owner).status_code, 404)
        admin = self.headers('ADMIN')
        self.assertEqual(self.client.get('/encounters?page_size=1', headers=admin).json['total'], 10)
        self.assertEqual(self.client.get('/encounters/1/status-history', headers=owner).status_code, 200)
        self.assertEqual(self.client.get('/encounters/1/transfer-history', headers=owner).status_code, 200)
        with get_db_connection() as db:
            doctor_id = db.execute('SELECT user_id FROM doctor_profile WHERE doctor_profile_id=1').fetchone()['user_id']
            doctor = user_model.get_user_by_id(db, doctor_id)
        doctor_headers = {'Authorization': 'Bearer ' + create_access_token(doctor)}
        self.assertEqual(self.client.get('/encounters/1', headers=doctor_headers).status_code, 200)
        self.assertEqual(self.client.get('/encounters/2', headers=doctor_headers).status_code, 404)
        self.assertEqual(self.client.get('/encounters', headers=doctor_headers).json['total'], 1)

    def test_nurse_access_disappears_after_revocation_and_swagger(self):
        admin, nurse = self.headers('ADMIN'), self.headers('NURSE')
        self.assertEqual(self.client.get('/encounters', headers=nurse).json['total'], 0)
        response = self.client.post('/admin/nurse-assignments', headers=admin,
                                    json={'nurse_id': self.actors['NURSE']['user_id'], 'schedule_id': 2})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.get('/encounters/2', headers=nurse).status_code, 200)
        self.assertEqual(self.client.get('/encounters/2/status-history', headers=nurse).status_code, 200)
        assignment_id = response.json['assignment']['assignment_id']
        self.client.post(f'/admin/nurse-assignments/{assignment_id}/revoke', headers=admin)
        self.assertEqual(self.client.get('/encounters/2', headers=nurse).status_code, 404)
        self.assertEqual(self.client.get('/encounters/2/status-history', headers=nurse).status_code, 404)
        self.assertEqual(self.client.get('/encounters', headers=nurse).json['total'], 0)
        specification = self.client.get('/apispec_1.json')
        self.assertEqual(specification.status_code, 200)
        for path in ('/encounters', '/encounters/{encounter_id}',
                     '/encounters/{encounter_id}/status-history', '/encounters/{encounter_id}/transfer-history'):
            self.assertIn('get', specification.json['paths'][path])
