"""Business references and rolling demo coverage, using disposable PostgreSQL schemas."""
import os
import unittest
from pathlib import Path
from unittest.mock import patch
import psycopg

from backend.tests import test_postgres
from backend.app.core.security import create_access_token
from backend.app.db.database import get_db_connection
from backend.app.main import create_app
from backend.app.models import auth_model, payment_model
from backend.app.models import statistics_model
from backend.app.schemas import statistics_schema
from backend.app.utils.business_codes import business_code
from backend.app.utils.database_helpers import jsonable


class CodeFormattingTests(unittest.TestCase):
    def test_codes_grow_without_truncation_and_keep_ids(self):
        self.assertEqual(business_code('BN', 1), 'BN_001')
        self.assertEqual(business_code('BN', 1000), 'BN_1000')
        for invalid in (None, 0, -1, True, '1'):
            self.assertIsNone(business_code('BN', invalid))
        row = jsonable({'patient_id': 1000, 'encounter_id': 2, 'token_hash': 'unchanged'})
        self.assertEqual(row, {'patient_id': 1000, 'patient_code': 'BN_1000', 'encounter_id': 2,
                               'encounter_code': 'LK_002', 'token_hash': 'unchanged'})


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Requires disposable PostgreSQL')
class BusinessCodeTests(unittest.TestCase):
    setUp = test_postgres.PostgresTests.setUp
    drop_schema = test_postgres.PostgresTests.drop_schema

    def sample(self):
        text = (Path(__file__).resolve().parents[2] / 'database/sample_data.sql').read_text(encoding='utf-8')
        with get_db_connection() as db:
            db.execute(text.replace('BEGIN;', '', 1).replace('COMMIT;', '', 1))

    def test_seed_rejects_an_old_schema_before_removing_existing_data(self):
        self.sample()
        sample = (Path(__file__).resolve().parents[2] / 'database/sample_data.sql').read_text(encoding='utf-8')
        with get_db_connection() as db:
            db.execute('ALTER TABLE patient DROP COLUMN patient_code')
            with self.assertRaisesRegex(psycopg.errors.RaiseException, 'Schema cu'):
                with db.transaction():
                    db.execute(sample.replace('BEGIN;', '', 1).replace('COMMIT;', '', 1))
            self.assertEqual(db.execute('SELECT count(*) n FROM patient').fetchone()['n'], 10)
            self.assertEqual(db.execute('SELECT count(*) n FROM encounter').fetchone()['n'], 220)

    def test_database_generates_unique_codes_and_payment_references(self):
        self.sample()
        with get_db_connection() as db:
            self.assertEqual(db.execute("SELECT business_code('BN',1000) code").fetchone()['code'], 'BN_1000')
            row = db.execute("INSERT INTO patient(full_name) VALUES ('Mẫu kiểm thử mã') RETURNING *").fetchone()
            self.assertEqual(row['patient_code'], business_code('BN', row['patient_id']))
            first = payment_model.create(db, {'encounter_id': 1, 'payment_type': 'EXAM_FEE', 'amount': 1, 'payment_method': 'CASH'})
            second = payment_model.create(db, {'encounter_id': 1, 'payment_type': 'REFUND', 'original_payment_id': first['payment_id'],
                                               'amount': 1, 'payment_method': 'CASH'})
            self.assertRegex(first['transaction_code'], r'^GD_DEMO_\d{8}_\d{6,}$')
            self.assertRegex(second['transaction_code'], r'^HT_DEMO_\d{8}_\d{6,}$')
            self.assertNotEqual(first['transaction_code'], second['transaction_code'])
            self.assertEqual(db.execute('SELECT count(*) n FROM encounter WHERE ticket_code IS NOT NULL AND ticket_code !~ %s',
                                       (r'^PK_\d{8}_\d{6,}$',)).fetchone()['n'], 0)
            self.assertEqual(db.execute('SELECT count(*) n FROM payment WHERE transaction_code !~ %s',
                                       (r'^(GD|HT)_DEMO_\d{8}_\d{6,}$',)).fetchone()['n'], 0)

    def test_demo_walk_in_receipts_follow_check_in_date_and_reports_preserve_refunds(self):
        self.sample()
        with get_db_connection() as db:
            self.assertEqual(db.execute('''SELECT count(*) n FROM payment p JOIN encounter e USING(encounter_id)
                WHERE e.encounter_id>10 AND e.encounter_type='WALK_IN'
                AND (e.created_at<>e.estimated_exam_at-interval '15 minutes'
                  OR p.paid_at IS DISTINCT FROM e.checked_in_at
                  OR p.result_received_at IS DISTINCT FROM e.checked_in_at)''').fetchone()['n'], 0)
            day = str(db.execute("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Saigon')::date d").fetchone()['d'])
            summary = statistics_model.payments(db, statistics_schema.parse_query({'from_date':day,'to_date':day}))['summary']
            self.assertEqual(summary['exam_fee_received'], 9060000)
            self.assertGreaterEqual(summary['net_received'], 4530000)
            self.assertEqual(summary['net_received'], summary['gross_received']-summary['refunded_amount'])
            # A day containing only refunds legitimately has negative net cash flow.
            db.execute("UPDATE payment SET paid_at='2040-01-01 10:00:00+07' WHERE payment_type='REFUND'")
            summary = statistics_model.payments(db, statistics_schema.parse_query({'from_date':'2040-01-01','to_date':'2040-01-01'}))['summary']
            self.assertEqual(summary['net_received'], -4530000)

    def test_demo_has_coherent_role_data_and_preserves_assignment_scope(self):
        self.sample()
        with patch.dict(os.environ, {'SECRET_KEY': 'business-codes-test-only'}):
            client = create_app().test_client()
            with get_db_connection() as db:
                day = str(db.execute("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Saigon')::date d").fetchone()['d'])
                actors = {uid: auth_model.get_user_by_id(db, uid) for uid in (1,2,3,4,6,28)}
                self.assertEqual({r['encounter_status'] for r in db.execute('SELECT DISTINCT encounter_status FROM encounter')},
                                 {'HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','EXPIRED'})
                self.assertEqual(db.execute('''SELECT count(*) n FROM work_schedule s WHERE s.booked_count<>
                    (SELECT count(*) FROM encounter e WHERE e.schedule_id=s.schedule_id AND
                     e.encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED'))''').fetchone()['n'], 0)
                self.assertEqual(db.execute('''SELECT count(*) n FROM nurse_assignment a JOIN nurse_assignment b
                    ON a.nurse_id=b.nurse_id AND a.assignment_id<b.assignment_id
                    JOIN work_schedule x ON x.schedule_id=a.schedule_id JOIN work_schedule y ON y.schedule_id=b.schedule_id
                    WHERE a.revoked_at IS NULL AND b.revoked_at IS NULL AND x.work_date=y.work_date
                    AND x.start_time<y.end_time AND y.start_time<x.end_time''').fetchone()['n'], 0)
            def headers(uid):
                return {'Authorization': 'Bearer ' + create_access_token(actors[uid])}
            for uid in actors:
                response = client.get('/encounters?page_size=100', headers=headers(uid))
                self.assertEqual(response.status_code, 200, response.json)
                self.assertGreater(response.json['total'], 0)
                self.assertTrue(all(r['encounter_code'].startswith('LK_') for r in response.json['items']))
            nurse = client.get('/staff/appointment-tickets?work_date='+day, headers=headers(3))
            self.assertEqual(nurse.status_code, 200, nurse.json)
            self.assertEqual(nurse.json['total'], 6)
            self.assertEqual({r['encounter_status'] for r in nurse.json['items']}, {'CONFIRMED','CHECKED_IN','IN_PROGRESS'})
            self.assertTrue(all(r['doctor_profile_id']==1 for r in nurse.json['items']))
            foreign = client.get('/staff/appointment-tickets?work_date='+day, headers=headers(28)).json['items'][0]
            self.assertEqual(client.get('/encounters/'+str(foreign['encounter_id']), headers=headers(3)).status_code, 404)
            with get_db_connection() as db:
                db.execute('UPDATE nurse_assignment SET revoked_at=CURRENT_TIMESTAMP,revoked_by_id=1 WHERE nurse_id=3 AND revoked_at IS NULL')
            self.assertEqual(client.get('/staff/appointment-tickets?work_date='+day, headers=headers(3)).json['total'], 0)
