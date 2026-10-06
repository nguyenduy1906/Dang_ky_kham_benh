import hashlib
import os
import re
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND.parent))
from backend.app.core.config import resolve_db_path
from backend.app.database.database import get_db_connection
from backend.app.database.db_service import init_database, seed_database, SCHEMA_SQL, statements
from backend.main import create_app
from werkzeug.security import check_password_hash


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'nested' / 'test.db'

    def initialize(self):
        init_database(self.path)
        seed_database(self.path)

    def test_complete_erd_and_repeat_preserves_data(self):
        self.initialize()
        html = (BACKEND/'data/erd.html').read_text(encoding='utf-8')
        entities = re.findall(r'^    ([A-Z_]+) \{\n(.*?)^    \}', html, re.M | re.S)
        self.assertEqual(len(entities),18)
        with get_db_connection(self.path) as db:
            for name, body in entities:
                expected = set(re.findall(r'^\s+\w+ (\w+)',body,re.M))
                actual = {r['name'] for r in db.execute(f'PRAGMA table_info({name.lower()})')}
                self.assertEqual(actual,expected,name)
            db.execute("INSERT INTO department(name) VALUES ('Keep me')")
            db.execute("UPDATE role SET description='Custom description' WHERE role_name='USER'")
        self.initialize()
        with get_db_connection(self.path) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM role').fetchone()[0],5)
            self.assertEqual(db.execute('SELECT name FROM department').fetchone()[0],'Keep me')
            self.assertEqual(db.execute("SELECT description FROM role WHERE role_name='USER'").fetchone()[0],'Custom description')
            self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='schema_migrations'").fetchone())
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])

    def test_admin_hash_and_seed_no_overwrite(self):
        self.initialize()
        secret='Temporary-test-password-123!'
        options=dict(admin_email='admin@example.test',admin_name='Admin',admin_password=secret)
        seed_database(self.path,**options)
        with get_db_connection(self.path) as db:
            original=db.execute('SELECT password_hash FROM users WHERE email=?',('admin@example.test',)).fetchone()[0]
            self.assertNotEqual(original,secret)
            self.assertTrue(check_password_hash(original,secret))
        options['admin_password']='Another-test-password-456!'
        seed_database(self.path,**options)
        with get_db_connection(self.path) as db:
            self.assertEqual(db.execute('SELECT password_hash FROM users').fetchone()[0],original)
            self.assertEqual(db.execute('SELECT count(*) FROM users').fetchone()[0],1)

    def test_demo_optional_idempotent_and_stable_keys(self):
        init_database(self.path)
        with get_db_connection(self.path) as db:
            db.execute("INSERT INTO role(role_id,role_name) VALUES (87,'USER')")
        seed_database(self.path)
        with get_db_connection(self.path) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM users').fetchone()[0],0)
        seed_database(self.path,demo=True)
        with get_db_connection(self.path) as db:
            db.execute("UPDATE article SET title='Edited' WHERE slug='demo-huong-dan-dat-lich'")
        seed_database(self.path,demo=True)
        with get_db_connection(self.path) as db:
            user=db.execute('SELECT role_id,account_status,password_hash FROM users').fetchone()
            self.assertEqual(tuple(user),(87,'LOCKED',None))
            self.assertEqual(db.execute('SELECT count(*) FROM article').fetchone()[0],1)
            self.assertEqual(db.execute('SELECT title FROM article').fetchone()[0],'Edited')

    def test_constraints_and_timestamp(self):
        self.initialize()
        with get_db_connection(self.path) as db:
            doctor_role=db.execute("SELECT role_id FROM role WHERE role_name='DOCTOR'").fetchone()[0]
            uid=db.execute('INSERT INTO users(role_id,full_name) VALUES (?,?)',(doctor_role,'Doctor')).lastrowid
            dep=db.execute("INSERT INTO department(name,updated_at) VALUES ('Test','2000-01-01 00:00:00.000')").lastrowid
            db.execute('UPDATE department SET name=? WHERE department_id=?',('Updated',dep))
            self.assertGreater(db.execute('SELECT updated_at FROM department').fetchone()[0],'2000-01-01')
            doctor=db.execute('INSERT INTO doctor_profile(user_id,department_id) VALUES (?,?)',(uid,dep)).lastrowid
            room=db.execute('INSERT INTO room(department_id,room_name) VALUES (?,?)',(dep,'Room')).lastrowid
            patient=db.execute("INSERT INTO patient(full_name) VALUES ('Patient')").lastrowid
            schedule=db.execute('''INSERT INTO work_schedule(doctor_profile_id,room_id,work_date,start_time,end_time,max_quota)
                VALUES (?,?,?,?,?,?)''',(doctor,room,'2030-01-01','08:00:00','09:00:00',10)).lastrowid
            values=('ONLINE',patient,doctor,schedule,1)
            query='INSERT INTO visit(visit_type,patient_id,doctor_profile_id,schedule_id,queue_number) VALUES (?,?,?,?,?)'
            visit=db.execute(query,values).lastrowid
            record=db.execute('INSERT INTO medical_record(visit_id) VALUES (?)',(visit,)).lastrowid
            cases=[
                (query,values),
                ('INSERT INTO medical_record(visit_id) VALUES (?)',(visit,)),
                ('INSERT INTO review(record_id,rating) VALUES (?,?)',(record,6)),
                ('INSERT INTO patient(user_id,full_name) VALUES (?,?)',(-1,'Invalid FK')),
                ('UPDATE work_schedule SET booked_count=?',(11,)),
                ('UPDATE work_schedule SET end_time=?',('07:00:00',)),
                ('UPDATE doctor_profile SET consultation_fee=?',(1.5,)),
                ('UPDATE department SET is_active=?',(2,)),
            ]
            for query,params in cases:
                with self.subTest(query=query), self.assertRaises(sqlite3.IntegrityError):
                    db.execute(query,params)

    def test_atomic_failed_initialization(self):
        with patch('backend.app.database.db_service.SCHEMA_SQL',SCHEMA_SQL+'\nINVALID SQL;\n'), patch('backend.app.database.db_service._check_existing_schema'):
            with self.assertRaises(sqlite3.OperationalError):
                init_database(self.path)
        with get_db_connection(self.path) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0],0)

    def test_legacy_adoption_and_reject_conflicting_schema(self):
        with get_db_connection(self.path,create=True) as db:
            db.execute('BEGIN IMMEDIATE')
            for statement in statements(SCHEMA_SQL):
                db.execute(statement)
            db.execute("INSERT INTO department(name) VALUES ('Legacy')")
        init_database(self.path)
        with get_db_connection(self.path) as db:
            self.assertEqual(db.execute('SELECT name FROM department').fetchone()[0],'Legacy')
        bad=self.path.with_name('bad.db')
        with get_db_connection(bad,create=True) as db:
            db.execute('CREATE TABLE users(wrong_column TEXT)')
        with self.assertRaises(RuntimeError):
            init_database(bad)

    def test_paths_http_no_startup_seed_and_rollback(self):
        with patch.dict(os.environ,{'DB_PATH':'data/override.db'}):
            self.assertEqual(resolve_db_path(),BACKEND/'data/override.db')
        with self.assertRaises(RuntimeError):
            create_app(self.path)
        self.initialize()
        with self.assertRaises(ValueError):
            with get_db_connection(self.path) as db:
                db.execute("INSERT INTO department(name) VALUES ('Rollback')")
                raise ValueError('Expected')
        for _ in range(2):
            response=create_app(self.path).test_client().get('/health')
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json,{'status':'ok','database':'sqlite'})
        with get_db_connection(self.path) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM department').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT count(*) FROM users').fetchone()[0],0)


if __name__=='__main__':
    unittest.main()
