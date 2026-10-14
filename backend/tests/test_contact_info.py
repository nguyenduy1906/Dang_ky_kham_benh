"""Contact API checks in a disposable schema; do not write to real records."""
import os
import unittest
from backend.tests import test_postgres
from backend.app.db.database import get_db_connection
from backend.app.db.db_service import seed_database
from backend.app.main import create_app


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Requires disposable PostgreSQL schema')
class ContactInfoTests(unittest.TestCase):
    setUp = test_postgres.PostgresTests.setUp
    drop_schema = test_postgres.PostgresTests.drop_schema

    def test_public_response_only_exposes_contact_fields_and_missing_values_are_null(self):
        with get_db_connection() as db:
            db.execute("INSERT INTO system_configuration(config_key, config_value) VALUES ('INTERNAL_SECRET', 'do-not-expose')")
            db.execute("UPDATE system_configuration SET config_value='  Cơ sở thử nghiệm  ' WHERE config_key='HOSPITAL_NAME'")
            db.execute("UPDATE system_configuration SET config_value='' WHERE config_key='EXAM_HOURS'")
        result = create_app().test_client().get('/contact-info')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json, {'hospital_name': 'Cơ sở thử nghiệm', 'support_phone': '19001234',
                                      'support_email': None, 'exam_hours': None})
        with get_db_connection() as db:
            db.execute("DELETE FROM system_configuration WHERE config_key IN ('SUPPORT_EMAIL', 'EXAM_HOURS')")
        self.assertIsNone(create_app().test_client().get('/contact-info').json['support_email'])

    def test_admin_updates_are_reflected_publicly_and_anonymous_writes_are_rejected(self):
        seed_database(admin_email='admin@example.test', admin_name='Admin', admin_password='Contact-test-123456')
        client = create_app().test_client()
        self.assertEqual(client.get('/admin/configurations').status_code, 401)
        self.assertEqual(client.patch('/admin/configurations/SUPPORT_EMAIL', json={'config_value': 'demo@example.test'}).status_code, 401)
        login = client.post('/auth/login', json={'identifier': 'admin@example.test', 'password': 'Contact-test-123456'})
        self.assertEqual(login.status_code, 200, login.json)
        headers = {'Authorization': 'Bearer ' + login.json['access_token']}
        for key, value in [('SUPPORT_EMAIL', ' SUPPORT@EXAMPLE.TEST '), ('EXAM_HOURS', 'Thứ 2–Thứ 7: 08:00–17:00')]:
            result = client.patch('/admin/configurations/' + key, headers=headers, json={'config_value': value})
            self.assertEqual(result.status_code, 200, result.json)
        public = client.get('/contact-info').json
        self.assertEqual(public['support_email'], 'support@example.test')
        self.assertEqual(public['exam_hours'], 'Thứ 2–Thứ 7: 08:00–17:00')
        self.assertEqual(client.patch('/admin/configurations/SUPPORT_EMAIL', headers=headers, json={'config_value': 'bad-email'}).status_code, 400)
        departments = client.get('/departments')
        self.assertEqual(departments.status_code, 200)


if __name__ == '__main__':
    unittest.main()
