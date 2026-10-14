"""Frontend auth contract against a disposable PostgreSQL schema."""
import os
import unittest
from unittest.mock import patch
from backend.tests import test_postgres
from backend.app.main import create_app


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Requires PostgreSQL')
class FrontendAuthTests(unittest.TestCase):
    drop_schema = test_postgres.PostgresTests.drop_schema

    def setUp(self):
        test_postgres.PostgresTests.setUp(self)
        secret = patch.dict(os.environ, {'SECRET_KEY': 'frontend-auth-test-only'})
        secret.start()
        self.addCleanup(secret.stop)
        self.client = create_app().test_client()
        self.origin = {'Origin': 'http://127.0.0.1:3000'}
        self.account = {'full_name': 'Kiểm thử frontend', 'email': 'frontend@example.test',
                        'phone': '0931234567', 'password': 'Test-password-123'}

    def test_cors_preflight_errors_and_unlisted_origin(self):
        response = self.client.options('/me', headers={**self.origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization,content-type'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], self.origin['Origin'])
        self.assertIn('Authorization', response.headers['Access-Control-Allow-Headers'])
        self.assertNotIn('Access-Control-Allow-Credentials', response.headers)
        denied = self.client.get('/me', headers=self.origin)
        self.assertEqual(denied.status_code, 401)
        self.assertEqual(denied.headers['Access-Control-Allow-Origin'], self.origin['Origin'])
        self.assertNotIn('Access-Control-Allow-Origin', self.client.options('/me', headers={
            'Origin': 'https://unlisted.example'}).headers)

    def test_registration_login_and_complete_email_recovery(self):
        registered = self.client.post('/auth/register', json=self.account, headers=self.origin)
        self.assertEqual(registered.status_code, 201)
        self.assertNotIn('access_token', registered.json)
        self.assertNotIn('password_hash', registered.json['user'])
        self.assertEqual(self.client.post('/auth/register', json=self.account).status_code, 409)
        credentials = {'identifier': self.account['email'], 'password': self.account['password']}
        login = self.client.post('/auth/login', json=credentials)
        self.assertEqual(login.status_code, 200)
        headers = {'Authorization': 'Bearer ' + login.json['access_token']}
        self.assertEqual(self.client.get('/me', headers=headers).status_code, 200)
        with patch('backend.app.services.auth_service.mail.send_otp') as mail:
            sent = self.client.post('/auth/forgot-password', json={'identifier': credentials['identifier']})
            otp = mail.call_args.args[1]
        self.assertEqual(sent.status_code, 200)
        self.assertNotIn(otp, sent.get_data(as_text=True))
        verified = self.client.post('/auth/verify-otp', json={'identifier': credentials['identifier'], 'otp': otp})
        self.assertEqual(verified.status_code, 200)
        payload = {'reset_token': verified.json['reset_token'], 'new_password': 'Changed-password-123'}
        self.assertEqual(self.client.post('/auth/reset-password', json=payload).status_code, 200)
        self.assertEqual(self.client.post('/auth/reset-password', json=payload).status_code, 400)
        self.assertEqual(self.client.get('/me', headers=headers).status_code, 401)
        self.assertEqual(self.client.post('/auth/login', json=credentials).status_code, 401)
        self.assertEqual(self.client.post('/auth/login', json={**credentials,
            'password': payload['new_password']}).status_code, 200)
