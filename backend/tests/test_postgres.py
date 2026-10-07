"""PostgreSQL integration checks using a disposable schema, never real tables."""
import os
import re
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
import psycopg
from psycopg import sql
from werkzeug.security import check_password_hash, generate_password_hash
from backend.app.core.config import postgres_options
from backend.app.db.database import get_db_connection
from backend.app.db.db_service import init_database, seed_database
from backend.app.main import create_app


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Set RUN_POSTGRES_TESTS=1 with PostgreSQL available')
class PostgresTests(unittest.TestCase):
    def setUp(self):
        self.options = postgres_options()
        self.schema = 'test_' + uuid.uuid4().hex
        with psycopg.connect(**self.options) as db:
            db.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
        self.addCleanup(self.drop_schema)
        self.options = dict(self.options, options=f'-c timezone=UTC -c search_path={self.schema}')
        self.config = patch('backend.app.db.database.postgres_options', return_value=self.options)
        self.config.start()
        self.addCleanup(self.config.stop)
        init_database()
        seed_database()

    def drop_schema(self):
        with psycopg.connect(**postgres_options()) as db:
            db.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(self.schema)))

    def test_erd_repeat_and_health(self):
        html = (Path(__file__).resolve().parents[2] / 'database/erd.html').read_text(encoding='utf-8')
        entities = re.findall(r'^    ([A-Z_]+) \{\n(.*?)^    \}', html, re.M | re.S)
        self.assertEqual(len(entities), 20)
        with get_db_connection() as db:
            for name, body in entities:
                expected = set(re.findall(r'^\s+\w+ (\w+)', body, re.M))
                actual = {r['column_name'] for r in db.execute(
                    'SELECT column_name FROM information_schema.columns WHERE table_schema=%s AND table_name=%s',
                    (self.schema, name.lower()))}
                self.assertEqual(actual, expected, name)
            db.execute("INSERT INTO department(name) VALUES ('Keep me')")
            db.execute("UPDATE role SET description='Custom' WHERE role_name='USER'")
        init_database()
        seed_database()
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT count(*) AS n FROM role').fetchone()['n'], 5)
            self.assertEqual(db.execute('SELECT name FROM department').fetchone()['name'], 'Keep me')
            self.assertEqual(db.execute("SELECT description FROM role WHERE role_name='USER'").fetchone()['description'], 'Custom')
        response = create_app().test_client().get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {'status': 'ok', 'database': 'postgresql'})

    def test_admin_and_demo_no_overwrite(self):
        options = dict(admin_email='ADMIN@example.test', admin_name='Admin', admin_password='Test-password-123456')
        seed_database(demo=True, **options)
        with get_db_connection() as db:
            demo_hash = db.execute("SELECT password_hash FROM users WHERE email='demo.author@example.test'").fetchone()['password_hash']
            self.assertTrue(demo_hash.startswith('scrypt:'))
            original = db.execute("SELECT password_hash FROM users WHERE email='admin@example.test'").fetchone()['password_hash']
            self.assertTrue(check_password_hash(original, options['admin_password']))
            db.execute("UPDATE article SET title='Edited'")
        options['admin_password'] = 'Another-password-123456'
        seed_database(demo=True, **options)
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT count(*) AS n FROM users').fetchone()['n'], 2)
            self.assertEqual(db.execute("SELECT password_hash FROM users WHERE email='admin@example.test'").fetchone()['password_hash'], original)
            self.assertEqual(db.execute('SELECT title FROM article').fetchone()['title'], 'Edited')

    def test_constraints_and_update_trigger(self):
        with get_db_connection() as db:
            department = db.execute("INSERT INTO department(name,updated_at) VALUES ('Test','2000-01-01') RETURNING department_id").fetchone()['department_id']
            db.execute('UPDATE department SET name=%s WHERE department_id=%s', ('Updated', department))
            self.assertGreater(db.execute('SELECT extract(year FROM updated_at) AS year FROM department').fetchone()['year'], 2000)
            for query in ("INSERT INTO users(role_id,full_name) SELECT role_id,'Missing hash' FROM role WHERE role_name='USER'",
                          "INSERT INTO users(role_id,full_name,password_hash) SELECT role_id,'Blank hash','   ' FROM role WHERE role_name='USER'",
                          "INSERT INTO patient(user_id,full_name) VALUES (-1,'Invalid')",
                          'UPDATE department SET is_active=2',
                          "INSERT INTO role(role_name) VALUES ('INVALID')",
                          "INSERT INTO role(role_name) VALUES ('USER')",
                          "INSERT INTO work_schedule(doctor_profile_id,room_id,work_date,start_time,end_time,max_quota) VALUES (1,1,'2030-01-01','09:00','08:00',10)"):
                with self.subTest(query=query), self.assertRaises(psycopg.IntegrityError):
                    with db.transaction():
                        db.execute(query)

    def test_extension_migration_preserves_data_and_repeats(self):
        migration = (Path(__file__).resolve().parents[2] / 'database/migrations/001_extend_booking_schema.sql').read_text(encoding='utf-8')
        # The connection context owns the transaction in tests.
        migration = migration.replace('BEGIN;', '', 1).replace('COMMIT;', '', 1)
        with get_db_connection() as db:
            patient_id = db.execute("INSERT INTO patient(full_name) VALUES ('Preserved') RETURNING patient_id").fetchone()['patient_id']
            db.execute('ALTER TABLE patient DROP COLUMN archived_at')
            db.execute('ALTER TABLE visit DROP COLUMN consultation_fee_snapshot CASCADE')
            db.execute('ALTER TABLE visit DROP COLUMN deposit_amount_snapshot CASCADE')
            db.execute('DROP TABLE nurse_assignment, role_request')
            db.execute(migration)
            db.execute(migration)
            patient = db.execute('SELECT full_name, archived_at FROM patient WHERE patient_id=%s', (patient_id,)).fetchone()
            self.assertEqual(patient['full_name'], 'Preserved')
            self.assertIsNone(patient['archived_at'])
            user_id = db.execute("INSERT INTO users(role_id,full_name,password_hash) SELECT role_id,'Applicant',%s FROM role WHERE role_name='USER' RETURNING user_id", (generate_password_hash('Test-password-123456'),)).fetchone()['user_id']
            role_id = db.execute("SELECT role_id FROM role WHERE role_name='NURSE'").fetchone()['role_id']
            db.execute('INSERT INTO role_request(user_id,requested_role_id) VALUES (%s,%s)', (user_id, role_id))
            with self.assertRaises(psycopg.IntegrityError):
                with db.transaction():
                    db.execute('INSERT INTO role_request(user_id,requested_role_id) VALUES (%s,%s)', (user_id, role_id))
            with self.assertRaises(psycopg.IntegrityError):
                with db.transaction():
                    db.execute("UPDATE role_request SET request_status='APPROVED'")

    def test_failed_transaction_rolls_back(self):
        with self.assertRaises(ValueError):
            with get_db_connection() as db:
                db.execute("INSERT INTO department(name) VALUES ('Rollback')")
                raise ValueError('Rollback')
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT count(*) AS n FROM department').fetchone()['n'], 0)


if __name__ == '__main__':
    unittest.main()
