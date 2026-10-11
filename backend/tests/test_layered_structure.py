"""Layer boundaries and HTTP wiring checks without a live PostgreSQL server."""
import ast
import importlib
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.main import create_app

APP_DIR = Path(__file__).resolve().parents[1] / 'app'


class LayeredStructureTests(unittest.TestCase):
    def test_import_every_application_module(self):
        for path in APP_DIR.rglob('*.py'):
            relative = path.relative_to(APP_DIR).with_suffix('')
            name = 'backend.app.' + '.'.join(relative.parts)
            with self.subTest(module=name):
                importlib.import_module(name)

    def test_services_are_independent_of_http_and_sql_execution(self):
        for path in (APP_DIR / 'services').glob('*.py'):
            tree = ast.parse(path.read_text(encoding='utf-8'))
            with self.subTest(file=path.name):
                for node in ast.walk(tree):
                    if isinstance(node, ast.ImportFrom):
                        self.assertNotIn(node.module, ('flask', 'backend.app.controllers', 'backend.app.routes'))
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                        self.assertNotEqual(node.func.attr, 'execute')

    def test_repositories_do_not_import_services_or_http(self):
        for path in (APP_DIR / 'repositories').glob('*.py'):
            tree = ast.parse(path.read_text(encoding='utf-8'))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module:
                    with self.subTest(file=path.name, dependency=node.module):
                        self.assertFalse(node.module.startswith(('backend.app.services', 'backend.app.controllers', 'backend.app.routes', 'flask')))

    def make_client(self):
        with patch('backend.app.main.check_database_ready'), patch.dict(os.environ, {'SECRET_KEY': 'structure-test-only'}):
            return create_app().test_client()

    def test_swagger_and_authentication_wiring(self):
        client = self.make_client()
        spec = client.get('/apispec_1.json')
        self.assertEqual(spec.status_code, 200)
        for path in ('/patients', '/encounters/online', '/auth/register', '/admin/nurse-assignments', '/doctor/encounters/{encounter_id}/medical-record'):
            self.assertIn(path, spec.json['paths'])
        response = client.get('/patients')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json['error']['code'], 'UNAUTHORIZED')

    def test_controller_validation_and_response_status(self):
        client = self.make_client()
        with patch('backend.app.controllers.auth_controller.auth_service.register', return_value={'user': {'user_id': 1}}) as register:
            invalid = client.post('/auth/register', json={})
            self.assertEqual(invalid.status_code, 400)
            register.assert_not_called()
            valid = client.post('/auth/register', json={'full_name': 'Test User', 'email': 'test@example.com', 'password': 'Test-password-123!'})
            self.assertEqual(valid.status_code, 201)
            self.assertEqual(valid.json, {'user': {'user_id': 1}})
            register.assert_called_once()


if __name__ == '__main__':
    unittest.main()
